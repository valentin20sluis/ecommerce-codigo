import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { revenueFiltersSchema, revenueQuerySchema } from "./revenue.schema.ts";

describe("revenueQuerySchema", () => {
  it("accepts a valid from/to range", () => {
    const result = revenueQuerySchema.safeParse({
      from: "2026-03-01T00:00:00.000Z",
      to: "2026-03-31T23:59:59.999Z",
    });
    assert.equal(result.success, true);
  });

  it("rejects when to is before from", () => {
    const result = revenueQuerySchema.safeParse({
      from: "2026-03-31T00:00:00.000Z",
      to: "2026-03-01T00:00:00.000Z",
    });
    assert.equal(result.success, false);
  });

  it("rejects a missing from", () => {
    assert.equal(revenueQuerySchema.safeParse({ to: "2026-03-31T00:00:00.000Z" }).success, false);
  });

  it("rejects a non-ISO date string", () => {
    assert.equal(
      revenueQuerySchema.safeParse({ from: "not-a-date", to: "2026-03-31T00:00:00.000Z" }).success,
      false,
    );
  });
});

describe("revenueFiltersSchema", () => {
  it("defaults preset to 'this_month' when absent", () => {
    const result = revenueFiltersSchema.safeParse({});
    assert.equal(result.success, true);
    assert.equal(result.data?.preset, "this_month");
  });

  it("accepts a custom preset with from/to", () => {
    const result = revenueFiltersSchema.safeParse({
      preset: "custom",
      from: "2026-03-01T00:00:00.000Z",
      to: "2026-03-15T00:00:00.000Z",
    });
    assert.equal(result.success, true);
  });

  it("accepts a custom preset with no from/to yet (range not picked)", () => {
    assert.equal(revenueFiltersSchema.safeParse({ preset: "custom" }).success, true);
  });
});
