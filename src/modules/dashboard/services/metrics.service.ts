import { api } from "@/lib/axios";
import type { MetricsQuery } from "@/modules/dashboard/schemas/metrics.schema";
import type { DashboardMetricsDto } from "@/modules/dashboard/types/metrics";

export async function fetchDashboardMetrics(query: MetricsQuery): Promise<DashboardMetricsDto> {
  const { data } = await api.get<DashboardMetricsDto>("/admin/metrics", { params: query });
  return data;
}
