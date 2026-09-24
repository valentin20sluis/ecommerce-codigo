import { asc, desc, eq } from "drizzle-orm";

import { db } from "@/server/db";
import type { Executor, ReadExecutor } from "@/server/db/pool";
import {
  recurringExpenses,
  type NewRecurringExpense,
  type RecurringExpense,
} from "@/server/db/schema";

export type RecurringExpenseValues = Pick<
  NewRecurringExpense,
  | "category"
  | "description"
  | "amountCents"
  | "dayOfMonth"
  | "startsOn"
  | "endsOn"
  | "generatedThrough"
  | "createdBy"
>;

export type RecurringExpenseUpdateValues = Partial<
  Pick<
    NewRecurringExpense,
    | "category"
    | "description"
    | "amountCents"
    | "dayOfMonth"
    | "endsOn"
    | "isActive"
    | "generatedThrough"
  >
>;

export async function findById(
  id: string,
  executor: ReadExecutor = db,
): Promise<RecurringExpense | null> {
  const [row] = await executor
    .select()
    .from(recurringExpenses)
    .where(eq(recurringExpenses.id, id))
    .limit(1);

  return row ?? null;
}

/** Activas primero, luego por descripción. Son pocas: sin paginación. */
export async function listAll(executor: ReadExecutor = db): Promise<RecurringExpense[]> {
  return executor
    .select()
    .from(recurringExpenses)
    .orderBy(desc(recurringExpenses.isActive), asc(recurringExpenses.description));
}

export async function create(
  executor: Executor,
  values: RecurringExpenseValues,
): Promise<RecurringExpense> {
  const [row] = await executor.insert(recurringExpenses).values(values).returning();
  return row;
}

export async function update(
  executor: Executor,
  id: string,
  values: RecurringExpenseUpdateValues,
): Promise<RecurringExpense | null> {
  const [row] = await executor
    .update(recurringExpenses)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(recurringExpenses.id, id))
    .returning();

  return row ?? null;
}

export async function remove(executor: Executor, id: string): Promise<void> {
  await executor.delete(recurringExpenses).where(eq(recurringExpenses.id, id));
}

/**
 * Bloquea las plantillas activas dentro de la transacción de la generación
 * (017 D6). `SKIP LOCKED`: si otra petición ya las está generando, esta las
 * salta en vez de esperar — esa otra petición materializa sus vencimientos.
 */
export async function lockActive(executor: Executor): Promise<RecurringExpense[]> {
  return executor
    .select()
    .from(recurringExpenses)
    .where(eq(recurringExpenses.isActive, true))
    .for("update", { skipLocked: true });
}

export async function setGeneratedThrough(
  executor: Executor,
  id: string,
  generatedThrough: string,
): Promise<void> {
  await executor
    .update(recurringExpenses)
    .set({ generatedThrough, updatedAt: new Date() })
    .where(eq(recurringExpenses.id, id));
}
