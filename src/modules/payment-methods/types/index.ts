import type { PaymentMethod } from "@/server/db/schema";
import type { Serialized } from "@/types/api";

/**
 * Lo que la tarjeta muestra en el cliente. Se omiten `userId` — ya está implícito
 * en la sesión — y `stripePaymentMethodId`: el borrado viaja con el uuid local,
 * así que el identificador de Stripe no tiene por qué salir del servidor.
 */
export type PaymentMethodDto = Serialized<
  Omit<PaymentMethod, "userId" | "stripePaymentMethodId">
>;

export type PaymentMethodListResponse = { data: PaymentMethodDto[] };

/** Respuesta de `POST /api/payment-methods/setup-session`: solo la URL hosted. */
export type SetupSessionResponse = { url: string };

export type DeletePaymentMethodResponse = { success: true };

export function toPaymentMethodDto(card: PaymentMethod): PaymentMethodDto {
  return {
    id: card.id,
    brand: card.brand,
    last4: card.last4,
    expMonth: card.expMonth,
    expYear: card.expYear,
    createdAt: card.createdAt.toISOString(),
  };
}
