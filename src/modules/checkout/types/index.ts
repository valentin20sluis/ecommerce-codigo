import type { OrderItem, Order } from "@/server/db/schema";
import type { Serialized } from "@/types/api";

/** Respuesta de `POST /api/checkout/session`: solo la URL a la que redirigir. */
export type CheckoutSessionResponse = { url: string };

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

/** Orden con su detalle tal como cruza el límite servidor → cliente. */
export type OrderSummaryDto = Serialized<Order> & { items: OrderItemDto[] };

export function toOrderSummaryDto(order: Order & { items: OrderItem[] }): OrderSummaryDto {
  return {
    ...order,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: order.items.map(toOrderItemDto),
  };
}
