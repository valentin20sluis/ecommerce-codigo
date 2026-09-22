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
  processing: { label: "En preparación", variant: "secondary" },
  shipped: { label: "Enviado", variant: "secondary" },
  delivered: { label: "Entregado", variant: "default" },
  pending_payment: { label: "Pendiente", variant: "secondary" },
  payment_failed: { label: "Pago rechazado", variant: "destructive" },
  canceled: { label: "Cancelado", variant: "destructive" },
  expired: { label: "Cancelado", variant: "destructive" },
};

/**
 * Única fuente de la transición de fulfillment (012 D2): la consume el service
 * para validar el `PATCH` y la tabla del admin para ofrecer el único paso
 * posible. Un estado ausente del mapa no admite avance —terminal (`delivered`)
 * o fuera del flujo (`pending_payment`, `payment_failed`, `canceled`,
 * `expired`)—, así que no hay retroceso ni salto de estados.
 */
export const ORDER_FULFILLMENT_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  paid: "processing",
  processing: "shipped",
  shipped: "delivered",
};

/**
 * Estados desde los que un admin puede cancelar un pedido ya cobrado (014 D6).
 * `delivered` queda fuera —ya está en manos del cliente— y los que nunca
 * descontaron stock (`pending_payment`, `payment_failed`, `expired`) tampoco
 * entran: cancelar repone stock, así que solo aplica a lo que sí lo descontó.
 */
export const CANCELABLE_STATUSES: readonly OrderStatus[] = ["paid", "processing", "shipped"];

/**
 * Cobro confirmado: la orden ya es una venta y todo el fulfillment (012) la
 * conserva. Única definición de "venta" del proyecto (013 D1): la consumen el
 * ícono de éxito de `checkout/success` y las agregaciones del dashboard.
 */
export const SETTLED_STATUSES: readonly OrderStatus[] = [
  "paid",
  "processing",
  "shipped",
  "delivered",
];
