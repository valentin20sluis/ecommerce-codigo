import type { Order, OrderItem } from "@/server/db/schema";
import type { Serialized } from "@/types/api";

/** Una compra del historial con su detalle: el Dialog no vuelve a la red (009 D2). */
export type OrderListItemDto = Serialized<Order> & { items: Serialized<OrderItem>[] };

export type OrderListMeta = {
  limit: number;
  /** El rango trajo tantas filas como el tope: la UI pide acotarlo (009 D4). */
  truncated: boolean;
};

export type OrderListResponse = {
  data: OrderListItemDto[];
  meta: OrderListMeta;
};

/** Respuesta de `GET /api/orders/[id]/receipt`: la boleta hosted de Stripe. */
export type OrderReceiptResponse = { url: string };

export function toOrderListItemDto(order: Order & { items: OrderItem[] }): OrderListItemDto {
  return {
    ...order,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: order.items,
  };
}
