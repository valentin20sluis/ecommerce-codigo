import type { OrderItem, Order } from "@/server/db/schema";
import type { Serialized } from "@/types/api";

/** Respuesta de `POST /api/checkout/session`: solo la URL a la que redirigir. */
export type CheckoutSessionResponse = { url: string };

/** Orden con su detalle tal como cruza el límite servidor → cliente. */
export type OrderSummaryDto = Serialized<Order> & { items: Serialized<OrderItem>[] };

export function toOrderSummaryDto(order: Order & { items: OrderItem[] }): OrderSummaryDto {
  return {
    ...order,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: order.items,
  };
}
