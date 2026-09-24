import { z } from "zod";

/**
 * Tope de cordura (revisión final 016, I3): sin él, un rango tipo
 * `from=0001-01-01&to=9999-12-31` pasa la validación de formato y hace que
 * `fillMissingDaysInRange` intente asignar millones de puntos — cualquier
 * usuario con `finance.read` (no solo admins: también `manager`/`audit`)
 * puede mandarlo a mano por la URL del rango libre. 5 años es generoso para
 * un reporte financiero.
 */
const MAX_RANGE_DAYS = 1826;

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
    const from = new Date(values.from);
    const to = new Date(values.to);

    if (to < from) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: "El fin del rango no puede ser anterior al inicio.",
      });
      return;
    }

    const spanDays = (to.getTime() - from.getTime()) / 86_400_000;
    if (spanDays > MAX_RANGE_DAYS) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: `El rango no puede superar ${MAX_RANGE_DAYS} días.`,
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
