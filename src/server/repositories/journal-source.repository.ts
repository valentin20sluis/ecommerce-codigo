import { and, gte, lte, sql } from "drizzle-orm";

import { toUtcDateString } from "@/modules/finance/recurring";
import type { ExpenseCategoryValue } from "@/modules/finance/schemas/expense.schema";
import type { JournalSource } from "@/modules/finance/types/accounting";
import { db } from "@/server/db";
import type { ReadExecutor } from "@/server/db/pool";
import { expenses, orders } from "@/server/db/schema";
import { settledInRange } from "@/server/repositories/order.repository";

type JournalSourceRow = {
  id: string;
  kind: JournalSource["kind"];
  date: string;
  amountCents: number;
  category: ExpenseCategoryValue | null;
  description: string | null;
};

function toJournalSource(row: JournalSourceRow): JournalSource {
  if (row.kind === "sale") {
    return { kind: "sale", id: row.id, date: row.date, totalCents: row.amountCents };
  }

  if (row.category === null || row.description === null) {
    throw new Error(`Egreso ${row.id} sin categoría o descripción en el libro diario.`);
  }

  return {
    kind: "expense",
    id: row.id,
    date: row.date,
    category: row.category,
    description: row.description,
    amountCents: row.amountCents,
  };
}

/**
 * Orígenes del libro diario de un rango, paginados en una sola consulta
 * `UNION ALL` (021 D6). Orden D7: el instante (`created_at` del pedido o
 * `incurred_on` a las 00:00 UTC del egreso), luego egresos antes que ventas
 * para empatar un día, luego `id` — así ninguna fila se repite entre páginas.
 * El total va aparte con dos conteos sobre los mismos filtros.
 */
export async function listJournalSources(
  from: Date,
  to: Date,
  page: number,
  pageSize: number,
  executor: ReadExecutor = db,
): Promise<{ data: JournalSource[]; total: number }> {
  const expenseFilter = and(
    gte(expenses.incurredOn, toUtcDateString(from)),
    lte(expenses.incurredOn, toUtcDateString(to)),
  );

  const sales = executor
    .select({
      id: orders.id,
      kind: sql<JournalSource["kind"]>`'sale'`.as("kind"),
      date: sql<string>`to_char(${orders.createdAt} at time zone 'utc', 'YYYY-MM-DD')`.as("date"),
      amountCents: sql<number>`${orders.totalCents}`.as("amount_cents"),
      category: sql<ExpenseCategoryValue | null>`null::text`.as("category"),
      description: sql<string | null>`null::text`.as("description"),
      sortAt: sql<string>`${orders.createdAt}`.as("sort_at"),
      sortRank: sql<number>`1`.as("sort_rank"),
    })
    .from(orders)
    .where(settledInRange(from, to));

  const expenseRows = executor
    .select({
      id: expenses.id,
      kind: sql<JournalSource["kind"]>`'expense'`.as("kind"),
      date: sql<string>`to_char(${expenses.incurredOn}, 'YYYY-MM-DD')`.as("date"),
      amountCents: sql<number>`${expenses.amountCents}`.as("amount_cents"),
      category: sql<ExpenseCategoryValue | null>`${expenses.category}::text`.as("category"),
      description: sql<string | null>`${expenses.description}`.as("description"),
      sortAt: sql<string>`(${expenses.incurredOn}::timestamp at time zone 'utc')`.as("sort_at"),
      sortRank: sql<number>`0`.as("sort_rank"),
    })
    .from(expenses)
    .where(expenseFilter);

  const [rows, [salesCount], [expensesCount]] = await Promise.all([
    sales
      .unionAll(expenseRows)
      .orderBy(sql`sort_at`, sql`sort_rank`, sql`id`)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    executor.select({ total: sql<number>`count(*)::int` }).from(orders).where(settledInRange(from, to)),
    executor.select({ total: sql<number>`count(*)::int` }).from(expenses).where(expenseFilter),
  ]);

  return {
    data: rows.map(toJournalSource),
    total: (salesCount?.total ?? 0) + (expensesCount?.total ?? 0),
  };
}
