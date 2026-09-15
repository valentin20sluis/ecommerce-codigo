import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toOrderListItemDto } from "./index.ts";

describe("toOrderListItemDto", () => {
  const order = {
    id: "o1",
    userId: "u1",
    status: "paid" as const,
    subtotalCents: 1000,
    totalCents: 1000,
    currency: "pen",
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    createdAt: new Date("2026-01-05T10:00:00.000Z"),
    updatedAt: new Date("2026-01-05T11:00:00.000Z"),
    items: [
      {
        id: "i1",
        orderId: "o1",
        productId: "p1",
        nameSnapshot: "P",
        unitPriceCents: 500,
        qty: 2,
      },
    ],
  };

  it("serializes createdAt and updatedAt Date objects to ISO strings", () => {
    const dto = toOrderListItemDto(order);

    assert.equal(dto.createdAt, "2026-01-05T10:00:00.000Z");
    assert.equal(dto.updatedAt, "2026-01-05T11:00:00.000Z");
  });

  it("keeps the order items untouched in the output", () => {
    const dto = toOrderListItemDto(order);

    assert.deepEqual(dto.items, order.items);
  });
});
