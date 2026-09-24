import { z } from "zod";

/**
 * Entrada de `GET /api/admin/finance/revenue`. Ambos campos son requeridos a
 * propósito (016 D3): un reporte financiero nunca corre con un rango
 * implícito. El cliente siempre resuelve el preset a fechas concretas antes
 * de pedir — el servidor no conoce el preset.
 */
export const revenueQuerySchema = z
  .object({
    from: z.iso.datetime(),
    to: z.iso.datetime(),
  })
  .superRefine((values, ctx) => {
    if (new Date(values.to) < new Date(values.from)) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: "El fin del rango no puede ser anterior al inicio.",
      });
    }
  });

export type RevenueQuery = z.infer<typeof revenueQuerySchema>;

/**
 * Duplicado a propósito de `REVENUE_RANGE_PRESETS` (`modules/finance/utils.ts`)
 * más `"custom"`: este archivo lo importa un componente cliente vía valor
 * (`revenueFiltersSchema` se ejecuta en el navegador), así que no puede
 * depender de un import cruzado de otro módulo bajo `node --test` — mismo
 * criterio que `STOCK_MOVEMENT_TYPE_VALUES` en `inventory.schema.ts`.
 */
export const REVENUE_FILTER_PRESETS = [
  "this_month",
  "last_month",
  "this_quarter",
  "this_year",
  "custom",
] as const;

export type RevenueFilterPreset = (typeof REVENUE_FILTER_PRESETS)[number];

/** Estado del filtro tal como viaja en la URL del cliente; nunca cruza a la API. */
export const revenueFiltersSchema = z.object({
  preset: z.enum(REVENUE_FILTER_PRESETS).default("this_month"),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});

export type RevenueFilters = z.infer<typeof revenueFiltersSchema>;
