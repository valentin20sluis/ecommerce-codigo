import Stripe from "stripe";

import { NotFoundError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { CHECKOUT_CURRENCY, CHECKOUT_INTEGRATION_IDENTIFIER } from "@/lib/constants";
import { getStripe } from "@/lib/stripe";
import { dbTx } from "@/server/db/pool";
import type { User } from "@/server/db/schema";
import * as paymentMethodRepository from "@/server/repositories/payment-method.repository";
import * as userRepository from "@/server/repositories/user.repository";
import { ensureStripeCustomer } from "@/server/services/stripe-customer.service";

const ENTITY_TYPE = "payment_method";

/**
 * Sesión hosted de Stripe en `mode: "setup"`: recoge la tarjeta sin cobrar nada.
 * Al pasar `customer`, Stripe adjunta el PaymentMethod al confirmarse, así que
 * este flujo nunca llama a `paymentMethods.attach`.
 */
export async function createSetupSession(user: User): Promise<string> {
  const customerId = await ensureStripeCustomer(user);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const session = await getStripe().checkout.sessions.create({
    mode: "setup",
    customer: customerId,
    currency: CHECKOUT_CURRENCY,
    // El webhook resuelve el dueño por acá: la sesión de setup no tiene orden.
    metadata: { userId: user.id },
    integration_identifier: CHECKOUT_INTEGRATION_IDENTIFIER,
    // El redirect no escribe nada (D4): el flag solo dispara el banner de espera.
    success_url: `${appUrl}/profile/tarjetas?setup=success`,
    cancel_url: `${appUrl}/profile/tarjetas`,
    // Fijo a "card": sin esto, la página hosted también ofrece Link, que
    // `retrieveCard` descarta en silencio (010, alcance) y el usuario termina
    // el flujo sin que se guarde nada ni se muestre ningún error.
    payment_method_types: ["card"],
  });

  if (!session.url) {
    throw new Error("Stripe devolvió una sesión de setup sin URL de redirección.");
  }

  return session.url;
}

/** `setup_intent` llega como string en el evento: hay que releerlo expandido. */
async function retrieveCard(
  session: Stripe.Checkout.Session,
): Promise<{ paymentMethodId: string; card: Stripe.PaymentMethod.Card } | null> {
  const setupIntentId =
    typeof session.setup_intent === "string" ? session.setup_intent : session.setup_intent?.id;

  if (!setupIntentId) return null;

  const setupIntent = await getStripe().setupIntents.retrieve(setupIntentId, {
    expand: ["payment_method"],
  });

  const paymentMethod = setupIntent.payment_method;
  if (!paymentMethod || typeof paymentMethod === "string") return null;

  // Solo tarjetas (010, alcance): otro tipo de método no tiene marca ni last4.
  if (paymentMethod.type !== "card" || !paymentMethod.card) return null;

  return { paymentMethodId: paymentMethod.id, card: paymentMethod.card };
}

/**
 * Única vía de persistencia de una tarjeta (D4): el webhook viene firmado, el
 * redirect del navegador no. Idempotente por `stripe_payment_method_id` (D6).
 */
export async function saveCardFromSetupSession(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.userId;

  if (!userId) {
    console.warn(`[webhook:stripe] sesión de setup ${session.id} sin userId en metadata`);
    return;
  }

  const user = await userRepository.findById(userId);

  if (!user) {
    console.warn(`[webhook:stripe] sesión de setup ${session.id} con usuario inexistente`);
    return;
  }

  const resolved = await retrieveCard(session);

  if (!resolved) {
    console.warn(`[webhook:stripe] sesión de setup ${session.id} sin tarjeta utilizable`);
    return;
  }

  await dbTx.transaction(async (tx) => {
    const saved = await paymentMethodRepository.insertIfAbsent(tx, {
      userId: user.id,
      stripePaymentMethodId: resolved.paymentMethodId,
      // Solo marca, últimos 4 y vencimiento (D1): nunca el PAN ni el CVV, que
      // Stripe tampoco expone.
      brand: resolved.card.brand,
      last4: resolved.card.last4,
      expMonth: resolved.card.exp_month,
      expYear: resolved.card.exp_year,
    });

    // Reentrega del mismo evento: la fila ya existe, no se audita dos veces.
    if (!saved) return;

    await logAudit(tx, {
      actorId: user.id,
      action: "payment_method.saved",
      entityType: ENTITY_TYPE,
      entityId: saved.id,
      // Sin `last4` ni el `pm_...`: la bitácora no guarda datos de tarjeta.
      metadata: { brand: saved.brand },
    });
  });
}

/** Un `detach` sobre una tarjeta que Stripe ya no tiene adjunta no es un fallo. */
async function detachQuietly(stripePaymentMethodId: string): Promise<void> {
  try {
    await getStripe().paymentMethods.detach(stripePaymentMethodId);
  } catch (error) {
    // `resource_missing` / "not attached to a customer": el objetivo ya se
    // cumplió. Cualquier otro error (auth, red) sí se propaga.
    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      console.warn(`[stripe] detach omitido para ${stripePaymentMethodId}`, error.message);
      return;
    }

    throw error;
  }
}

/**
 * Borrado duro más `detach` (D5). El orden importa: si el `detach` falla de
 * verdad, la fila local sobrevive y la tarjeta sigue siendo visible, en vez de
 * desaparecer de la UI quedando adjunta en Stripe.
 */
export async function removeCard(user: User, id: string): Promise<void> {
  const card = await paymentMethodRepository.findByIdForUser(id, user.id);

  // Una tarjeta ajena es indistinguible de una inexistente: 404 en ambos casos
  // para no filtrar su existencia (AC12).
  if (!card) throw new NotFoundError("La tarjeta no existe.");

  await detachQuietly(card.stripePaymentMethodId);

  await dbTx.transaction(async (tx) => {
    const removed = await paymentMethodRepository.deleteById(tx, card.id);
    if (!removed) return;

    await logAudit(tx, {
      actorId: user.id,
      action: "payment_method.removed",
      entityType: ENTITY_TYPE,
      entityId: removed.id,
      metadata: { brand: removed.brand },
    });
  });
}
