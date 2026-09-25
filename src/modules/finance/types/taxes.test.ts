import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTaxSummary, type TaxSummaryInput } from "./taxes.ts";

const RANGE = {
  from: new Date("2026-01-01T00:00:00Z"),
  to: new Date("2026-03-31T23:59:59.999Z"),
};

function input(overrides: Partial<TaxSummaryInput>): TaxSummaryInput {
  return {
    ...RANGE,
    monthlySales: [],
    revenueCentsKnown: 0,
    marginCentsKnown: 0,
    expensesCents: 0,
    incomeTaxRateBps: 2950,
    ...overrides,
  };
}

describe("buildTaxSummary", () => {
  it("returns zeros for a range without sales, one row per month", () => {
    const summary = buildTaxSummary(input({}));

    assert.equal(summary.months.length, 3);
    assert.equal(summary.grossCents, 0);
    assert.equal(summary.baseCents, 0);
    assert.equal(summary.igvCents, 0);
    assert.equal(summary.costKnownCents, 0);
    assert.equal(summary.costCoveragePercent, 0);
    assert.equal(summary.profitCents, 0);
    assert.equal(summary.incomeTaxCents, 0);
  });

  it("makes the period totals the exact sum of the monthly rows", () => {
    const summary = buildTaxSummary(
      input({
        monthlySales: [
          { month: "2026-01", salesCents: 1001 },
          { month: "2026-03", salesCents: 2003 },
        ],
      }),
    );

    for (const key of ["grossCents", "baseCents", "igvCents"] as const) {
      assert.equal(
        summary[key],
        summary.months.reduce((sum, row) => sum + row[key], 0),
        key,
      );
    }
    assert.equal(summary.grossCents, 3004);
  });

  it("computes profit as base minus known cost minus expenses and taxes it", () => {
    const summary = buildTaxSummary(
      input({
        monthlySales: [{ month: "2026-02", salesCents: 118000 }],
        revenueCentsKnown: 118000,
        marginCentsKnown: 68000,
        expensesCents: 20000,
        incomeTaxRateBps: 2950,
      }),
    );

    assert.equal(summary.baseCents, 100000);
    assert.equal(summary.costKnownCents, 50000);
    assert.equal(summary.profitCents, 100000 - 50000 - 20000);
    assert.equal(summary.incomeTaxCents, Math.round((30000 * 2950) / 10000));
    assert.equal(summary.costCoveragePercent, 100);
  });

  it("returns 0 income tax when the profit is negative", () => {
    const summary = buildTaxSummary(
      input({
        monthlySales: [{ month: "2026-01", salesCents: 11800 }],
        revenueCentsKnown: 11800,
        marginCentsKnown: 1800,
        expensesCents: 50000,
      }),
    );

    assert.ok(summary.profitCents < 0);
    assert.equal(summary.incomeTaxCents, 0);
  });

  it("reports partial cost coverage", () => {
    const summary = buildTaxSummary(
      input({
        monthlySales: [{ month: "2026-01", salesCents: 20000 }],
        revenueCentsKnown: 10000,
        marginCentsKnown: 4000,
      }),
    );

    assert.equal(summary.costCoveragePercent, 50);
    assert.equal(summary.costKnownCents, 6000);
  });

  it("echoes the range as ISO strings and the rate used", () => {
    const summary = buildTaxSummary(input({ incomeTaxRateBps: 1000 }));

    assert.equal(summary.from, RANGE.from.toISOString());
    assert.equal(summary.to, RANGE.to.toISOString());
    assert.equal(summary.incomeTaxRateBps, 1000);
  });
});
