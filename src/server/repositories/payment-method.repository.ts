import { and, desc, eq } from "drizzle-orm";

import { db } from "@/server/db";
import type { Executor, ReadExecutor } from "@/server/db/pool";
import { paymentMethods, type NewPaymentMethod, type PaymentMethod } from "@/server/db/schema";

export type PaymentMethodValues = Pick<
  NewPaymentMethod,
  "userId" | "stripePaymentMethodId" | "brand" | "last4" | "expMonth" | "expYear"
>;

/** Tarjetas del usuario, la más reciente primero (010 AC10). */
export async function listByUser(
  userId: string,
  executor: ReadExecutor = db,
): Promise<PaymentMethod[]> {
  return executor
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.userId, userId))
    .orderBy(desc(paymentMethods.createdAt));
}

/**
 * El `userId` viaja en el WHERE, no se compara después: una tarjeta ajena
 * devuelve `null` y el llamador la traduce a 404, nunca a 403 (AC12).
 */
export async function findByIdForUser(
  id: string,
  userId: string,
  executor: ReadExecutor = db,
): Promise<PaymentMethod | null> {
  const [row] = await executor
    .select()
    .from(paymentMethods)
    .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, userId)))
    .limit(1);

  return row ?? null;
}

/**
 * Idempotencia del webhook (D6): el conflicto sobre `stripe_payment_method_id`
 * no devuelve fila, así que una reentrega del mismo evento no duplica la tarjeta
 * ni vuelve a auditar.
 */
export async function insertIfAbsent(
  executor: Executor,
  values: PaymentMethodValues,
): Promise<PaymentMethod | null> {
  const [row] = await executor
    .insert(paymentMethods)
    .values(values)
    .onConflictDoNothing({ target: paymentMethods.stripePaymentMethodId })
    .returning();

  return row ?? null;
}

/** Borrado duro (D5): el historial de cobro vive en `orders`, no acá. */
export async function deleteById(executor: Executor, id: string): Promise<PaymentMethod | null> {
  const [row] = await executor
    .delete(paymentMethods)
    .where(eq(paymentMethods.id, id))
    .returning();

  return row ?? null;
}
