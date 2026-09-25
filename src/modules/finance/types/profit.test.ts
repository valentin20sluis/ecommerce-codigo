import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildProfitStatement } from "./profit.ts";
import { buildTaxSummary, type TaxSummaryInput } from "./taxes.ts";

const FEBRUARY = {
  from: new Date("2026-02-01T00:00:00.000Z"),
  to: new Date("2026-02-28T23:59:59.999Z"),
};

// Resumen real de `buildTaxSummary`, no uno armado a mano: la cascada debe cuadrar con Impuestos.
function summary(overrides: Partial<TaxSummaryInput>) {
  return buildTaxSummary({
    ...FEBRUARY,
    monthlySales: [],
    revenueCentsKnown: 0,
    marginCentsKnown: 0,
    expensesCents: 0,
    incomeTaxRateBps: 2950,
    ...overrides,
  });
}

describe("buildProfitStatement", () => {
  it("chains gross, operating and net profit from the tax summary", () => {
    const taxSummary = summary({
      monthlySales: [{ month: "2026-02", salesCents: 118000 }],
      revenueCentsKnown: 118000,
      marginCentsKnown: 68000,
      expensesCents: 20000,
    });

    const statement = buildProfitStatement("2026-02", taxSummary);

    assert.equal(statement.month, "2026-02");
    assert.equal(statement.grossCents, 118000);
    assert.equal(statement.salesBaseCents, 100000);
    assert.equal(statement.costOfSalesCents, 50000);
    assert.equal(statement.grossProfitCents, 50000);
    assert.equal(statement.expensesCents, 20000);
    assert.equal(statement.operatingProfitCents, 30000);
    assert.equal(statement.incomeTaxRateBps, 2950);
    assert.equal(statement.incomeTaxCents, 8850);
    assert.equal(statement.netProfitCents, 21150);
    assert.equal(statement.costCoveragePercent, 100);
  });

  it("keeps every step of the cascade consistent with the summary", () => {
    const taxSummary = summary({
      monthlySales: [{ month: "2026-02", salesCents: 123457 }],
      revenueCentsKnown: 100001,
      marginCentsKnown: 33333,
      expensesCents: 7777,
      incomeTaxRateBps: 1000,
    });

    const statement = buildProfitStatement("2026-02", taxSummary);

    assert.equal(statement.grossProfitCents, statement.salesBaseCents - statement.costOfSalesCents);
    assert.equal(statement.operatingProfitCents, statement.grossProfitCents - statement.expensesCents);
    assert.equal(statement.operatingProfitCents, taxSummary.profitCents);
    assert.equal(statement.incomeTaxCents, taxSummary.incomeTaxCents);
    assert.equal(statement.netProfitCents, statement.operatingProfitCents - statement.incomeTaxCents);
  });

  it("charges no income tax and keeps net equal to operating on a loss", () => {
    const statement = buildProfitStatement(
      "2026-02",
      summary({
        monthlySales: [{ month: "2026-02", salesCents: 11800 }],
        revenueCentsKnown: 11800,
        marginCentsKnown: 1800,
        expensesCents: 50000,
      }),
    );

    assert.ok(statement.operatingProfitCents < 0);
    assert.equal(statement.incomeTaxCents, 0);
    assert.equal(statement.netProfitCents, statement.operatingProfitCents);
  });

  it("charges no income tax on exactly zero operating profit", () => {
    const statement = buildProfitStatement(
      "2026-02",
      summary({
        monthlySales: [{ month: "2026-02", salesCents: 11800 }],
        revenueCentsKnown: 11800,
        marginCentsKnown: 11800,
        expensesCents: 10000,
      }),
    );

    assert.equal(statement.operatingProfitCents, 0);
    assert.equal(statement.incomeTaxCents, 0);
    assert.equal(statement.netProfitCents, 0);
  });

  it("shows a loss equal to the expenses when there are no sales", () => {
    const statement = buildProfitStatement("2026-02", summary({ expensesCents: 45000 }));

    assert.equal(statement.grossCents, 0);
    assert.equal(statement.grossProfitCents, 0);
    assert.equal(statement.operatingProfitCents, -45000);
    assert.equal(statement.netProfitCents, -45000);
  });

  it("returns all zeros for a month without sales or expenses", () => {
    const statement = buildProfitStatement("2026-02", summary({}));

    assert.equal(statement.grossCents, 0);
    assert.equal(statement.expensesCents, 0);
    assert.equal(statement.netProfitCents, 0);
  });

  it("passes through partial cost coverage", () => {
    const statement = buildProfitStatement(
      "2026-02",
      summary({
        monthlySales: [{ month: "2026-02", salesCents: 20000 }],
        revenueCentsKnown: 10000,
        marginCentsKnown: 4000,
      }),
    );

    assert.equal(statement.costCoveragePercent, 50);
    assert.equal(statement.costOfSalesCents, 6000);
  });
});
