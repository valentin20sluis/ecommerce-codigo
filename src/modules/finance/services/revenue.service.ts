import { api } from "@/lib/axios";
import type { RevenueQuery } from "@/modules/finance/schemas/revenue.schema";
import type { RevenueSummaryDto } from "@/modules/finance/types/revenue";

export async function fetchRevenueSummary(query: RevenueQuery): Promise<RevenueSummaryDto> {
  const { data } = await api.get<RevenueSummaryDto>("/admin/finance/revenue", { params: query });
  return data;
}
