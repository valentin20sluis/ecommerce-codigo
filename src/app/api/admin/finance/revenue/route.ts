import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { revenueQuerySchema } from "@/modules/finance/schemas/revenue.schema";
import type { RevenueSummaryDto } from "@/modules/finance/types/revenue";
import { getRevenueSummary } from "@/server/services/revenue.service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.FINANCE_READ);

    const query = revenueQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const summary = await getRevenueSummary(new Date(query.from), new Date(query.to));

    return NextResponse.json<RevenueSummaryDto>(summary);
  } catch (error) {
    return toErrorResponse(error);
  }
}
