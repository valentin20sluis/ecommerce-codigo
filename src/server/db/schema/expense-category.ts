import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Categorías fijas de egreso (017 D2). Agregar una es un cambio de código más
 * una migración aditiva (`ALTER TYPE … ADD VALUE`). La lista se duplica a
 * propósito en `modules/finance/schemas/expense.schema.ts` (lo importan
 * componentes cliente); `expense.service.ts` fija la sincronía en compilación.
 */
export const EXPENSE_CATEGORIES = [
  "advertising",
  "payroll",
  "rent",
  "software",
  "shipping",
  "payment_fees",
  "taxes_fees",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const expenseCategory = pgEnum("expense_category", EXPENSE_CATEGORIES);
