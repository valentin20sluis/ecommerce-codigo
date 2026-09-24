import { fillMissingDaysInRange, resolveMarginCoverage } from "@/modules/finance/utils";
import { toCategoryRevenueDto, type RevenueSummaryDto } from "@/modules/finance/types/revenue";
import * as orderRepository from "@/server/repositories/order.repository";

/**
 * Orquesta las 3 lecturas del reporte de Ingresos (016) en paralelo, sin N+1:
 * el total sale de `getSalesSummary` (013, órdenes) y la serie diaria de
 * `getDailySales` (013, sin cambios: ya acepta cualquier rango, no solo
 * 7/30/90). El margen global se deriva sumando las columnas "conocidas" de
 * cada categoría — no hace falta una cuarta consulta.
 */
export async function getRevenueSummary(from: Date, to: Date): Promise<RevenueSummaryDto> {
  const [summary, dailySales, byCategoryRows] = await Promise.all([
    orderRepository.getSalesSummary(from, to),
    orderRepository.getDailySales(from, to),
    orderRepository.getRevenueByCategory(from, to),
  ]);

  const revenueCentsKnown = byCategoryRows.reduce((total, row) => total + row.revenueCentsKnown, 0);
  const marginCentsKnown = byCategoryRows.reduce((total, row) => total + row.marginCentsKnown, 0);

  const { marginCents, marginCoveragePercent } = resolveMarginCoverage(
    marginCentsKnown,
    revenueCentsKnown,
    summary.salesCents,
  );

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    revenueCents: summary.salesCents,
    ordersCount: summary.ordersCount,
    marginCents,
    marginCoveragePercent,
    dailyRevenue: fillMissingDaysInRange(from, to, dailySales),
    byCategory: byCategoryRows.map(toCategoryRevenueDto),
  };
}
