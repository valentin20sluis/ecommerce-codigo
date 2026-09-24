import { resolveDateRangePreset } from "./utils.ts";

export type ExpenseRange = { from: string; to: string };

type RangeFilters = {
  preset: "this_month" | "last_month" | "this_quarter" | "this_year" | "custom";
  from?: string;
  to?: string;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Día calendario **local** de un instante: el calendario del selector devuelve fechas locales. */
export function toLocalDateString(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Traduce el filtro a las fechas `YYYY-MM-DD` que espera la API (`incurred_on`
 * es `date`). Los presets ya vienen construidos en UTC (`resolveDateRangePreset`,
 * 016 I1), así que se cortan por UTC; el rango libre trae instantes de un
 * calendario local, así que se lee su día **local** — cortar por UTC correría
 * el día para quien esté al este de UTC+0.
 */
export function resolveExpenseRange(
  filters: RangeFilters,
  now: Date = new Date(),
): ExpenseRange | null {
  if (filters.preset === "custom") {
    if (!filters.from || !filters.to) return null;
    return { from: toLocalDateString(filters.from), to: toLocalDateString(filters.to) };
  }

  const range = resolveDateRangePreset(filters.preset, now);
  return { from: range.from.slice(0, 10), to: range.to.slice(0, 10) };
}
