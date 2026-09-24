// Import relativo a propósito (no `@/modules/finance/utils`): `node --test`
// no resuelve imports de VALOR con alias `@/` (016, Task 2/3), y este
// archivo necesita cargar bajo el test runner nativo. Mismo precedente ya
// usado en `src/server/services/user-projection.ts`.
import { resolveMarginCoverage } from "../utils.ts";
import type { CategoryRevenueRow } from "@/server/repositories/order.repository";
import type { DailyRevenuePoint } from "@/modules/finance/utils";

export type CategoryRevenueDto = {
  categoryId: string;
  categoryName: string;
  revenueCents: number;
  /** `null` = ninguna línea de esta categoría tiene costo conocido (016 D4). */
  marginCents: number | null;
  units: number;
};

export type RevenueSummaryDto = {
  from: string;
  to: string;
  revenueCents: number;
  ordersCount: number;
  marginCents: number | null;
  marginCoveragePercent: number;
  dailyRevenue: DailyRevenuePoint[];
  byCategory: CategoryRevenueDto[];
};

export function toCategoryRevenueDto(row: CategoryRevenueRow): CategoryRevenueDto {
  const { marginCents } = resolveMarginCoverage(row.marginCentsKnown, row.revenueCentsKnown, row.revenueCents);

  return {
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    revenueCents: row.revenueCents,
    marginCents,
    units: row.units,
  };
}
