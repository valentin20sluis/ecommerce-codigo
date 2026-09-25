import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { accountingQuerySchema } from "@/modules/finance/schemas/accounting.schema";
import type { AccountingJournalDto } from "@/modules/finance/types/accounting";
import { getAccountingJournal } from "@/server/services/accounting.service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.FINANCE_READ);

    const query = accountingQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const journal = await getAccountingJournal(query);

    return NextResponse.json<AccountingJournalDto>(journal);
  } catch (error) {
    return toErrorResponse(error);
  }
}
