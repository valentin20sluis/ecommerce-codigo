import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { currentUtcMonth, monthToUtcRange, recentUtcMonths } from "./profit.ts";

describe("monthToUtcRange", () => {
  it("covers a leap February up to its last millisecond", () => {
    const { from, to } = monthToUtcRange("2024-02");

    assert.equal(from.toISOString(), "2024-02-01T00:00:00.000Z");
    assert.equal(to.toISOString(), "2024-02-29T23:59:59.999Z");
  });

  it("ends a non-leap February on the 28th", () => {
    assert.equal(monthToUtcRange("2025-02").to.toISOString(), "2025-02-28T23:59:59.999Z");
  });

  it("closes December on the 31st of the same year", () => {
    const { from, to } = monthToUtcRange("2025-12");

    assert.equal(from.toISOString(), "2025-12-01T00:00:00.000Z");
    assert.equal(to.toISOString(), "2025-12-31T23:59:59.999Z");
  });

  it("starts January on the 1st of the same year", () => {
    assert.equal(monthToUtcRange("2026-01").from.toISOString(), "2026-01-01T00:00:00.000Z");
  });
});

describe("currentUtcMonth", () => {
  it("uses the UTC month, not the local one", () => {
    assert.equal(currentUtcMonth(new Date("2026-03-31T23:30:00-05:00")), "2026-04");
  });

  it("pads single-digit months", () => {
    assert.equal(currentUtcMonth(new Date("2026-01-15T12:00:00Z")), "2026-01");
  });
});

describe("recentUtcMonths", () => {
  it("returns the requested count starting with the current month", () => {
    const months = recentUtcMonths(new Date("2026-09-24T00:00:00Z"), 24);

    assert.equal(months.length, 24);
    assert.equal(months[0], "2026-09");
    assert.equal(months[23], "2024-10");
  });

  it("crosses the year boundary backwards", () => {
    assert.deepEqual(recentUtcMonths(new Date("2026-02-10T00:00:00Z"), 3), [
      "2026-02",
      "2026-01",
      "2025-12",
    ]);
  });

  it("returns an empty list for a zero or negative count", () => {
    assert.deepEqual(recentUtcMonths(new Date("2026-02-10T00:00:00Z"), 0), []);
    assert.deepEqual(recentUtcMonths(new Date("2026-02-10T00:00:00Z"), -1), []);
  });
});
