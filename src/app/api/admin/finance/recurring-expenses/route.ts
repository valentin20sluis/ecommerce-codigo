import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { toUtcDateString } from "@/modules/finance/recurring";
import { createRecurringExpenseSchema } from "@/modules/finance/schemas/expense.schema";
import {
  toRecurringExpenseDto,
  type RecurringExpenseDto,
} from "@/modules/finance/types/expense";
import {
  createRecurringExpense,
  listRecurringExpenses,
} from "@/server/services/recurring-expense.service";

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.FINANCE_READ);

    const today = toUtcDateString(new Date());
    const rows = await listRecurringExpenses();

    return NextResponse.json<{ data: RecurringExpenseDto[] }>({
      data: rows.map((row) => toRecurringExpenseDto(row, today)),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission(PERMISSIONS.FINANCE_MANAGE_EXPENSES);

    const input = createRecurringExpenseSchema.parse(await request.json());
    const template = await createRecurringExpense(actor, input);

    return NextResponse.json<RecurringExpenseDto>(
      toRecurringExpenseDto(template, toUtcDateString(new Date())),
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
