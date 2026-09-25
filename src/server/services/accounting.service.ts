import { JOURNAL_PAGE_SIZE } from "@/modules/finance/accounting";
import { monthToUtcRange } from "@/modules/finance/profit";
import { toUtcDateString } from "@/modules/finance/recurring";
import type { AccountingQuery } from "@/modules/finance/schemas/accounting.schema";
import { buildAccountingJournal, type AccountingJournalDto } from "@/modules/finance/types/accounting";
import * as expenseRepository from "@/server/repositories/expense.repository";
import * as journalSourceRepository from "@/server/repositories/journal-source.repository";
import * as orderRepository from "@/server/repositories/order.repository";
import { ensureRecurringExpenses } from "@/server/services/recurring-expense.service";

/**
 * Libro diario de un mes UTC (021). Materializa antes los recurrentes vencidos
 * (D9); la página y los agregados del mes van en paralelo, y el costo se trae
 * después, solo para los pedidos de la página (D6).
 */
export async function getAccountingJournal(query: AccountingQuery): Promise<AccountingJournalDto> {
  const { from, to } = monthToUtcRange(query.month);

  await ensureRecurringExpenses();

  const [sources, monthlySales, byCategoryRows, expensesCents] = await Promise.all([
    journalSourceRepository.listJournalSources(from, to, query.page, JOURNAL_PAGE_SIZE),
    orderRepository.getMonthlySales(from, to),
    orderRepository.getRevenueByCategory(from, to),
    expenseRepository.sumAmountBetween(toUtcDateString(from), toUtcDateString(to)),
  ]);

  const orderIds = sources.data.flatMap((source) => (source.kind === "sale" ? [source.id] : []));
  const knownCosts = await orderRepository.sumKnownCostByOrderIds(orderIds);

  return buildAccountingJournal({
    month: query.month,
    page: query.page,
    pageSize: JOURNAL_PAGE_SIZE,
    totalEntries: sources.total,
    sources: sources.data,
    knownCosts,
    grossCents: monthlySales.reduce((total, row) => total + row.salesCents, 0),
    revenueCentsKnown: byCategoryRows.reduce((total, row) => total + row.revenueCentsKnown, 0),
    marginCentsKnown: byCategoryRows.reduce((total, row) => total + row.marginCentsKnown, 0),
    expensesCents,
  });
}
