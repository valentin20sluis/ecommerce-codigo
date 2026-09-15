import { desc, relations, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { users } from "./user";

/**
 * Tarjetas guardadas del cliente. Solo el material que Stripe expone del
 * PaymentMethod (010 D1): marca, últimos 4 y vencimiento. Nunca el PAN, el CVV
 * ni el BIN — Stripe no los devuelve y la app no debe almacenarlos jamás.
 *
 * El `stripe_customer_id` no se repite por fila: sale de `users` (D2).
 */
export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Único: es la clave de idempotencia del webhook (D6). */
    stripePaymentMethodId: text("stripe_payment_method_id").notNull(),
    /** `card.brand` tal cual lo da Stripe: minúsculas (`visa`, `amex`). */
    brand: text("brand").notNull(),
    last4: text("last4").notNull(),
    expMonth: integer("exp_month").notNull(),
    expYear: integer("exp_year").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("payment_methods_stripe_payment_method_id_unique").on(t.stripePaymentMethodId),
    index("payment_methods_user_id_created_at_idx").on(t.userId, desc(t.createdAt)),
  ],
);

export const paymentMethodsRelations = relations(paymentMethods, ({ one }) => ({
  user: one(users, { fields: [paymentMethods.userId], references: [users.id] }),
}));

export type PaymentMethod = InferSelectModel<typeof paymentMethods>;
export type NewPaymentMethod = InferInsertModel<typeof paymentMethods>;
