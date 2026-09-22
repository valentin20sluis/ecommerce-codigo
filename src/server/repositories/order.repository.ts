import { and, desc, eq, gte, ilike, inArray, isNotNull, lte, ne, or, sql, type SQL } from "drizzle-orm";

import { SETTLED_STATUSES } from "@/modules/orders/constants";
import { db } from "@/server/db";
import type { Executor, ReadExecutor } from "@/server/db/pool";
import {
  orderItems,
  orders,
  users,
  type NewOrder,
  type NewOrderItem,
  type Order,
  type OrderItem,
  type OrderStatus,
  type User,
} from "@/server/db/schema";

export type OrderValues = Pick<
  NewOrder,
  "userId" | "subtotalCents" | "totalCents" | "currency"
>;

export type OrderItemValues = Pick<
  NewOrderItem,
  "productId" | "nameSnapshot" | "unitPriceCents" | "costCentsSnapshot" | "qty"
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
 * Estados desde los que un cobro confirmado puede marcar la orden como pagada:
 * la compra recién creada y la de pago diferido que antes falló y luego sí entró
 * (`async_payment_failed` → `async_payment_succeeded`). Todo lo demás queda
 * fuera, incluido `canceled`: con el kardex de 014, una reentrega tardía de
 * `checkout.session.completed` lo resucitaría con su `return` ya escrito.
 */
const PAYABLE_STATUSES: OrderStatus[] = ["pending_payment", "payment_failed"];

/**
 * Idempotencia atómica del webhook: el estado de origen viaja en el propio
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
    .where(and(eq(orders.id, orderId), inArray(orders.status, PAYABLE_STATUSES)))
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

/**
 * `checkout.session.expired`: mismo guard que `markFailed`, acotado al estado de
 * origen. Una reentrega del evento —o el backfill corriendo dos veces— no
 * devuelve fila, así que el llamador corta sin auditar de nuevo (011 AC2/AC3).
 */
export async function markExpired(executor: Executor, orderId: string): Promise<Order | null> {
  const [order] = await executor
    .update(orders)
    .set({ status: "expired", updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending_payment")))
    .returning();

  return order ?? null;
}

/**
 * Candidatas del backfill de sesiones expiradas: pendientes que sí llegaron a
 * tener sesión en Stripe. Las de `stripe_checkout_session_id IS NULL` quedan
 * fuera del alcance (011) porque no hay nada que consultarle a Stripe.
 */
export async function listPendingWithSession(
  limit: number,
  executor: ReadExecutor = db,
): Promise<Order[]> {
  return executor
    .select()
    .from(orders)
    .where(and(eq(orders.status, "pending_payment"), isNotNull(orders.stripeCheckoutSessionId)))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}

export type AdminOrderCustomer = Pick<User, "id" | "email" | "firstName" | "lastName">;

export type AdminOrderRow = Order & { customer: AdminOrderCustomer };

export type ListAdminOrdersParams = {
  status?: OrderStatus;
  /** Texto libre: busca en email, nombre y apellido del comprador (012 D5). */
  customer?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
};

/**
 * Listado del panel (012). `innerJoin` y no `leftJoin`: `orders.user_id` es NOT
 * NULL con FK `restrict`, así que el comprador siempre existe y el tipo no
 * arrastra un `null` imposible. Una consulta por página más el `count(*)`, sin
 * traer `order_items`: el listado no los muestra.
 */
export async function listPaginated(
  params: ListAdminOrdersParams,
  executor: ReadExecutor = db,
): Promise<{ data: AdminOrderRow[]; total: number }> {
  const conditions: SQL[] = [];

  if (params.status) conditions.push(eq(orders.status, params.status));

  const term = params.customer?.trim();
  if (term) {
    const pattern = `%${term}%`;
    const match = or(
      ilike(users.email, pattern),
      ilike(users.firstName, pattern),
      ilike(users.lastName, pattern),
    );
    if (match) conditions.push(match);
  }

  if (params.from) conditions.push(gte(orders.createdAt, new Date(params.from)));
  if (params.to) conditions.push(lte(orders.createdAt, new Date(params.to)));

  const filter = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await executor
    .select({ total: sql<number>`count(*)::int` })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .where(filter);

  const rows = await executor
    .select({
      order: orders,
      customer: {
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      },
    })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .where(filter)
    .orderBy(desc(orders.createdAt))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  return {
    data: rows.map((row) => ({ ...row.order, customer: row.customer })),
    total,
  };
}

/**
 * Avance de fulfillment (012 D4): el estado de origen viaja en el `WHERE`, así
 * que de dos admins pulsando a la vez solo el primero obtiene fila. El segundo
 * recibe `null` y el service lo convierte en 409 sin auditar dos veces.
 */
export async function updateStatus(
  executor: Executor,
  orderId: string,
  from: OrderStatus,
  to: OrderStatus,
): Promise<Order | null> {
  const [order] = await executor
    .update(orders)
    .set({ status: to, updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.status, from)))
    .returning();

  return order ?? null;
}

/**
 * Ventana de las métricas (013 D1/D2): solo órdenes cobradas, `created_at` entre
 * `from` y `to`. Una sola definición del filtro para las tres agregaciones.
 */
function settledInRange(from: Date, to: Date): SQL {
  return and(
    inArray(orders.status, [...SETTLED_STATUSES]),
    gte(orders.createdAt, from),
    lte(orders.createdAt, to),
  )!;
}

export type SalesSummary = { salesCents: number; ordersCount: number };

/** KPI de ventas y pedidos en un solo escaneo: dos agregados sobre el mismo filtro. */
export async function getSalesSummary(
  from: Date,
  to: Date,
  executor: ReadExecutor = db,
): Promise<SalesSummary> {
  const [row] = await executor
    .select({
      salesCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
      ordersCount: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(settledInRange(from, to));

  return { salesCents: row?.salesCents ?? 0, ordersCount: row?.ordersCount ?? 0 };
}

export type DailySalesPoint = { date: string; salesCents: number };

/**
 * Serie diaria (013 D3): el día se define en UTC con `at time zone 'utc'`, la
 * misma zona que usa el service para armar la ventana y rellenar los ceros. Solo
 * devuelve los días con ventas; el zero-fill es del service (D4).
 */
export async function getDailySales(
  from: Date,
  to: Date,
  executor: ReadExecutor = db,
): Promise<DailySalesPoint[]> {
  const day = sql<string>`to_char(date_trunc('day', ${orders.createdAt} at time zone 'utc'), 'YYYY-MM-DD')`;

  return executor
    .select({ date: day, salesCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int` })
    .from(orders)
    .where(settledInRange(from, to))
    .groupBy(day)
    .orderBy(day);
}

export type TopProductRow = { productId: string; name: string; units: number };

/**
 * Top por unidades (013 D11): agrupa por `product_id` y etiqueta con el
 * `name_snapshot` del pedido más reciente, así que el nombre mostrado es el del
 * pedido y no requiere leer `products` (una sola consulta, sin N+1).
 */
export async function getTopProducts(
  from: Date,
  to: Date,
  limit: number,
  executor: ReadExecutor = db,
): Promise<TopProductRow[]> {
  const units = sql<number>`sum(${orderItems.qty})::int`;

  return executor
    .select({
      productId: orderItems.productId,
      name: sql<string>`(array_agg(${orderItems.nameSnapshot} order by ${orders.createdAt} desc))[1]`,
      units,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(settledInRange(from, to))
    .groupBy(orderItems.productId)
    .orderBy(desc(units))
    .limit(limit);
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
