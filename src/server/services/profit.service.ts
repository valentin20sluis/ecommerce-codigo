import { monthToUtcRange } from "@/modules/finance/profit";
import { buildProfitStatement, type ProfitStatementDto } from "@/modules/finance/types/profit";
import { getTaxSummary } from "@/server/services/tax.service";

/**
 * Estado de resultados de un mes UTC (020 D1). Compone `getTaxSummary`, que ya
 * materializa los recurrentes vencidos y resuelve IGV, costo, egresos y renta.
 */
export async function getProfitStatement(month: string): Promise<ProfitStatementDto> {
  const { from, to } = monthToUtcRange(month);
  const summary = await getTaxSummary(from, to);

  return buildProfitStatement(month, summary);
}
