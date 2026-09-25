// Imports relativos con `.ts`: este archivo corre bajo `node --test` (018 D11).
import { buildExpenseEntry, buildSaleEntry, type JournalEntry } from "../accounting.ts";
import type { ExpenseCategoryValue } from "../schemas/expense.schema.ts";
import { splitGross } from "../taxes.ts";
import { resolveMarginCoverage } from "../utils.ts";

/** Un origen del libro diario tal como lo pagina `listJournalSources` (021 D6/D7). */
export type JournalSource =
  | { kind: "sale"; id: string; date: string; totalCents: number }
  | {
      kind: "expense";
      id: string;
      date: string;
      category: ExpenseCategoryValue;
      description: string;
      amountCents: number;
    };

export type OrderKnownCost = { orderId: string; knownCostCents: number };

export type AccountingTotals = {
  grossCents: number;
  costKnownCents: number;
  expensesCents: number;
  debitCents: number;
  creditCents: number;
  /** Saldo de `20` Mercaderías: negativo porque no se registran compras (021 D11). */
  merchandiseBalanceCents: number;
};

export type AccountingJournalDto = {
  month: string;
  page: number;
  pageSize: number;
  totalEntries: number;
  entries: JournalEntry[];
  totals: AccountingTotals;
  costCoveragePercent: number;
  /** El total del mes y todos los asientos de esta página cuadran. */
  balanced: boolean;
};

export type AccountingJournalInput = {
  month: string;
  page: number;
  pageSize: number;
  totalEntries: number;
  sources: JournalSource[];
  /** Solo los pedidos de la página con costo conocido; el resto cuenta como 0. */
  knownCosts: OrderKnownCost[];
  grossCents: number;
  /** Ingresos y margen de las líneas con costo congelado (criterio 018 D5). */
  revenueCentsKnown: number;
  marginCentsKnown: number;
  expensesCents: number;
};

function toEntry(source: JournalSource, costByOrderId: Map<string, number>): JournalEntry {
  if (source.kind === "sale") {
    return buildSaleEntry({
      orderId: source.id,
      date: source.date,
      totalCents: source.totalCents,
      knownCostCents: costByOrderId.get(source.id) ?? 0,
    });
  }

  return buildExpenseEntry({
    expenseId: source.id,
    date: source.date,
    category: source.category,
    description: source.description,
    amountCents: source.amountCents,
  });
}

/**
 * Libro diario de una página (021 D10). Los totales salen de los agregados del
 * mes, no de sumar asientos: `splitGross` del bruto del mes, igual que 018, para
 * que Ventas + IGV coincidan con Impuestos (AC10).
 */
export function buildAccountingJournal(input: AccountingJournalInput): AccountingJournalDto {
  const costByOrderId = new Map(input.knownCosts.map((row) => [row.orderId, row.knownCostCents]));
  const entries = input.sources.map((source) => toEntry(source, costByOrderId));

  const costKnownCents = input.revenueCentsKnown - input.marginCentsKnown;
  const { baseCents, igvCents } = splitGross(input.grossCents);
  const debitCents = input.grossCents + costKnownCents + input.expensesCents;
  const creditCents = baseCents + igvCents + costKnownCents + input.expensesCents;

  const { marginCoveragePercent } = resolveMarginCoverage(
    input.marginCentsKnown,
    input.revenueCentsKnown,
    input.grossCents,
  );

  return {
    month: input.month,
    page: input.page,
    pageSize: input.pageSize,
    totalEntries: input.totalEntries,
    entries,
    totals: {
      grossCents: input.grossCents,
      costKnownCents,
      expensesCents: input.expensesCents,
      debitCents,
      creditCents,
      // `0 - x` y no `-x`: sin costo conocido el saldo debe ser 0, no `-0`.
      merchandiseBalanceCents: 0 - costKnownCents,
    },
    costCoveragePercent: marginCoveragePercent,
    balanced: debitCents === creditCents && entries.every((entry) => entry.balanced),
  };
}
