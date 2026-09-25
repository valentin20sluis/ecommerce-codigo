// Imports relativos con `.ts` a propósito: este archivo corre bajo `node --test`,
// que no resuelve imports de valor con alias `@/` (018 D11, mismo criterio que `revenue.ts`).
import {
  estimateIncomeTax,
  fillMissingMonthsInRange,
  sumTaxBreakdowns,
  type MonthlyTaxBreakdown,
  type TaxBreakdown,
} from "../taxes.ts";
import { resolveMarginCoverage } from "../utils.ts";

export type TaxSummaryDto = TaxBreakdown & {
  from: string;
  to: string;
  months: MonthlyTaxBreakdown[];
  costKnownCents: number;
  costCoveragePercent: number;
  expensesCents: number;
  profitCents: number;
  incomeTaxRateBps: number;
  incomeTaxCents: number;
};

export type TaxSummaryInput = {
  from: Date;
  to: Date;
  /** Ventas cobradas por mes UTC (`YYYY-MM`); solo los meses con ventas. */
  monthlySales: { month: string; salesCents: number }[];
  /** Ingresos de las líneas con costo congelado y su margen (016 D2). */
  revenueCentsKnown: number;
  marginCentsKnown: number;
  expensesCents: number;
  incomeTaxRateBps: number;
};

/**
 * Arma el resumen de Impuestos (018 D3/D5/D7): los totales son la suma de los
 * meses y la utilidad parte de la base imponible, no del bruto — el IGV no es
 * ingreso del negocio.
 */
export function buildTaxSummary(input: TaxSummaryInput): TaxSummaryDto {
  const months = fillMissingMonthsInRange(input.from, input.to, input.monthlySales);
  const totals = sumTaxBreakdowns(months);

  const costKnownCents = input.revenueCentsKnown - input.marginCentsKnown;
  const { marginCoveragePercent } = resolveMarginCoverage(
    input.marginCentsKnown,
    input.revenueCentsKnown,
    totals.grossCents,
  );

  const profitCents = totals.baseCents - costKnownCents - input.expensesCents;

  return {
    from: input.from.toISOString(),
    to: input.to.toISOString(),
    ...totals,
    months,
    costKnownCents,
    costCoveragePercent: marginCoveragePercent,
    expensesCents: input.expensesCents,
    profitCents,
    incomeTaxRateBps: input.incomeTaxRateBps,
    incomeTaxCents: estimateIncomeTax(profitCents, input.incomeTaxRateBps),
  };
}
