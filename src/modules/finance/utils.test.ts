import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeMargin,
  fillMissingDaysInRange,
  resolveDateRangePreset,
  resolveMarginCoverage,
} from "./utils.ts";

describe("computeMargin", () => {
  it("returns null margin when there is no cost loaded", () => {
    assert.deepEqual(computeMargin(10000, null), { marginCents: null, marginPercent: null });
  });

  it("computes margin cents and percent for a typical product", () => {
    assert.deepEqual(computeMargin(10000, 6000), { marginCents: 4000, marginPercent: 40 });
  });

  it("rounds marginPercent to one decimal", () => {
    assert.deepEqual(computeMargin(3000, 1000), { marginCents: 2000, marginPercent: 66.7 });
  });

  it("returns a negative margin when cost is above price, without clamping", () => {
    assert.deepEqual(computeMargin(1000, 1500), { marginCents: -500, marginPercent: -50 });
  });

  it("treats a zero cost as a real cost, not as 'no data'", () => {
    assert.deepEqual(computeMargin(1000, 0), { marginCents: 1000, marginPercent: 100 });
  });

  it("does not divide by zero when priceCents is zero", () => {
    assert.deepEqual(computeMargin(0, 0), { marginCents: 0, marginPercent: 0 });
  });
});

describe("resolveMarginCoverage", () => {
  it("returns null margin and 0% coverage when nothing has a known cost", () => {
    assert.deepEqual(resolveMarginCoverage(0, 0, 50000), { marginCents: null, marginCoveragePercent: 0 });
  });

  it("returns full coverage when every cent of revenue has a known cost", () => {
    assert.deepEqual(resolveMarginCoverage(20000, 50000, 50000), {
      marginCents: 20000,
      marginCoveragePercent: 100,
    });
  });

  it("computes partial coverage rounded to one decimal", () => {
    assert.deepEqual(resolveMarginCoverage(10000, 25000, 75000), {
      marginCents: 10000,
      marginCoveragePercent: 33.3,
    });
  });

  it("treats zero total revenue as 0% coverage without dividing by zero", () => {
    assert.deepEqual(resolveMarginCoverage(0, 0, 0), { marginCents: null, marginCoveragePercent: 0 });
  });
});

describe("fillMissingDaysInRange", () => {
  it("fills every day of a 3-day range with 0 when there are no rows", () => {
    const from = new Date(Date.UTC(2026, 2, 1));
    const to = new Date(Date.UTC(2026, 2, 3));

    assert.deepEqual(fillMissingDaysInRange(from, to, []), [
      { date: "2026-03-01", revenueCents: 0 },
      { date: "2026-03-02", revenueCents: 0 },
      { date: "2026-03-03", revenueCents: 0 },
    ]);
  });

  it("keeps the known days and zero-fills the gaps", () => {
    const from = new Date(Date.UTC(2026, 2, 1));
    const to = new Date(Date.UTC(2026, 2, 3));
    const rows = [{ date: "2026-03-02", salesCents: 5000 }];

    assert.deepEqual(fillMissingDaysInRange(from, to, rows), [
      { date: "2026-03-01", revenueCents: 0 },
      { date: "2026-03-02", revenueCents: 5000 },
      { date: "2026-03-03", revenueCents: 0 },
    ]);
  });

  it("returns a single point for a same-day range", () => {
    const day = new Date(Date.UTC(2026, 2, 1));

    assert.deepEqual(fillMissingDaysInRange(day, day, []), [{ date: "2026-03-01", revenueCents: 0 }]);
  });
});

describe("resolveDateRangePreset", () => {
  it("resolves 'this_month' from day 1 (UTC) to now", () => {
    const now = new Date(2026, 2, 15, 10, 30);

    assert.deepEqual(resolveDateRangePreset("this_month", now), {
      from: new Date(Date.UTC(2026, 2, 1)).toISOString(),
      to: now.toISOString(),
    });
  });

  it("resolves 'last_month' as the full previous calendar month, not a rolling window", () => {
    const now = new Date(2026, 2, 15);

    assert.deepEqual(resolveDateRangePreset("last_month", now), {
      from: new Date(Date.UTC(2026, 1, 1)).toISOString(),
      to: new Date(Date.UTC(2026, 2, 1) - 1).toISOString(),
    });
  });

  it("resolves 'last_month' across a year boundary", () => {
    const now = new Date(2026, 0, 20);

    assert.deepEqual(resolveDateRangePreset("last_month", now), {
      from: new Date(Date.UTC(2025, 11, 1)).toISOString(),
      to: new Date(Date.UTC(2026, 0, 1) - 1).toISOString(),
    });
  });

  it("resolves 'last_month' to exactly the days in that month, not one extra (final review I1)", () => {
    // Febrero 2026 no es bisiesto: 28 días. Antes del fix daba 29 (arrastraba
    // el primer día de marzo porque `to` era el inicio exclusivo del mes
    // siguiente, no el último instante del mes anterior).
    const now = new Date(2026, 2, 10);
    const range = resolveDateRangePreset("last_month", now);

    const points = fillMissingDaysInRange(new Date(range.from), new Date(range.to), []);

    assert.equal(points.length, 28);
    assert.equal(points[0].date, "2026-02-01");
    assert.equal(points[27].date, "2026-02-28");
  });

  it("resolves 'this_quarter' to the start of the current quarter", () => {
    const now = new Date(2026, 7, 10);

    assert.deepEqual(resolveDateRangePreset("this_quarter", now), {
      from: new Date(Date.UTC(2026, 6, 1)).toISOString(),
      to: now.toISOString(),
    });
  });

  it("resolves 'this_year' to January 1st", () => {
    const now = new Date(2026, 10, 1);

    assert.deepEqual(resolveDateRangePreset("this_year", now), {
      from: new Date(Date.UTC(2026, 0, 1)).toISOString(),
      to: now.toISOString(),
    });
  });
});
