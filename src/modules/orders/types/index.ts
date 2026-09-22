import type { Order, OrderItem } from "@/server/db/schema";
import type { Serialized } from "@/types/api";

/**
 * Ítem tal como cruza al cliente: sin `costCentsSnapshot` (015). El costo es
 * confidencial — solo lo ve quien tiene `finance.read` en el panel admin — así
 * que este DTO elige los campos explícitamente en vez de esparcir `OrderItem`
 * completo, que se llevaría el costo a cualquier comprador autenticado.
 */
export type OrderItemDto = Pick<
  OrderItem,
  "id" | "orderId" | "productId" | "nameSnapshot" | "unitPriceCents" | "qty"
>;

function toOrderItemDto(item: OrderItem): OrderItemDto {
  return {
    id: item.id,
    orderId: item.orderId,
    productId: item.productId,
    nameSnapshot: item.nameSnapshot,
    unitPriceCents: item.unitPriceCents,
    qty: item.qty,
  };
}

/** Una compra del historial con su detalle: el Dialog no vuelve a la red (009 D2). */
export type OrderListItemDto = Serialized<Order> & { items: OrderItemDto[] };

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
    items: order.items.map(toOrderItemDto),
  };
}
