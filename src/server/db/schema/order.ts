import { desc, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./user";

/**
 * Estados **de cobro** (008 D3). Los de fulfillment (`shipped`, `delivered`) los
 * añadirá el spec de gestión de pedidos del admin ampliando el enum, sin
 * renombrar estos.
 */
export const ORDER_STATUSES = ["pending_payment", "paid", "payment_failed", "canceled"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const orderStatus = pgEnum("order_status", ORDER_STATUSES);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: orderStatus("status").notNull().default("pending_payment"),
    subtotalCents: integer("subtotal_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    /** ISO 4217 en minúsculas; se copia por fila para no migrar al abrir multi-moneda (D1). */
    currency: text("currency").notNull(),
    // Nullable a propósito (D4): la orden nace antes de que exista la sesión de
    // Stripe. El índice único es NULLS DISTINCT, así que varias órdenes recién
    // creadas conviven sin colisionar.
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_stripe_checkout_session_id_unique").on(t.stripeCheckoutSessionId),
    index("orders_user_id_created_at_idx").on(t.userId, desc(t.createdAt)),
  ],
);

// `ordersRelations` vive en `order-item.ts` junto a la punta N—1, mismo criterio
// que `categoriesRelations` en `product.ts`: evita un ciclo de imports.

export type Order = InferSelectModel<typeof orders>;
export type NewOrder = InferInsertModel<typeof orders>;
