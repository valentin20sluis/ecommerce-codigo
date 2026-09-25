import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import type { Executor, ReadExecutor } from "@/server/db/pool";
import { financeSettings, type FinanceSettings } from "@/server/db/schema";

/** Id fijo de la única fila (`CHECK (id = 1)`, 018 D8). */
const SETTINGS_ID = 1;

export async function find(executor: ReadExecutor = db): Promise<FinanceSettings | null> {
  const [row] = await executor
    .select()
    .from(financeSettings)
    .where(eq(financeSettings.id, SETTINGS_ID))
    .limit(1);

  return row ?? null;
}

/** Lectura con `FOR UPDATE` para que el `before` auditado sea el que se sobrescribe. */
export async function findForUpdate(executor: Executor): Promise<FinanceSettings | null> {
  const [row] = await executor
    .select()
    .from(financeSettings)
    .where(eq(financeSettings.id, SETTINGS_ID))
    .limit(1)
    .for("update");

  return row ?? null;
}

export async function upsertIncomeTaxRate(
  executor: Executor,
  incomeTaxRateBps: number,
  updatedBy: string,
): Promise<FinanceSettings> {
  const values = { incomeTaxRateBps, updatedBy, updatedAt: new Date() };

  const [row] = await executor
    .insert(financeSettings)
    .values({ id: SETTINGS_ID, ...values })
    .onConflictDoUpdate({ target: financeSettings.id, set: values })
    .returning();

  return row;
}
