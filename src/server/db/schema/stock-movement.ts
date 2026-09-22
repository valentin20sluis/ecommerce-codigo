import { desc, relations, sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { products } from "./product";
import { users } from "./user";

/**
 * Kardex append-only (014). `initial` es la foto del stock previo al módulo —la
 * escribe el backfill de la migración y el alta de producto—; `sale`/`return`
 * los emite el servidor (webhook de pago, cancelación) y `adjustment`/`waste`/
 * `restock` son los tres ajustes manuales del panel.
 */
export const STOCK_MOVEMENT_TYPES = [
  "initial",
  "sale",
  "return",
  "adjustment",
  "waste",
  "restock",
] as const;

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const stockMovementType = pgEnum("stock_movement_type", STOCK_MOVEMENT_TYPES);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // CASCADE y no RESTRICT (D4): con el backfill `initial`, todo producto tiene
    // kardex y un RESTRICT bloquearía el DELETE de producto de 003.
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    type: stockMovementType("type").notNull(),
    /** Entero **con signo** (D1): conciliar el kardex es un solo `sum(qty_delta)`. */
    qtyDelta: integer("qty_delta").notNull(),
    /** Valor del `RETURNING` del UPDATE (D2): kardex legible sin recalcular. */
    stockAfter: integer("stock_after").notNull(),
    reason: text("reason"),
    /** `'order'` + id de la orden para `sale`/`return`; nulo en el resto. */
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    // Nulo = movimiento automático (webhook) o actor dado de baja.
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("stock_movements_product_id_created_at_idx").on(t.productId, desc(t.createdAt)),
    // Candado de idempotencia de `sale`/`return`: una reentrega del webhook o una
    // segunda cancelación no pueden duplicar el movimiento de la misma orden.
    uniqueIndex("stock_movements_reference_unique")
      .on(t.referenceType, t.referenceId, t.productId, t.type)
      .where(sql`${t.referenceId} is not null`),
    check("stock_movements_qty_delta_not_zero", sql`${t.qtyDelta} <> 0`),
    check(
      "stock_movements_reason_required",
      sql`${t.type} not in ('adjustment', 'waste') or ${t.reason} is not null`,
    ),
  ],
);

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  product: one(products, { fields: [stockMovements.productId], references: [products.id] }),
  actor: one(users, { fields: [stockMovements.actorId], references: [users.id] }),
}));

export type StockMovement = InferSelectModel<typeof stockMovements>;
export type NewStockMovement = InferInsertModel<typeof stockMovements>;
