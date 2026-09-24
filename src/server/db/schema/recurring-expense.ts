import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import { boolean, check, date, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { expenseCategory } from "./expense-category";
import { users } from "./user";

export const recurringExpenses = pgTable(
  "recurring_expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: expenseCategory("category").notNull(),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    /** 1–31; en meses más cortos el vencimiento cae en el último día (017 D4). */
    dayOfMonth: integer("day_of_month").notNull(),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    endsOn: date("ends_on", { mode: "string" }),
    isActive: boolean("is_active").notNull().default(true),
    /**
     * Fecha del último vencimiento materializado (017 D6). Es la fuente de
     * verdad del avance: un egreso generado que se borra no reaparece porque
     * la generación solo mira lo posterior a esta marca.
     */
    generatedThrough: date("generated_through", { mode: "string" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("recurring_expenses_amount_positive", sql`${t.amountCents} > 0`),
    check("recurring_expenses_day_of_month_range", sql`${t.dayOfMonth} between 1 and 31`),
    check(
      "recurring_expenses_ends_after_starts",
      sql`${t.endsOn} is null or ${t.endsOn} >= ${t.startsOn}`,
    ),
  ],
);

export type RecurringExpense = InferSelectModel<typeof recurringExpenses>;
export type NewRecurringExpense = InferInsertModel<typeof recurringExpenses>;
