import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import { check, integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./user";

/** Una sola fila (018 D8): el `CHECK (id = 1)` impide una segunda configuración. */
export const financeSettings = pgTable(
  "finance_settings",
  {
    id: integer("id").primaryKey(),
    incomeTaxRateBps: integer("income_tax_rate_bps").notNull(),
    // Nulo = autor dado de baja.
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("finance_settings_single_row", sql`${t.id} = 1`),
    check(
      "finance_settings_income_tax_rate_range",
      sql`${t.incomeTaxRateBps} between 0 and 10000`,
    ),
  ],
);

export type FinanceSettings = InferSelectModel<typeof financeSettings>;
export type NewFinanceSettings = InferInsertModel<typeof financeSettings>;
