// `import type` relativo con `.ts`: este archivo corre bajo `node --test` (018 D11).
import type { TaxSummaryDto } from "./taxes.ts";

export type ProfitStatementDto = {
  month: string;
  grossCents: number;
  salesBaseCents: number;
  costOfSalesCents: number;
  grossProfitCents: number;
  expensesCents: number;
  operatingProfitCents: number;
  incomeTaxRateBps: number;
  incomeTaxCents: number;
  netProfitCents: number;
  costCoveragePercent: number;
};

/**
 * Cascada del estado de resultados (020 D2). Solo agrega las dos utilidades
 * intermedias: la operativa y la renta salen tal cual de `getTaxSummary`, así
 * Ganancias e Impuestos nunca discrepan para el mismo mes (AC5).
 */
export function buildProfitStatement(month: string, summary: TaxSummaryDto): ProfitStatementDto {
  const grossProfitCents = summary.baseCents - summary.costKnownCents;

  return {
    month,
    grossCents: summary.grossCents,
    salesBaseCents: summary.baseCents,
    costOfSalesCents: summary.costKnownCents,
    grossProfitCents,
    expensesCents: summary.expensesCents,
    operatingProfitCents: summary.profitCents,
    incomeTaxRateBps: summary.incomeTaxRateBps,
    incomeTaxCents: summary.incomeTaxCents,
    netProfitCents: summary.profitCents - summary.incomeTaxCents,
    costCoveragePercent: summary.costCoveragePercent,
  };
}
