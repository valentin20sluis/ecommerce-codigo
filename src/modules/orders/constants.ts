import type { OrderStatus } from "@/server/db/schema";

/** Tope del listado (009 D4). El rango de fechas es el limitador real. */
export const MAX_ORDERS = 50;

export type OrderStatusView = {
  label: string;
  variant: "default" | "secondary" | "destructive";
};

/**
 * Mismos textos y variantes que `checkout/success`: un pedido se nombra igual
 * en toda la tienda. `canceled` se declara para cubrir el enum, aunque el
 * listado nunca lo devuelve (D5). `expired` sí se lista y comparte la etiqueta
 * "Cancelado": el cliente no distingue ambos casos, el enum sí (011 D1).
 */
export const ORDER_STATUS_VIEW: Record<OrderStatus, OrderStatusView> = {
  paid: { label: "Pagado", variant: "default" },
  pending_payment: { label: "Pendiente", variant: "secondary" },
  payment_failed: { label: "Pago rechazado", variant: "destructive" },
  canceled: { label: "Cancelado", variant: "destructive" },
  expired: { label: "Cancelado", variant: "destructive" },
};
