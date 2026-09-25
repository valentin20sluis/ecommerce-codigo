import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAccountingJournal, type AccountingJournalInput, type JournalSource } from "./accounting.ts";
import { buildTaxSummary } from "./taxes.ts";

const SALE_ID = "3f2a9c1b-7d4e-4a8b-9c0d-1e2f3a4b5c6d";
const OTHER_SALE_ID = "aa11bb22-7d4e-4a8b-9c0d-1e2f3a4b5c6d";
const EXPENSE_ID = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

const EXPENSE: JournalSource = {
  kind: "expense",
  id: EXPENSE_ID,
  date: "2026-02-01",
  category: "rent",
  description: "Local",
  amountCents: 50000,
};

const SALE: JournalSource = { kind: "sale", id: SALE_ID, date: "2026-02-10", totalCents: 11800 };

function journal(overrides: Partial<AccountingJournalInput>) {
  return buildAccountingJournal({
    month: "2026-02",
    page: 1,
    pageSize: 50,
    totalEntries: 0,
    sources: [],
    knownCosts: [],
    grossCents: 0,
    revenueCentsKnown: 0,
    marginCentsKnown: 0,
    expensesCents: 0,
    ...overrides,
  });
}

describe("buildAccountingJournal", () => {
  it("returns an empty, balanced journal for a month without movements", () => {
    const dto = journal({});

    assert.deepEqual(dto.entries, []);
    assert.equal(dto.totalEntries, 0);
    assert.deepEqual(dto.totals, {
      grossCents: 0,
      costKnownCents: 0,
      expensesCents: 0,
      debitCents: 0,
      creditCents: 0,
      merchandiseBalanceCents: 0,
    });
    assert.equal(dto.costCoveragePercent, 0);
    assert.equal(dto.balanced, true);
  });

  it("builds the page entries in source order and attaches each order's known cost", () => {
    const dto = journal({
      totalEntries: 3,
      sources: [EXPENSE, SALE, { kind: "sale", id: OTHER_SALE_ID, date: "2026-02-11", totalCents: 5900 }],
      knownCosts: [{ orderId: SALE_ID, knownCostCents: 6000 }],
      grossCents: 17700,
      revenueCentsKnown: 11800,
      marginCentsKnown: 5800,
      expensesCents: 50000,
    });

    assert.deepEqual(
      dto.entries.map((entry) => entry.id),
      [`expense:${EXPENSE_ID}`, `order:${SALE_ID}`, `order:${OTHER_SALE_ID}`],
    );
    assert.equal(dto.entries[1].lines.length, 5);
    assert.equal(dto.entries[2].lines.length, 3);
    assert.ok(dto.entries.every((entry) => entry.balanced));
  });

  it("computes the month totals from the aggregates, not from the page", () => {
    const dto = journal({
      page: 2,
      totalEntries: 120,
      sources: [SALE],
      grossCents: 118000,
      revenueCentsKnown: 118000,
      marginCentsKnown: 58000,
      expensesCents: 20000,
    });

    assert.equal(dto.totals.grossCents, 118000);
    assert.equal(dto.totals.costKnownCents, 60000);
    assert.equal(dto.totals.expensesCents, 20000);
    assert.equal(dto.totals.debitCents, 198000);
    assert.equal(dto.totals.creditCents, 198000);
    assert.equal(dto.totalEntries, 120);
    assert.equal(dto.page, 2);
    assert.equal(dto.balanced, true);
  });

  it("keeps the same totals on every page of the month", () => {
    const aggregates = { totalEntries: 2, grossCents: 17700, revenueCentsKnown: 11800, marginCentsKnown: 5800, expensesCents: 50000 };
    const first = journal({ ...aggregates, page: 1, pageSize: 1, sources: [EXPENSE] });
    const second = journal({ ...aggregates, page: 2, pageSize: 1, sources: [SALE] });
    const outOfRange = journal({ ...aggregates, page: 9, pageSize: 1, sources: [] });

    assert.deepEqual(first.totals, second.totals);
    assert.deepEqual(first.totals, outOfRange.totals);
    assert.deepEqual(outOfRange.entries, []);
  });

  it("shows merchandise as the negative of the known cost", () => {
    const dto = journal({ grossCents: 11800, revenueCentsKnown: 11800, marginCentsKnown: 5800 });

    assert.equal(dto.totals.merchandiseBalanceCents, -6000);
  });

  it("balances the month for totals that round when split", () => {
    for (const grossCents of [1, 99, 100001, 123457]) {
      const dto = journal({ grossCents, expensesCents: 7777 });
      assert.equal(dto.totals.debitCents, dto.totals.creditCents);
      assert.equal(dto.balanced, true);
    }
  });

  it("matches the sales base plus IGV reported by the taxes summary for the month", () => {
    const grossCents = 123457;
    const revenueCentsKnown = 100001;
    const marginCentsKnown = 33333;
    const expensesCents = 7777;

    const dto = journal({ grossCents, revenueCentsKnown, marginCentsKnown, expensesCents });
    const taxes = buildTaxSummary({
      from: new Date("2026-02-01T00:00:00.000Z"),
      to: new Date("2026-02-28T23:59:59.999Z"),
      monthlySales: [{ month: "2026-02", salesCents: grossCents }],
      revenueCentsKnown,
      marginCentsKnown,
      expensesCents,
      incomeTaxRateBps: 2950,
    });

    const salesAndIgvCredit = dto.totals.creditCents - dto.totals.costKnownCents - dto.totals.expensesCents;
    assert.equal(salesAndIgvCredit, taxes.baseCents + taxes.igvCents);
    assert.equal(dto.totals.costKnownCents, taxes.costKnownCents);
    assert.equal(dto.costCoveragePercent, taxes.costCoveragePercent);
  });

  it("reports partial cost coverage", () => {
    const dto = journal({ grossCents: 20000, revenueCentsKnown: 10000, marginCentsKnown: 4000 });

    assert.equal(dto.costCoveragePercent, 50);
  });
});
