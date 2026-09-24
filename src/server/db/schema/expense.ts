import { desc, sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { expenseCategory } from "./expense-category";
import { recurringExpenses } from "./recurring-expense";
import { users } from "./user";

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: expenseCategory("category").notNull(),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    /** Día del gasto, sin hora: evita cualquier corrimiento por zona horaria (017 D9). */
    incurredOn: date("incurred_on", { mode: "string" }).notNull(),
    // SET NULL: borrar la plantilla conserva los egresos ya generados (017 D7).
    recurringExpenseId: uuid("recurring_expense_id").references(() => recurringExpenses.id, {
      onDelete: "set null",
    }),
    // Nulo = generado por el sistema, o autor dado de baja.
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("expenses_incurred_on_idx").on(desc(t.incurredOn)),
    index("expenses_category_incurred_on_idx").on(t.category, desc(t.incurredOn)),
    // Candado contra ejecuciones concurrentes de la generación (017 D6).
    uniqueIndex("expenses_recurring_occurrence_unique")
      .on(t.recurringExpenseId, t.incurredOn)
      .where(sql`${t.recurringExpenseId} is not null`),
    check("expenses_amount_positive", sql`${t.amountCents} > 0`),
  ],
);

export type Expense = InferSelectModel<typeof expenses>;
export type NewExpense = InferInsertModel<typeof expenses>;
