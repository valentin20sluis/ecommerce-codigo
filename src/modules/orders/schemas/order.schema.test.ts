import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { orderFiltersSchema, ordersQuerySchema } from "./order.schema.ts";

describe("ordersQuerySchema", () => {
  it("defaults limit to 50 when omitted", () => {
    const result = ordersQuerySchema.safeParse({});

    assert.equal(result.success, true);
    assert.equal(result.data?.limit, 50);
  });

  it("coerces a string limit to a number", () => {
    const result = ordersQuerySchema.safeParse({ limit: "10" });

    assert.equal(result.success, true);
    assert.equal(result.data?.limit, 10);
  });

  it("rejects a limit above 100", () => {
    assert.equal(ordersQuerySchema.safeParse({ limit: 101 }).success, false);
  });
});

describe("orderFiltersSchema", () => {
  it('defaults period to "month"', () => {
    const result = orderFiltersSchema.safeParse({});

    assert.equal(result.success, true);
    assert.equal(result.data?.period, "month");
  });

  it('accepts period "custom" together with from/to', () => {
    const result = orderFiltersSchema.safeParse({
      period: "custom",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-31T00:00:00.000Z",
    });

    assert.equal(result.success, true);
    assert.equal(result.data?.period, "custom");
  });
});
