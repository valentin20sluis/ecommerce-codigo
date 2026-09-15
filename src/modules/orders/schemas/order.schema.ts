import { z } from "zod";

/**
 * Entrada de `GET /api/orders`. **No tiene `userId` a propósito**: el dueño de
 * las órdenes sale de `requireAuth()`, así que un `userId` inyectado en la query
 * ni siquiera llega al repositorio (009 AC2).
 */
export const ordersQuerySchema = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type OrdersQuery = z.infer<typeof ordersQuerySchema>;

export const ORDER_FILTER_PERIODS = ["month", "custom"] as const;

/** Estado del filtro tal como viaja en la URL del cliente; nunca cruza a la API. */
export const orderFiltersSchema = z.object({
  period: z.enum(ORDER_FILTER_PERIODS).default("month"),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});

export type OrderFilters = z.infer<typeof orderFiltersSchema>;
export type OrderFilterPeriod = OrderFilters["period"];
