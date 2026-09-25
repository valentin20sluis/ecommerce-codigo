import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CHART_OF_ACCOUNTS,
  buildExpenseEntry,
  buildSaleEntry,
  isBalanced,
  type JournalLine,
} from "./accounting.ts";
import { EXPENSE_CATEGORY_VALUES } from "./schemas/expense.schema.ts";

const ORDER_ID = "3f2a9c1b-7d4e-4a8b-9c0d-1e2f3a4b5c6d";
const EXPENSE_ID = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

function line(accountCode: string, debitCents: number, creditCents: number) {
  return { accountCode, debitCents, creditCents };
}

function simplify(lines: JournalLine[]) {
  return lines.map(({ accountCode, debitCents, creditCents }) => line(accountCode, debitCents, creditCents));
}

describe("buildSaleEntry", () => {
  it("books cash, sales, IGV and cost of sales for an order with known cost", () => {
    const entry = buildSaleEntry({ orderId: ORDER_ID, date: "2026-02-10", totalCents: 11800, knownCostCents: 6000 });

    assert.deepEqual(simplify(entry.lines), [
      line("10", 11800, 0),
      line("70", 0, 10000),
      line("40", 0, 1800),
      line("69", 6000, 0),
      line("20", 0, 6000),
    ]);
    assert.equal(entry.debitCents, 17800);
    assert.equal(entry.creditCents, 17800);
    assert.equal(entry.balanced, true);
  });

  it("uses the order id, kind and date without customer data in the description", () => {
    const entry = buildSaleEntry({ orderId: ORDER_ID, date: "2026-02-10", totalCents: 11800, knownCostCents: 0 });

    assert.equal(entry.id, `order:${ORDER_ID}`);
    assert.equal(entry.kind, "sale");
    assert.equal(entry.date, "2026-02-10");
    assert.equal(entry.description, "Venta pedido #3f2a9c1b");
  });

  it("only books the three collection lines when known cost is zero", () => {
    const entry = buildSaleEntry({ orderId: ORDER_ID, date: "2026-02-10", totalCents: 11800, knownCostCents: 0 });

    assert.deepEqual(simplify(entry.lines), [line("10", 11800, 0), line("70", 0, 10000), line("40", 0, 1800)]);
    assert.equal(entry.balanced, true);
  });

  for (const totalCents of [1, 99, 100, 100001, 123457, 99999999]) {
    it(`balances exactly for a total of ${totalCents} cents despite rounding`, () => {
      const entry = buildSaleEntry({ orderId: ORDER_ID, date: "2026-02-10", totalCents, knownCostCents: 0 });

      assert.equal(entry.balanced, true);
      assert.equal(entry.debitCents, totalCents);
      assert.equal(entry.creditCents, totalCents);
      assert.ok(entry.lines.every((journalLine) => Number.isInteger(journalLine.creditCents)));
    });
  }
});

describe("buildExpenseEntry", () => {
  it("books a rent expense against cash", () => {
    const entry = buildExpenseEntry({
      expenseId: EXPENSE_ID,
      date: "2026-02-01",
      category: "rent",
      description: "Local de febrero",
      amountCents: 50000,
    });

    assert.deepEqual(entry.lines, [
      { accountCode: "63.03", accountName: "Alquiler", debitCents: 50000, creditCents: 0 },
      { accountCode: "10", accountName: "Caja y bancos", debitCents: 0, creditCents: 50000 },
    ]);
    assert.equal(entry.id, `expense:${EXPENSE_ID}`);
    assert.equal(entry.kind, "expense");
    assert.equal(entry.description, "Alquiler: Local de febrero");
    assert.equal(entry.balanced, true);
  });
});

describe("CHART_OF_ACCOUNTS", () => {
  it("has exactly one expense account per expense category", () => {
    assert.deepEqual(Object.keys(CHART_OF_ACCOUNTS.expenses).sort(), [...EXPENSE_CATEGORY_VALUES].sort());
  });

  it("numbers the expense accounts 63.01 to 63.08 in category order", () => {
    const codes = EXPENSE_CATEGORY_VALUES.map((category) => CHART_OF_ACCOUNTS.expenses[category].code);
    assert.deepEqual(codes, ["63.01", "63.02", "63.03", "63.04", "63.05", "63.06", "63.07", "63.08"]);
  });

  it("never reuses an account code", () => {
    const codes = [
      CHART_OF_ACCOUNTS.cash.code,
      CHART_OF_ACCOUNTS.merchandise.code,
      CHART_OF_ACCOUNTS.igvPayable.code,
      CHART_OF_ACCOUNTS.costOfSales.code,
      CHART_OF_ACCOUNTS.sales.code,
      ...Object.values(CHART_OF_ACCOUNTS.expenses).map((account) => account.code),
    ];
    assert.equal(new Set(codes).size, codes.length);
  });
});

describe("isBalanced", () => {
  it("is true for an entry without lines", () => {
    assert.equal(isBalanced({ lines: [] }), true);
  });

  it("is false when debits and credits differ by one cent", () => {
    const lines: JournalLine[] = [
      { accountCode: "10", accountName: "Caja y bancos", debitCents: 100, creditCents: 0 },
      { accountCode: "70", accountName: "Ventas", debitCents: 0, creditCents: 99 },
    ];
    assert.equal(isBalanced({ lines }), false);
  });
});
