import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { profitQuerySchema } from "@/modules/finance/schemas/profit.schema";
import type { ProfitStatementDto } from "@/modules/finance/types/profit";
import { getProfitStatement } from "@/server/services/profit.service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.FINANCE_READ);

    const query = profitQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const statement = await getProfitStatement(query.month);

    return NextResponse.json<ProfitStatementDto>(statement);
  } catch (error) {
    return toErrorResponse(error);
  }
}
