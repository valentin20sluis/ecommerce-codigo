import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { currentUtcMonth, recentUtcMonths } from "../profit.ts";
import { profitQuerySchema } from "./profit.schema.ts";

function nextUtcMonth(now: Date): string {
  return currentUtcMonth(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)));
}

describe("profitQuerySchema", () => {
  it("accepts the current UTC month", () => {
    const month = currentUtcMonth(new Date());
    assert.deepEqual(profitQuerySchema.parse({ month }), { month });
  });

  it("accepts a past month 23 months back", () => {
    const month = recentUtcMonths(new Date(), 24)[23];
    assert.equal(profitQuerySchema.safeParse({ month }).success, true);
  });

  it("rejects a missing month", () => {
    assert.equal(profitQuerySchema.safeParse({}).success, false);
  });

  it("rejects month 13", () => {
    assert.equal(profitQuerySchema.safeParse({ month: "2026-13" }).success, false);
  });

  it("rejects month 00", () => {
    assert.equal(profitQuerySchema.safeParse({ month: "2026-00" }).success, false);
  });

  it("rejects a single-digit month", () => {
    assert.equal(profitQuerySchema.safeParse({ month: "2026-1" }).success, false);
  });

  it("rejects years before 2000", () => {
    assert.equal(profitQuerySchema.safeParse({ month: "1999-05" }).success, false);
  });

  it("rejects the month after the current UTC month", () => {
    assert.equal(profitQuerySchema.safeParse({ month: nextUtcMonth(new Date()) }).success, false);
  });

  it("rejects extra text around a valid month", () => {
    assert.equal(profitQuerySchema.safeParse({ month: "2026-01-01" }).success, false);
    assert.equal(profitQuerySchema.safeParse({ month: " 2026-01" }).success, false);
  });
});
