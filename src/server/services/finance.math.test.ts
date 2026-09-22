import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeMargin } from "./finance.math.ts";

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
