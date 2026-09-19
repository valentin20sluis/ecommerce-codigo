import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { metricsQuerySchema } from "@/modules/dashboard/schemas/metrics.schema";
import type { DashboardMetricsDto } from "@/modules/dashboard/types/metrics";
import { getDashboardMetrics } from "@/server/services/dashboard-metrics.service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.DASHBOARD_READ);

    const { range } = metricsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const metrics = await getDashboardMetrics(range);

    return NextResponse.json<DashboardMetricsDto>(metrics);
  } catch (error) {
    return toErrorResponse(error);
  }
}
