import { z } from "zod";

/**
 * Duplicado a propósito, mismo criterio que `AUDIT_SEVERITIES` en
 * `audit-log.schema.ts`: este archivo vive en `modules/` y lo importa un
 * componente cliente, así que no puede depender de `server/db/schema`. La fuente
 * de verdad de la columna y del enum de Postgres sigue siendo `ORDER_STATUSES`
 * en `src/server/db/schema/order.ts`.
 */
export const ORDER_STATUS_VALUES = [
  "pending_payment",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "payment_failed",
  "canceled",
  "expired",
] as const;

export const adminOrdersQuerySchema = z.object({
  status: z.enum(ORDER_STATUS_VALUES).optional(),
  customer: z.string().max(120).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type AdminOrdersQuery = z.infer<typeof adminOrdersQuerySchema>;

/**
 * Zod solo comprueba pertenencia al enum (012 D3): que el estado pedido sea el
 * siguiente válido depende del estado actual en base de datos, así que esa regla
 * la valida el service y responde 409. `canceled` ya pertenecía al enum y desde
 * 014 (D6) es un destino real del PATCH: cancela y repone stock.
 */
export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUS_VALUES),
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
