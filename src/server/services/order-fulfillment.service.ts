import type Stripe from "stripe";

import { logAudit } from "@/lib/audit";
import { dbTx, type Executor } from "@/server/db/pool";
import * as orderRepository from "@/server/repositories/order.repository";
import type { OrderWithItems } from "@/server/repositories/order.repository";
import * as productRepository from "@/server/repositories/product.repository";

const ENTITY_TYPE = "order";

function resolvePaymentIntentId(session: Stripe.Checkout.Session): string | null {
  const intent = session.payment_intent;
  if (!intent) return null;

  return typeof intent === "string" ? intent : intent.id;
}

/**
 * Localiza la orden del evento. La vía normal es el `stripe_checkout_session_id`
 * ya adjuntado; el fallback por `metadata.orderId` cubre la carrera residual de
 * D5, en la que el webhook llega antes del attach.
 */
async function findOrderForSession(
  executor: Executor,
  session: Stripe.Checkout.Session,
): Promise<OrderWithItems | null> {
  const bySession = await orderRepository.findByStripeSessionId(session.id, executor);
  if (bySession) return bySession;

  const orderId = session.metadata?.orderId;
  if (!orderId) return null;

  const byMetadata = await orderRepository.findByIdWithItems(orderId, executor);
  if (!byMetadata) return null;

  // Deja la orden localizable por sesión para las reentregas siguientes.
  if (!byMetadata.stripeCheckoutSessionId) {
    await orderRepository.attachStripeSession(executor, byMetadata.id, session.id);
  }

  return byMetadata;
}

/**
 * Fulfillment del pago, idempotente: Stripe puede reentregar el mismo evento.
 * Marcar pagado, descontar stock y auditar ocurren en una sola transacción; el
 * `markPaid` condicional es el candado que evita el doble descuento (008 AC7).
 */
export async function fulfillOrder(session: Stripe.Checkout.Session): Promise<void> {
  await dbTx.transaction(async (tx) => {
    const order = await findOrderForSession(tx, session);

    if (!order) {
      console.warn(`[webhook:stripe] sesión ${session.id} sin orden asociada`);
      return;
    }

    if (order.status === "paid") return;

    const paid = await orderRepository.markPaid(tx, order.id, resolvePaymentIntentId(session));
    // Otra entrega del mismo evento ganó la carrera y ya la marcó: no repetir.
    if (!paid) return;

    await productRepository.decrementStock(
      tx,
      order.items.map((item) => ({ productId: item.productId, qty: item.qty })),
    );

    await logAudit(tx, {
      actorId: order.userId,
      action: "order.paid",
      entityType: ENTITY_TYPE,
      entityId: order.id,
      changes: { before: { status: order.status }, after: { status: paid.status } },
      // El id de sesión no es un secreto; datos de tarjeta Stripe nunca los envía.
      metadata: { stripeCheckoutSessionId: session.id, totalCents: order.totalCents },
    });
  });
}

/** `checkout.session.async_payment_failed`: sin stock descontado, severidad warning. */
export async function markOrderFailed(session: Stripe.Checkout.Session): Promise<void> {
  await dbTx.transaction(async (tx) => {
    const order = await findOrderForSession(tx, session);

    if (!order) {
      console.warn(`[webhook:stripe] sesión fallida ${session.id} sin orden asociada`);
      return;
    }

    // Reentrega del mismo fallo: ni auditar dos veces ni tocar una orden cobrada.
    if (order.status === "payment_failed" || order.status === "paid") return;

    const failed = await orderRepository.markFailed(tx, order.id);
    if (!failed) return;

    await logAudit(tx, {
      actorId: order.userId,
      action: "order.payment_failed",
      entityType: ENTITY_TYPE,
      entityId: order.id,
      changes: { before: { status: order.status }, after: { status: failed.status } },
      metadata: { stripeCheckoutSessionId: session.id },
      severity: "warning",
    });
  });
}
