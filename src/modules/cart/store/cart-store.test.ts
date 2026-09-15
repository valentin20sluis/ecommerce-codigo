import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cartItemCount, cartSubtotalCents, type CartItem } from "./cart-store.ts";

function line(overrides: Partial<CartItem>): CartItem {
  return {
    productId: "p1",
    name: "Product",
    slug: "product",
    priceCents: 1000,
    imageUrl: null,
    qty: 1,
    ...overrides,
  };
}

describe("cartSubtotalCents", () => {
  it("sums priceCents * qty across multiple lines", () => {
    const items = [line({ priceCents: 1000, qty: 2 }), line({ priceCents: 500, qty: 3 })];

    assert.equal(cartSubtotalCents(items), 3500);
  });

  it("returns 0 for an empty cart", () => {
    assert.equal(cartSubtotalCents([]), 0);
  });

  it("ignores a line with qty 0 in the total", () => {
    assert.equal(cartSubtotalCents([line({ priceCents: 700, qty: 0 })]), 0);
  });
});

describe("cartItemCount", () => {
  it("sums the qty of every line", () => {
    const items = [line({ qty: 2 }), line({ qty: 3 })];

    assert.equal(cartItemCount(items), 5);
  });

  it("returns 0 for an empty cart", () => {
    assert.equal(cartItemCount([]), 0);
  });
});
