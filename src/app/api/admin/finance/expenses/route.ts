import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { createExpenseSchema, expensesQuerySchema } from "@/modules/finance/schemas/expense.schema";
import {
  toExpenseDto,
  type ExpenseDto,
  type ExpenseListResponse,
} from "@/modules/finance/types/expense";
import { createExpense, listExpenses } from "@/server/services/expense.service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.FINANCE_READ);

    const query = expensesQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const { data, total, totalCents } = await listExpenses(query);

    return NextResponse.json<ExpenseListResponse>({
      data: data.map(toExpenseDto),
      meta: { page: query.page, pageSize: query.pageSize, total },
      totalCents,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission(PERMISSIONS.FINANCE_MANAGE_EXPENSES);

    const input = createExpenseSchema.parse(await request.json());
    const expense = await createExpense(actor, input);

    return NextResponse.json<ExpenseDto>(toExpenseDto(expense), { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
