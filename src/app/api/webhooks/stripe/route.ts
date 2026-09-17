import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";

import { toErrorResponse } from "@/lib/api-error";
import * as fulfillmentService from "@/server/services/order-fulfillment.service";
import * as savedCardService from "@/server/services/saved-card.service";

async function dispatch(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;

      // Un mismo tipo de evento sirve a dos flujos (010): `payment` es la compra
      // de 008 y `setup` el alta de tarjeta. Sin este branch, una sesión de
      // setup entraría al fulfillment a buscar una orden que no existe.
      if (session.mode === "setup") {
        await savedCardService.saveCardFromSetupSession(session);
        return;
      }

      // `subscription` no forma parte de la integración: se ignora en vez de
      // caer al fulfillment de compras.
      if (session.mode !== "payment") return;

      // Con métodos de notificación diferida, `completed` puede llegar con la
      // sesión todavía impaga: solo se cumple el pedido si ya está pagada. El
      // gate vive dentro del branch de pago: en `setup` no hay pago que mirar.
      if (session.payment_status !== "unpaid") {
        await fulfillmentService.fulfillOrder(session);
      }
      return;
    }
    case "checkout.session.async_payment_failed":
      await fulfillmentService.markOrderFailed(event.data.object);
      return;
    case "checkout.session.expired": {
      const session = event.data.object;

      // Una sesión de `setup` (010) que caduca no tiene orden que cancelar: se
      // ignora igual que en el branch de completed.
      if (session.mode !== "payment") return;

      await fulfillmentService.expireOrder(session);
      return;
    }
    default:
      // Stripe envía eventos a los que no estamos suscritos: 200 y seguir. Un
      // 500 aquí lo haría reintentar en bucle.
      return;
  }
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  // Body crudo obligatorio: `constructEvent` valida la firma sobre este string
  // exacto, así que nunca `request.json()`.
  const payload = await request.text();

  let event: Stripe.Event;

  try {
    if (!signature) throw new Error("Falta el header stripe-signature.");
    // Verificación estática a propósito: es criptografía pura sobre el signing
    // secret y no debe depender de `STRIPE_SECRET_KEY`, así una clave de API
    // ausente nunca convierte un 400 de firma en un 500.
    event = Stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET ?? "",
    );
  } catch (error) {
    console.error("[webhook:stripe] firma inválida", error);
    return NextResponse.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: "No se pudo verificar la firma del webhook.",
          details: null,
        },
      },
      { status: 400 },
    );
  }

  try {
    await dispatch(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
