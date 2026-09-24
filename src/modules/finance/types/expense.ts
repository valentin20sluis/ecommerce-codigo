// Import relativo a propósito: `node --test` no resuelve valores vía alias `@/`.
import { nextDueOn } from "../recurring.ts";
import type { ExpenseCategoryValue } from "../schemas/expense.schema.ts";
import type { Expense, RecurringExpense } from "@/server/db/schema";
import type { Paginated } from "@/types/api";

export type ExpenseDto = {
  id: string;
  category: ExpenseCategoryValue;
  description: string;
  amountCents: number;
  /** `YYYY-MM-DD`. */
  incurredOn: string;
  /** No nulo = nació de una plantilla. */
  recurringExpenseId: string | null;
};

/** `totalCents` suma todo el filtro, no solo la página (017 AC6). */
export type ExpenseListResponse = Paginated<ExpenseDto> & { totalCents: number };

export type RecurringExpenseDto = {
  id: string;
  category: ExpenseCategoryValue;
  description: string;
  amountCents: number;
  dayOfMonth: number;
  startsOn: string;
  endsOn: string | null;
  isActive: boolean;
  nextDueOn: string | null;
};

export function toExpenseDto(row: Expense): ExpenseDto {
  return {
    id: row.id,
    category: row.category,
    description: row.description,
    amountCents: row.amountCents,
    incurredOn: row.incurredOn,
    recurringExpenseId: row.recurringExpenseId,
  };
}

export function toRecurringExpenseDto(row: RecurringExpense, today: string): RecurringExpenseDto {
  return {
    id: row.id,
    category: row.category,
    description: row.description,
    amountCents: row.amountCents,
    dayOfMonth: row.dayOfMonth,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    isActive: row.isActive,
    nextDueOn: nextDueOn(row, today),
  };
}
