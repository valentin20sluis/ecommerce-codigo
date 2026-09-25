import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { revenueQuerySchema } from "@/modules/finance/schemas/revenue.schema";
import type { TaxSummaryDto } from "@/modules/finance/types/taxes";
import { getTaxSummary } from "@/server/services/tax.service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.FINANCE_READ);

    const query = revenueQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const summary = await getTaxSummary(new Date(query.from), new Date(query.to));

    return NextResponse.json<TaxSummaryDto>(summary);
  } catch (error) {
    return toErrorResponse(error);
  }
}
