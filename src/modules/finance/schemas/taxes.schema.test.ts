import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatRateBpsAsPercent,
  incomeTaxRateFormSchema,
  toUpdateTaxSettingsInput,
  updateTaxSettingsSchema,
} from "./taxes.schema.ts";

describe("updateTaxSettingsSchema", () => {
  it("accepts the 0 and 10000 limits", () => {
    assert.equal(updateTaxSettingsSchema.safeParse({ incomeTaxRateBps: 0 }).success, true);
    assert.equal(updateTaxSettingsSchema.safeParse({ incomeTaxRateBps: 10000 }).success, true);
  });

  it("rejects values outside 0-10000", () => {
    assert.equal(updateTaxSettingsSchema.safeParse({ incomeTaxRateBps: -1 }).success, false);
    assert.equal(updateTaxSettingsSchema.safeParse({ incomeTaxRateBps: 10001 }).success, false);
  });

  it("rejects non-integer and non-numeric values", () => {
    assert.equal(updateTaxSettingsSchema.safeParse({ incomeTaxRateBps: 29.5 }).success, false);
    assert.equal(updateTaxSettingsSchema.safeParse({ incomeTaxRateBps: "2950" }).success, false);
    assert.equal(updateTaxSettingsSchema.safeParse({}).success, false);
  });

  it("rejects extra fields", () => {
    assert.equal(
      updateTaxSettingsSchema.safeParse({ incomeTaxRateBps: 2950, igvRateBps: 1800 }).success,
      false,
    );
  });
});

describe("incomeTaxRateFormSchema", () => {
  it("accepts percentages with up to two decimals and a comma separator", () => {
    for (const rate of ["29.5", "29,50", "0", "100", "10.25"]) {
      assert.equal(incomeTaxRateFormSchema.safeParse({ rate }).success, true, rate);
    }
  });

  it("rejects empty, negative, three-decimal and text input", () => {
    for (const rate of ["", "-1", "29.555", "abc"]) {
      assert.equal(incomeTaxRateFormSchema.safeParse({ rate }).success, false, rate);
    }
  });

  it("rejects percentages above 100", () => {
    assert.equal(incomeTaxRateFormSchema.safeParse({ rate: "100.01" }).success, false);
    assert.equal(incomeTaxRateFormSchema.safeParse({ rate: "150" }).success, false);
  });
});

describe("toUpdateTaxSettingsInput", () => {
  it("converts a percentage to basis points without float drift", () => {
    assert.deepEqual(toUpdateTaxSettingsInput({ rate: "29.5" }), { incomeTaxRateBps: 2950 });
    assert.deepEqual(toUpdateTaxSettingsInput({ rate: "10,25" }), { incomeTaxRateBps: 1025 });
    assert.deepEqual(toUpdateTaxSettingsInput({ rate: "0.07" }), { incomeTaxRateBps: 7 });
    assert.deepEqual(toUpdateTaxSettingsInput({ rate: "100" }), { incomeTaxRateBps: 10000 });
  });
});

describe("formatRateBpsAsPercent", () => {
  it("renders basis points as a plain percentage", () => {
    assert.equal(formatRateBpsAsPercent(2950), "29.5");
    assert.equal(formatRateBpsAsPercent(1025), "10.25");
    assert.equal(formatRateBpsAsPercent(0), "0");
  });
});
