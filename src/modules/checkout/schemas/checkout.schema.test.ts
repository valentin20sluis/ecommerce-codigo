import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCheckoutSessionSchema } from "./checkout.schema.ts";

const PRODUCT_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

function items(count: number, qty = 1) {
  return Array.from({ length: count }, () => ({ productId: PRODUCT_ID, qty }));
}

describe("createCheckoutSessionSchema", () => {
  it("accepts between one and fifty valid line items", () => {
    assert.equal(createCheckoutSessionSchema.safeParse({ items: items(1) }).success, true);
    assert.equal(createCheckoutSessionSchema.safeParse({ items: items(50) }).success, true);
  });

  it("rejects an empty items array", () => {
    assert.equal(createCheckoutSessionSchema.safeParse({ items: [] }).success, false);
  });

  it("rejects more than fifty line items", () => {
    assert.equal(createCheckoutSessionSchema.safeParse({ items: items(51) }).success, false);
  });

  it("rejects a qty of 0 or above 99", () => {
    assert.equal(createCheckoutSessionSchema.safeParse({ items: items(1, 0) }).success, false);
    assert.equal(createCheckoutSessionSchema.safeParse({ items: items(1, 100) }).success, false);
    assert.equal(createCheckoutSessionSchema.safeParse({ items: items(1, 99) }).success, true);
  });

  it("strips a smuggled price field instead of trusting the client", () => {
    const result = createCheckoutSessionSchema.safeParse({
      items: [{ productId: PRODUCT_ID, qty: 1, priceCents: 100 }],
    });

    assert.equal(result.success, true);
    assert.equal("priceCents" in (result.data?.items[0] ?? {}), false);
  });
});
