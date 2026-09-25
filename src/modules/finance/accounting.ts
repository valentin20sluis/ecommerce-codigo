// Imports relativos con `.ts`: este archivo corre bajo `node --test` (018 D11).
import { EXPENSE_CATEGORY_LABEL } from "./constants.ts";
import type { ExpenseCategoryValue } from "./schemas/expense.schema.ts";
import { splitGross } from "./taxes.ts";

export type Account = { code: string; name: string };

/**
 * Plan de cuentas reducido (021 D2): códigos propios inspirados en el PCGE, no
 * el PCGE. El `Record` por categoría es literal a propósito: una categoría de
 * egreso nueva rompe el typecheck hasta que tenga su cuenta.
 */
export const CHART_OF_ACCOUNTS = {
  cash: { code: "10", name: "Caja y bancos" },
  merchandise: { code: "20", name: "Mercaderías" },
  igvPayable: { code: "40", name: "IGV por pagar" },
  costOfSales: { code: "69", name: "Costo de ventas" },
  sales: { code: "70", name: "Ventas" },
  expenses: {
    advertising: { code: "63.01", name: EXPENSE_CATEGORY_LABEL.advertising },
    payroll: { code: "63.02", name: EXPENSE_CATEGORY_LABEL.payroll },
    rent: { code: "63.03", name: EXPENSE_CATEGORY_LABEL.rent },
    software: { code: "63.04", name: EXPENSE_CATEGORY_LABEL.software },
    shipping: { code: "63.05", name: EXPENSE_CATEGORY_LABEL.shipping },
    payment_fees: { code: "63.06", name: EXPENSE_CATEGORY_LABEL.payment_fees },
    taxes_fees: { code: "63.07", name: EXPENSE_CATEGORY_LABEL.taxes_fees },
    other: { code: "63.08", name: EXPENSE_CATEGORY_LABEL.other },
  } satisfies Record<ExpenseCategoryValue, Account>,
} as const;

/** Asientos por página del libro diario (021 D6): fijo en servidor, el cliente no lo elige. */
export const JOURNAL_PAGE_SIZE = 50;

export type JournalLine = {
  accountCode: string;
  accountName: string;
  debitCents: number;
  creditCents: number;
};

export type JournalEntryKind = "sale" | "expense";

export type JournalEntry = {
  id: `order:${string}` | `expense:${string}`;
  kind: JournalEntryKind;
  /** `YYYY-MM-DD` en UTC. */
  date: string;
  description: string;
  lines: JournalLine[];
  debitCents: number;
  creditCents: number;
  balanced: boolean;
};

function debit(account: Account, cents: number): JournalLine {
  return { accountCode: account.code, accountName: account.name, debitCents: cents, creditCents: 0 };
}

function credit(account: Account, cents: number): JournalLine {
  return { accountCode: account.code, accountName: account.name, debitCents: 0, creditCents: cents };
}

function sumDebits(lines: JournalLine[]): number {
  return lines.reduce((total, line) => total + line.debitCents, 0);
}

function sumCredits(lines: JournalLine[]): number {
  return lines.reduce((total, line) => total + line.creditCents, 0);
}

/** Partida doble (021 D5): Σ debe = Σ haber, en enteros exactos. */
export function isBalanced(entry: Pick<JournalEntry, "lines">): boolean {
  return sumDebits(entry.lines) === sumCredits(entry.lines);
}

function toEntry(
  id: JournalEntry["id"],
  kind: JournalEntryKind,
  date: string,
  description: string,
  lines: JournalLine[],
): JournalEntry {
  return {
    id,
    kind,
    date,
    description,
    lines,
    debitCents: sumDebits(lines),
    creditCents: sumCredits(lines),
    balanced: isBalanced({ lines }),
  };
}

export type SaleEntryInput = {
  orderId: string;
  date: string;
  totalCents: number;
  /** Σ `cost_cents_snapshot × qty` de las líneas con costo; 0 si ninguna lo tiene. */
  knownCostCents: number;
};

/**
 * Asiento de venta cobrada (021 D3): cobro con IGV separado por `splitGross` y,
 * si hay costo conocido, la salida de mercadería. La glosa no lleva datos del cliente (D4).
 */
export function buildSaleEntry(input: SaleEntryInput): JournalEntry {
  const { baseCents, igvCents } = splitGross(input.totalCents);

  const lines = [
    debit(CHART_OF_ACCOUNTS.cash, input.totalCents),
    credit(CHART_OF_ACCOUNTS.sales, baseCents),
    credit(CHART_OF_ACCOUNTS.igvPayable, igvCents),
  ];

  if (input.knownCostCents > 0) {
    lines.push(
      debit(CHART_OF_ACCOUNTS.costOfSales, input.knownCostCents),
      credit(CHART_OF_ACCOUNTS.merchandise, input.knownCostCents),
    );
  }

  return toEntry(
    `order:${input.orderId}`,
    "sale",
    input.date,
    `Venta pedido #${input.orderId.slice(0, 8)}`,
    lines,
  );
}

export type ExpenseEntryInput = {
  expenseId: string;
  date: string;
  category: ExpenseCategoryValue;
  description: string;
  amountCents: number;
};

/** Asiento de egreso (021 D4): gasto de su categoría contra caja, sin separar IGV de compras. */
export function buildExpenseEntry(input: ExpenseEntryInput): JournalEntry {
  const account = CHART_OF_ACCOUNTS.expenses[input.category];

  return toEntry(
    `expense:${input.expenseId}`,
    "expense",
    input.date,
    `${EXPENSE_CATEGORY_LABEL[input.category]}: ${input.description}`,
    [debit(account, input.amountCents), credit(CHART_OF_ACCOUNTS.cash, input.amountCents)],
  );
}
