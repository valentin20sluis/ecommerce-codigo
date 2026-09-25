/** IGV (18 %) en basis points (018 D2): 10 000 bps = 100 %. */
export const IGV_RATE_BPS = 1800;

/** Renta del régimen general (29.5 %), usada mientras `finance_settings` no tenga fila (018 D8). */
export const DEFAULT_INCOME_TAX_RATE_BPS = 2950;

export const MAX_RATE_BPS = 10_000;

export type TaxBreakdown = {
  grossCents: number;
  baseCents: number;
  igvCents: number;
};

export type MonthlyTaxBreakdown = TaxBreakdown & { month: string };

/**
 * Descompone un precio final (IGV incluido) en base e IGV (018 D1/D2).
 * El IGV se obtiene por diferencia para que `base + igv = gross` sea exacto
 * pese al redondeo de la base.
 */
export function splitGross(grossCents: number): TaxBreakdown {
  const baseCents = Math.round((grossCents * MAX_RATE_BPS) / (MAX_RATE_BPS + IGV_RATE_BPS));

  return { grossCents, baseCents, igvCents: grossCents - baseCents };
}

function toMonthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

/**
 * Una fila por mes UTC entre `from` y `to` (inclusive), con ceros donde no hubo
 * ventas — mismo patrón que `fillMissingDaysInRange`. Cada mes se redondea por
 * separado (018 D3): el impuesto se declara por mes.
 */
export function fillMissingMonthsInRange(
  from: Date,
  to: Date,
  rows: { month: string; salesCents: number }[],
): MonthlyTaxBreakdown[] {
  const byMonth = new Map(rows.map((row) => [row.month, row.salesCents]));
  const startIndex = from.getUTCFullYear() * 12 + from.getUTCMonth();
  const endIndex = to.getUTCFullYear() * 12 + to.getUTCMonth();

  return Array.from({ length: Math.max(endIndex - startIndex + 1, 0) }, (_, offset) => {
    const index = startIndex + offset;
    const month = toMonthKey(Math.floor(index / 12), index % 12);
    return { month, ...splitGross(byMonth.get(month) ?? 0) };
  });
}

/** Totales del periodo como suma de los meses (018 D3): la tabla siempre cuadra con los KPIs. */
export function sumTaxBreakdowns(rows: TaxBreakdown[]): TaxBreakdown {
  return rows.reduce<TaxBreakdown>(
    (total, row) => ({
      grossCents: total.grossCents + row.grossCents,
      baseCents: total.baseCents + row.baseCents,
      igvCents: total.igvCents + row.igvCents,
    }),
    { grossCents: 0, baseCents: 0, igvCents: 0 },
  );
}

/** `round(max(0, utilidad) × tasa)` (018 D7): una pérdida no genera impuesto ni crédito. */
export function estimateIncomeTax(profitCents: number, rateBps: number): number {
  if (profitCents <= 0) return 0;
  return Math.round((profitCents * rateBps) / MAX_RATE_BPS);
}
