import { relations, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import { index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { orders } from "./order";
import { products } from "./product";
import { users } from "./user";

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    /** Nombre al momento de comprar: renombrar el producto no reescribe el pedido. */
    nameSnapshot: text("name_snapshot").notNull(),
    /** Precio congelado en centavos; nunca se relee de `products` después. */
    unitPriceCents: integer("unit_price_cents").notNull(),
    /** Costo congelado al momento de la venta (015 D2). Si el producto no tenía
     * costo cargado, queda NULL para siempre: no se rellena retroactivamente. */
    costCentsSnapshot: integer("cost_cents_snapshot"),
    qty: integer("qty").notNull(),
  },
  (t) => [index("order_items_order_id_idx").on(t.orderId)],
);

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));

// La punta 1—N de `orders` vive aquí para no crear un ciclo de imports con `order.ts`.
export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
}));

export type OrderItem = InferSelectModel<typeof orderItems>;
export type NewOrderItem = InferInsertModel<typeof orderItems>;
