import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  estimateIncomeTax,
  fillMissingMonthsInRange,
  splitGross,
  sumTaxBreakdowns,
} from "./taxes.ts";

describe("splitGross", () => {
  it("splits 11800 cents into base 10000 and igv 1800 with no other fields", () => {
    assert.deepEqual(splitGross(11800), {
      grossCents: 11800,
      baseCents: 10000,
      igvCents: 1800,
    });
  });

  it("returns all zeros for a zero gross", () => {
    assert.deepEqual(splitGross(0), { grossCents: 0, baseCents: 0, igvCents: 0 });
  });

  it("keeps base + igv equal to gross for amounts that do not divide evenly", () => {
    for (const gross of [1, 2, 3, 7, 99, 101, 999, 1999, 12345, 118001, 987654321]) {
      const { baseCents, igvCents } = splitGross(gross);
      assert.equal(baseCents + igvCents, gross, `gross ${gross}`);
    }
  });

  it("rounds the base to the nearest cent of gross / 1.18", () => {
    // 100 / 1.18 = 84.745… → 85; 1999 / 1.18 = 1694.07… → 1694.
    assert.deepEqual(splitGross(100), { grossCents: 100, baseCents: 85, igvCents: 15 });
    assert.deepEqual(splitGross(1999), { grossCents: 1999, baseCents: 1694, igvCents: 305 });
  });

  it("keeps every part non-negative for a single cent", () => {
    const parts = splitGross(1);
    assert.ok(parts.baseCents >= 0 && parts.igvCents >= 0);
  });

  it("stays exact for large totals beyond the int32 range", () => {
    const gross = 5_000_000_000;
    const { baseCents, igvCents } = splitGross(gross);
    assert.equal(baseCents + igvCents, gross);
    assert.equal(baseCents, Math.round(gross / 1.18));
  });
});

describe("fillMissingMonthsInRange", () => {
  it("returns one row per UTC month, zero-filling months without sales", () => {
    const rows = fillMissingMonthsInRange(
      new Date("2026-01-15T00:00:00Z"),
      new Date("2026-04-02T00:00:00Z"),
      [
        { month: "2026-01", salesCents: 11800 },
        { month: "2026-03", salesCents: 23600 },
      ],
    );

    assert.deepEqual(
      rows.map((row) => [row.month, row.grossCents]),
      [
        ["2026-01", 11800],
        ["2026-02", 0],
        ["2026-03", 23600],
        ["2026-04", 0],
      ],
    );
    assert.deepEqual(rows[1], { month: "2026-02", grossCents: 0, baseCents: 0, igvCents: 0 });
  });

  it("crosses the year boundary", () => {
    const rows = fillMissingMonthsInRange(
      new Date("2025-11-01T00:00:00Z"),
      new Date("2026-02-28T23:59:59Z"),
      [],
    );

    assert.deepEqual(
      rows.map((row) => row.month),
      ["2025-11", "2025-12", "2026-01", "2026-02"],
    );
  });

  it("returns a single month when from and to share the month", () => {
    const rows = fillMissingMonthsInRange(
      new Date("2026-05-01T00:00:00Z"),
      new Date("2026-05-31T23:59:59.999Z"),
      [{ month: "2026-05", salesCents: 500 }],
    );

    assert.equal(rows.length, 1);
    assert.equal(rows[0].grossCents, 500);
  });

  it("uses the UTC month, not the local one, at month edges", () => {
    const rows = fillMissingMonthsInRange(
      new Date("2026-01-31T23:59:59.999Z"),
      new Date("2026-02-01T00:00:00Z"),
      [],
    );

    assert.deepEqual(
      rows.map((row) => row.month),
      ["2026-01", "2026-02"],
    );
  });

  it("ignores sales rows outside the range", () => {
    const rows = fillMissingMonthsInRange(
      new Date("2026-03-01T00:00:00Z"),
      new Date("2026-03-31T00:00:00Z"),
      [{ month: "2026-02", salesCents: 999 }],
    );

    assert.deepEqual(
      rows.map((row) => row.grossCents),
      [0],
    );
  });
});

describe("sumTaxBreakdowns", () => {
  it("returns zeros for no rows", () => {
    assert.deepEqual(sumTaxBreakdowns([]), { grossCents: 0, baseCents: 0, igvCents: 0 });
  });

  it("adds each column of the monthly rows", () => {
    const total = sumTaxBreakdowns([splitGross(11800), splitGross(1), splitGross(999)]);
    const expected = [splitGross(11800), splitGross(1), splitGross(999)];

    assert.equal(total.grossCents, 11800 + 1 + 999);
    assert.equal(total.baseCents, expected.reduce((sum, row) => sum + row.baseCents, 0));
    assert.equal(total.igvCents, expected.reduce((sum, row) => sum + row.igvCents, 0));
    assert.equal(total.baseCents + total.igvCents, total.grossCents);
  });
});

describe("estimateIncomeTax", () => {
  it("applies the rate in basis points with rounding", () => {
    assert.equal(estimateIncomeTax(100000, 2950), 29500);
    assert.equal(estimateIncomeTax(333, 2950), 98);
  });

  it("returns 0 for a negative profit", () => {
    assert.equal(estimateIncomeTax(-50000, 2950), 0);
  });

  it("returns 0 for a zero profit", () => {
    assert.equal(estimateIncomeTax(0, 2950), 0);
  });

  it("returns 0 with a 0 rate and the whole profit with a 10000 rate", () => {
    assert.equal(estimateIncomeTax(12345, 0), 0);
    assert.equal(estimateIncomeTax(12345, 10000), 12345);
  });
});
