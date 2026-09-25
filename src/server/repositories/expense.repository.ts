import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";

import { db } from "@/server/db";
import type { Executor, ReadExecutor } from "@/server/db/pool";
import { expenses, type Expense, type ExpenseCategory, type NewExpense } from "@/server/db/schema";

export type ExpenseValues = Pick<
  NewExpense,
  "category" | "description" | "amountCents" | "incurredOn" | "createdBy"
>;

export type ExpenseUpdateValues = Partial<
  Pick<NewExpense, "category" | "description" | "amountCents" | "incurredOn">
>;

export async function findById(id: string, executor: ReadExecutor = db): Promise<Expense | null> {
  const [row] = await executor.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  return row ?? null;
}

export async function create(executor: Executor, values: ExpenseValues): Promise<Expense> {
  const [row] = await executor.insert(expenses).values(values).returning();
  return row;
}

export async function update(
  executor: Executor,
  id: string,
  values: ExpenseUpdateValues,
): Promise<Expense | null> {
  const [row] = await executor
    .update(expenses)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(expenses.id, id))
    .returning();

  return row ?? null;
}

export async function remove(executor: Executor, id: string): Promise<void> {
  await executor.delete(expenses).where(eq(expenses.id, id));
}

export type ListExpensesParams = {
  /** `YYYY-MM-DD`, inclusive. */
  from: string;
  to: string;
  category?: ExpenseCategory;
  page: number;
  pageSize: number;
};

/**
 * Listado del filtro completo más su total (017 AC6). `totalCents` va como
 * `float8` y no `int`: la suma de muchos egresos puede pasar el rango de 32 bits
 * (mismo hallazgo M1 de la revisión de 016) y `float8` es exacto hasta 2^53.
 */
export async function listPaginated(
  params: ListExpensesParams,
  executor: ReadExecutor = db,
): Promise<{ data: Expense[]; total: number; totalCents: number }> {
  const conditions: SQL[] = [
    gte(expenses.incurredOn, params.from),
    lte(expenses.incurredOn, params.to),
  ];
  if (params.category) conditions.push(eq(expenses.category, params.category));

  const filter = and(...conditions);

  const [totals] = await executor
    .select({
      total: sql<number>`count(*)::int`,
      totalCents: sql<number>`coalesce(sum(${expenses.amountCents}), 0)::float8`,
    })
    .from(expenses)
    .where(filter);

  const data = await executor
    .select()
    .from(expenses)
    .where(filter)
    .orderBy(desc(expenses.incurredOn), desc(expenses.createdAt))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  return { data, total: totals?.total ?? 0, totalCents: totals?.totalCents ?? 0 };
}

/** Total de egresos entre dos días (`YYYY-MM-DD`, inclusive), en `float8` por la misma razón que `listPaginated`. */
export async function sumAmountBetween(
  from: string,
  to: string,
  executor: ReadExecutor = db,
): Promise<number> {
  const [row] = await executor
    .select({ totalCents: sql<number>`coalesce(sum(${expenses.amountCents}), 0)::float8` })
    .from(expenses)
    .where(and(gte(expenses.incurredOn, from), lte(expenses.incurredOn, to)));

  return row?.totalCents ?? 0;
}

/**
 * Inserta los vencimientos de una plantilla ignorando los que ya existan: el
 * índice único parcial `(recurring_expense_id, incurred_on)` es el candado
 * contra dos ejecuciones concurrentes (017 D6). Devuelve cuántas filas entraron.
 */
export async function insertManyIgnoringConflicts(
  executor: Executor,
  rows: NewExpense[],
): Promise<number> {
  if (rows.length === 0) return 0;

  const inserted = await executor
    .insert(expenses)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: expenses.id });

  return inserted.length;
}
