process.env.TZ = "America/Lima";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { countOrderUnits, formatOrderTime, groupOrdersByDay } from "./utils.ts";
import type { OrderListItemDto } from "@/modules/orders/types";

function order(overrides: Partial<OrderListItemDto>): OrderListItemDto {
  return {
    id: "o1",
    userId: "u1",
    status: "paid",
    subtotalCents: 0,
    totalCents: 0,
    currency: "pen",
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    createdAt: "2026-01-05T10:00:00.000Z",
    updatedAt: "2026-01-05T10:00:00.000Z",
    items: [],
    ...overrides,
  };
}

describe("groupOrdersByDay", () => {
  it("groups orders that fall on the same local calendar day", () => {
    const orders = [
      order({ id: "o1", createdAt: "2026-01-05T23:30:00.000Z" }),
      order({ id: "o2", createdAt: "2026-01-05T10:00:00.000Z" }),
    ];

    const groups = groupOrdersByDay(orders);

    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.dayKey, "2026-01-05");
    assert.equal(groups[0]?.orders.length, 2);
  });

  it("keeps orders from different days in separate groups", () => {
    const orders = [
      order({ id: "o1", createdAt: "2026-01-05T10:00:00.000Z" }),
      order({ id: "o2", createdAt: "2026-01-04T09:00:00.000Z" }),
    ];

    const groups = groupOrdersByDay(orders);

    assert.deepEqual(groups.map((group) => group.dayKey), ["2026-01-05", "2026-01-04"]);
  });

  it("preserves the incoming order of orders within a day group", () => {
    const orders = [
      order({ id: "first", createdAt: "2026-01-05T23:30:00.000Z" }),
      order({ id: "second", createdAt: "2026-01-05T10:00:00.000Z" }),
    ];

    const groups = groupOrdersByDay(orders);

    assert.deepEqual(
      groups[0]?.orders.map((entry) => entry.id),
      ["first", "second"],
    );
  });

  it("returns an empty array for an empty order list", () => {
    assert.deepEqual(groupOrdersByDay([]), []);
  });
});

describe("formatOrderTime", () => {
  it("formats an ISO timestamp as local HH:mm", () => {
    assert.equal(formatOrderTime("2026-01-05T23:30:00.000Z"), "18:30");
  });
});

describe("countOrderUnits", () => {
  it("sums the qty of every item in an order", () => {
    const withItems = order({ items: [{ id: "i1", orderId: "o1", productId: "p1", nameSnapshot: "A", unitPriceCents: 100, costCentsSnapshot: null, qty: 2 }, { id: "i2", orderId: "o1", productId: "p2", nameSnapshot: "B", unitPriceCents: 200, costCentsSnapshot: null, qty: 1 }] });

    assert.equal(countOrderUnits(withItems), 3);
  });

  it("returns 0 for an order with no items", () => {
    assert.equal(countOrderUnits(order({ items: [] })), 0);
  });
});
