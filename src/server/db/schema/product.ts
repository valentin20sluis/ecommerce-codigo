import { relations, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { categories } from "./category";

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    // Nullable a propósito (D2): el índice único es NULLS DISTINCT, así que
    // varios productos sin SKU conviven sin colisionar entre sí.
    sku: text("sku"),
    description: text("description"),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    priceCents: integer("price_cents").notNull(),
    compareAtPriceCents: integer("compare_at_price_cents"),
    /** Costo unitario actual (015 D1). Nullable a propósito: sin costo cargado,
     * el margen se muestra como "sin dato", nunca como un 0 o un 100% falso. */
    costCents: integer("cost_cents"),
    stock: integer("stock").notNull().default(0),
    /** Umbral propio de la alerta de stock bajo (014); reemplaza la constante fija de 013. */
    lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
    isActive: boolean("is_active").notNull().default(true),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    // Columna sin uso todavía: DELETE sigue siendo físico (product.repository.ts `remove`).
    // Queda lista para una futura implementación de soft-delete.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("products_slug_unique").on(t.slug),
    uniqueIndex("products_sku_unique").on(t.sku),
    index("products_category_id_idx").on(t.categoryId),
    index("products_name_idx").on(t.name),
  ],
);

export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
}));

// La punta 1—N vive aquí y no en `category.ts` para no crear un ciclo de imports.
export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export type Product = InferSelectModel<typeof products>;
export type NewProduct = InferInsertModel<typeof products>;
