export type Margin = { marginCents: number | null; marginPercent: number | null };

/**
 * Margen de catálogo (015 D5): si no hay costo cargado, ninguno de los dos
 * valores se calcula — un `costCents: null` no es un costo de `0`, así que no
 * se puede confundir un margen del 100% con la ausencia total del dato.
 * `marginPercent` se redondea a un decimal para la tabla del panel.
 *
 * Vive en `src/modules/finance/` y no en `src/server/services/` (revisión 015
 * I2): es una función pura sin I/O, pero `modules/finance/types/finance.ts`
 * la necesita y ese archivo es alcanzable por componentes cliente — SETUP.md
 * §3 es tajante: `server/` es solo servidor, nunca se importa desde el
 * cliente, sin excepción por pureza. Mismo criterio que `orders/utils.ts`.
 */
export function computeMargin(priceCents: number, costCents: number | null): Margin {
  if (costCents === null) return { marginCents: null, marginPercent: null };

  const marginCents = priceCents - costCents;
  const marginPercent = priceCents === 0 ? 0 : Math.round((marginCents / priceCents) * 1000) / 10;

  return { marginCents, marginPercent };
}

export type MarginCoverage = { marginCents: number | null; marginCoveragePercent: number };

/**
 * Margen y cobertura del reporte de Ingresos (016 D2), a partir de dos sumas
 * agregadas: cuánto ingreso vino de líneas con costo conocido
 * (`revenueCentsKnown`) y cuánto margen dejaron esas líneas
 * (`marginCentsKnown`). Sin cobertura, `marginCents` es `null` — un margen de
 * `0` sería indistinguible de "no sé", mismo criterio que `computeMargin`.
 */
export function resolveMarginCoverage(
  marginCentsKnown: number,
  revenueCentsKnown: number,
  totalRevenueCents: number,
): MarginCoverage {
  if (revenueCentsKnown === 0) return { marginCents: null, marginCoveragePercent: 0 };

  const marginCoveragePercent =
    totalRevenueCents === 0 ? 0 : Math.round((revenueCentsKnown / totalRevenueCents) * 1000) / 10;

  return { marginCents: marginCentsKnown, marginCoveragePercent };
}

export type DailyRevenuePoint = { date: string; revenueCents: number };

/** `YYYY-MM-DD` en UTC, misma clave que `getDailySales` (013 D3). */
function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Zero-fill para un rango libre (016 D5): variante de `fillMissingDays` del
 * dashboard (013), que solo aceptaba 7/30/90 días fijos. Aquí el número de
 * días sale de `from`/`to`, calculado en UTC para no correrse un día.
 */
export function fillMissingDaysInRange(
  from: Date,
  to: Date,
  rows: { date: string; salesCents: number }[],
): DailyRevenuePoint[] {
  const byDate = new Map(rows.map((row) => [row.date, row.salesCents]));
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  const dayCount = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;

  return Array.from({ length: Math.max(dayCount, 0) }, (_, offset) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + offset);

    const date = toDayKey(day);
    return { date, revenueCents: byDate.get(date) ?? 0 };
  });
}

export const REVENUE_RANGE_PRESETS = ["this_month", "last_month", "this_quarter", "this_year"] as const;

export type RevenueRangePreset = (typeof REVENUE_RANGE_PRESETS)[number];

/**
 * Traduce un preset de negocio a fechas concretas en hora **local** (016 D3),
 * mismo criterio que `currentMonthRange()` en `orders/hooks/use-my-orders.ts`.
 * Los presets "en curso" (`this_month`/`this_quarter`/`this_year`) llegan
 * hasta `now`; `last_month` es un período cerrado completo. `now` es
 * inyectable para pruebas deterministas, mismo patrón que `isExpired` en
 * `payment-methods/constants.ts`.
 */
export function resolveDateRangePreset(
  preset: RevenueRangePreset,
  now: Date = new Date(),
): { from: string; to: string } {
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (preset) {
    case "this_month":
      return { from: new Date(year, month, 1).toISOString(), to: now.toISOString() };
    case "last_month":
      return {
        from: new Date(year, month - 1, 1).toISOString(),
        to: new Date(year, month, 1).toISOString(),
      };
    case "this_quarter": {
      const quarterStartMonth = Math.floor(month / 3) * 3;
      return { from: new Date(year, quarterStartMonth, 1).toISOString(), to: now.toISOString() };
    }
    case "this_year":
      return { from: new Date(year, 0, 1).toISOString(), to: now.toISOString() };
  }
}
