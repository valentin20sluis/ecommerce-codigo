import { ConflictError, NotFoundError } from "@/lib/api-error";
import { getStripe } from "@/lib/stripe";
import * as orderRepository from "@/server/repositories/order.repository";

/**
 * La boleta se resuelve on-demand contra Stripe (009 D1): `receipt_url` cambia
 * ante un reembolso, así que cachearla en Postgres la desactualiza. La clave
 * secreta vive solo aquí; al cliente solo viaja la URL final.
 */
export async function getReceiptUrl(orderId: string, userId: string): Promise<string> {
  const order = await orderRepository.findByIdWithItems(orderId);

  // Una orden ajena es indistinguible de una inexistente: 404 en ambos casos,
  // nunca 403, para no filtrar que el pedido existe (009 AC9).
  if (!order || order.userId !== userId) {
    throw new NotFoundError("El pedido no existe.");
  }

  if (order.status !== "paid") {
    throw new ConflictError("La boleta está disponible solo para pedidos pagados.");
  }

  // Las órdenes pagadas antes de que el webhook de 008 corriera bien no tienen
  // PaymentIntent: 409 accionable, no un 500.
  if (!order.stripePaymentIntentId) {
    throw new ConflictError(
      "Este pedido no tiene un pago registrado en Stripe del que emitir boleta.",
    );
  }

  const paymentIntent = await getStripe().paymentIntents.retrieve(order.stripePaymentIntentId, {
    expand: ["latest_charge"],
  });

  const charge = paymentIntent.latest_charge;
  const receiptUrl = typeof charge === "string" ? null : (charge?.receipt_url ?? null);

  // Stripe genera la boleta al asentarse el cargo: puede faltar unos minutos
  // aunque la orden ya esté `paid`.
  if (!receiptUrl) {
    throw new ConflictError(
      "La boleta aún no está disponible. Volvé a intentarlo en unos minutos.",
    );
  }

  return receiptUrl;
}
