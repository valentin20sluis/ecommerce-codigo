import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { costFormSchema, toUpdateCostInput, updateCostSchema } from "./unit-price.schema.ts";

describe("updateCostSchema", () => {
  it("accepts a positive integer cost", () => {
    assert.equal(updateCostSchema.safeParse({ costCents: 6000 }).success, true);
  });

  it("accepts an explicit null to clear the cost", () => {
    const result = updateCostSchema.safeParse({ costCents: null });
    assert.equal(result.success, true);
    assert.equal(result.data?.costCents, null);
  });

  it("rejects a negative cost", () => {
    assert.equal(updateCostSchema.safeParse({ costCents: -1 }).success, false);
  });

  it("rejects a non-integer cost", () => {
    assert.equal(updateCostSchema.safeParse({ costCents: 12.5 }).success, false);
  });
});

describe("costFormSchema", () => {
  it("accepts an empty string as 'no cost'", () => {
    assert.equal(costFormSchema.safeParse({ cost: "" }).success, true);
  });

  it("accepts a decimal amount with a comma", () => {
    assert.equal(costFormSchema.safeParse({ cost: "19,99" }).success, true);
  });

  it("rejects text that is not a number", () => {
    assert.equal(costFormSchema.safeParse({ cost: "abc" }).success, false);
  });
});

describe("toUpdateCostInput", () => {
  it("converts an empty string to a null cost", () => {
    assert.deepEqual(toUpdateCostInput({ cost: "" }), { costCents: null });
  });

  it("converts a decimal amount to integer cents", () => {
    assert.deepEqual(toUpdateCostInput({ cost: "19.99" }), { costCents: 1999 });
  });

  it("converts a comma decimal to integer cents", () => {
    assert.deepEqual(toUpdateCostInput({ cost: "19,99" }), { costCents: 1999 });
  });
});
