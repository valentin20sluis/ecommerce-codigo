import { and, desc, eq, gte, inArray, lte, ne, type SQL } from "drizzle-orm";

import { db } from "@/server/db";
import type { Executor, ReadExecutor } from "@/server/db/pool";
import {
  orderItems,
  orders,
  type NewOrder,
  type NewOrderItem,
  type Order,
  type OrderItem,
} from "@/server/db/schema";

export type OrderValues = Pick<
  NewOrder,
  "userId" | "subtotalCents" | "totalCents" | "currency"
>;

export type OrderItemValues = Pick<
  NewOrderItem,
  "productId" | "nameSnapshot" | "unitPriceCents" | "qty"
>;

export type OrderWithItems = Order & { items: OrderItem[] };

async function loadItems(orderId: string, executor: ReadExecutor): Promise<OrderItem[]> {
  return executor.select().from(orderItems).where(eq(orderItems.orderId, orderId));
}

async function withItems(
  order: Order | undefined,
  executor: ReadExecutor,
): Promise<OrderWithItems | null> {
  if (!order) return null;
  return { ...order, items: await loadItems(order.id, executor) };
}

/**
 * Cabecera + detalle en una sola transacción: una orden sin líneas no tiene
 * sentido de negocio. `status` queda en su default `pending_payment` (D3).
 */
export async function createWithItems(
  executor: Executor,
  values: OrderValues,
  items: OrderItemValues[],
): Promise<OrderWithItems> {
  const [order] = await executor.insert(orders).values(values).returning();

  const insertedItems = await executor
    .insert(orderItems)
    .values(items.map((item) => ({ ...item, orderId: order.id })))
    .returning();

  return { ...order, items: insertedItems };
}

export async function findByIdWithItems(
  id: string,
  executor: ReadExecutor = db,
): Promise<OrderWithItems | null> {
  const [order] = await executor.select().from(orders).where(eq(orders.id, id)).limit(1);
  return withItems(order, executor);
}

export type ListOrdersByUserParams = {
  /** ISO absoluto calculado por el navegador; el servidor no reinterpreta la zona horaria. */
  from?: string;
  to?: string;
  limit: number;
};

/**
 * Historial del cliente (009). El `userId` llega siempre de la sesión, nunca de
 * la query. Las líneas se traen con un solo `inArray` sobre las órdenes ya
 * filtradas: una consulta por página, no una por fila.
 */
export async function listByUser(
  userId: string,
  params: ListOrdersByUserParams,
  executor: ReadExecutor = db,
): Promise<OrderWithItems[]> {
  const conditions: SQL[] = [
    eq(orders.userId, userId),
    // `canceled` solo marca órdenes que Stripe rechazó al crear la sesión (009 D5).
    ne(orders.status, "canceled"),
  ];

  if (params.from) conditions.push(gte(orders.createdAt, new Date(params.from)));
  if (params.to) conditions.push(lte(orders.createdAt, new Date(params.to)));

  const rows = await executor
    .select()
    .from(orders)
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt))
    .limit(params.limit);

  if (rows.length === 0) return [];

  const lines = await executor
    .select()
    .from(orderItems)
    .where(
      inArray(
        orderItems.orderId,
        rows.map((order) => order.id),
      ),
    );

  const byOrderId = new Map<string, OrderItem[]>();

  for (const line of lines) {
    const group = byOrderId.get(line.orderId);
    if (group) group.push(line);
    else byOrderId.set(line.orderId, [line]);
  }

  return rows.map((order) => ({ ...order, items: byOrderId.get(order.id) ?? [] }));
}

/** Entrada del webhook: `stripe_checkout_session_id` es único, así que devuelve 0 o 1 fila. */
export async function findByStripeSessionId(
  sessionId: string,
  executor: ReadExecutor = db,
): Promise<OrderWithItems | null> {
  const [order] = await executor
    .select()
    .from(orders)
    .where(eq(orders.stripeCheckoutSessionId, sessionId))
    .limit(1);

  return withItems(order, executor);
}

export async function attachStripeSession(
  executor: Executor,
  orderId: string,
  stripeCheckoutSessionId: string,
): Promise<Order | null> {
  const [order] = await executor
    .update(orders)
    .set({ stripeCheckoutSessionId, updatedAt: new Date() })
    .where(eq(orders.id, orderId))
    .returning();

  return order ?? null;
}

/**
 * Idempotencia atómica del webhook: el `status <> 'paid'` viaja en el propio
 * UPDATE, así que una reentrega del mismo evento no devuelve fila y el llamador
 * corta sin volver a descontar stock.
 */
export async function markPaid(
  executor: Executor,
  orderId: string,
  stripePaymentIntentId: string | null,
): Promise<Order | null> {
  const [order] = await executor
    .update(orders)
    .set({ status: "paid", stripePaymentIntentId, updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), ne(orders.status, "paid")))
    .returning();

  return order ?? null;
}

/**
 * Un evento de fallo solo aplica sobre una orden aún pendiente: acotar el guard
 * al estado de origen deja fuera tanto `paid` como un `payment_failed` previo, y
 * así una reentrega del mismo evento no devuelve fila ni reescribe la auditoría.
 */
export async function markFailed(executor: Executor, orderId: string): Promise<Order | null> {
  const [order] = await executor
    .update(orders)
    .set({ status: "payment_failed", updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending_payment")))
    .returning();

  return order ?? null;
}

/** Compensación de D5: solo aplica a la orden recién creada que Stripe rechazó. */
export async function markCanceled(executor: Executor, orderId: string): Promise<Order | null> {
  const [order] = await executor
    .update(orders)
    .set({ status: "canceled", updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending_payment")))
    .returning();

  return order ?? null;
}
