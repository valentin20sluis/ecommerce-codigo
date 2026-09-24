import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { updateExpenseSchema } from "@/modules/finance/schemas/expense.schema";
import { toExpenseDto, type ExpenseDto } from "@/modules/finance/types/expense";
import { deleteExpense, updateExpense } from "@/server/services/expense.service";

type Context = { params: Promise<{ id: string }> };

async function resolveId(context: Context): Promise<string> {
  const { id } = await context.params;
  return z.uuid().parse(id);
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission(PERMISSIONS.FINANCE_MANAGE_EXPENSES);

    const id = await resolveId(context);
    const input = updateExpenseSchema.parse(await request.json());

    return NextResponse.json<ExpenseDto>(toExpenseDto(await updateExpense(actor, id, input)));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission(PERMISSIONS.FINANCE_MANAGE_EXPENSES);

    await deleteExpense(actor, await resolveId(context));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
