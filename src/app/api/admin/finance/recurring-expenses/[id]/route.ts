import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { toUtcDateString } from "@/modules/finance/recurring";
import { updateRecurringExpenseSchema } from "@/modules/finance/schemas/expense.schema";
import {
  toRecurringExpenseDto,
  type RecurringExpenseDto,
} from "@/modules/finance/types/expense";
import {
  deleteRecurringExpense,
  updateRecurringExpense,
} from "@/server/services/recurring-expense.service";

type Context = { params: Promise<{ id: string }> };

async function resolveId(context: Context): Promise<string> {
  const { id } = await context.params;
  return z.uuid().parse(id);
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission(PERMISSIONS.FINANCE_MANAGE_EXPENSES);

    const id = await resolveId(context);
    const input = updateRecurringExpenseSchema.parse(await request.json());
    const template = await updateRecurringExpense(actor, id, input);

    return NextResponse.json<RecurringExpenseDto>(
      toRecurringExpenseDto(template, toUtcDateString(new Date())),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission(PERMISSIONS.FINANCE_MANAGE_EXPENSES);

    await deleteRecurringExpense(actor, await resolveId(context));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
