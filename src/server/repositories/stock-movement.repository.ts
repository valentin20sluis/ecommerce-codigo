import { and, desc, eq, sql, type SQL } from "drizzle-orm";

import { db } from "@/server/db";
import type { Executor, ReadExecutor } from "@/server/db/pool";
import {
  stockMovements,
  users,
  type NewStockMovement,
  type StockMovement,
  type StockMovementType,
} from "@/server/db/schema";

export type StockMovementValues = Pick<
  NewStockMovement,
  | "productId"
  | "type"
  | "qtyDelta"
  | "stockAfter"
  | "reason"
  | "referenceType"
  | "referenceId"
  | "actorId"
>;

/** Fila del kardex: el email del actor llega resuelto por el join, no fila a fila. */
export type StockMovementRow = StockMovement & { actorEmail: string | null };

export type ListMovementsParams = {
  type?: StockMovementType;
  page: number;
  pageSize: number;
};

/** La tabla es append-only: solo `insert`, nunca `update` ni `delete`. */
export async function insert(
  executor: Executor,
  values: StockMovementValues,
): Promise<StockMovement> {
  const [row] = await executor.insert(stockMovements).values(values).returning();
  return row;
}

export async function listByProduct(
  productId: string,
  params: ListMovementsParams,
  executor: ReadExecutor = db,
): Promise<{ data: StockMovementRow[]; total: number }> {
  const conditions: SQL[] = [eq(stockMovements.productId, productId)];
  if (params.type) conditions.push(eq(stockMovements.type, params.type));

  const filter = and(...conditions);

  const [{ total }] = await executor
    .select({ total: sql<number>`count(*)::int` })
    .from(stockMovements)
    .where(filter);

  const rows = await executor
    .select({ movement: stockMovements, actorEmail: users.email })
    .from(stockMovements)
    .leftJoin(users, eq(users.id, stockMovements.actorId))
    .where(filter)
    .orderBy(desc(stockMovements.createdAt))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  return {
    data: rows.map((row) => ({ ...row.movement, actorEmail: row.actorEmail })),
    total,
  };
}

/** Conciliación del kardex (AC6): el total debe igualar `products.stock`. */
export async function sumQtyDelta(
  productId: string,
  executor: ReadExecutor = db,
): Promise<number> {
  const [row] = await executor
    .select({ total: sql<number>`coalesce(sum(${stockMovements.qtyDelta}), 0)::int` })
    .from(stockMovements)
    .where(eq(stockMovements.productId, productId));

  return row?.total ?? 0;
}

/**
 * Movimientos ya emitidos para una referencia (`'order'` + id). El servicio los
 * consulta antes de insertar para no chocar contra el índice único de
 * idempotencia: una reentrega del webhook o una segunda cancelación no repiten.
 */
export async function findByReference(
  executor: ReadExecutor,
  referenceType: string,
  referenceId: string,
  type: StockMovementType,
): Promise<StockMovement[]> {
  return executor
    .select()
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.referenceType, referenceType),
        eq(stockMovements.referenceId, referenceId),
        eq(stockMovements.type, type),
      ),
    );
}
