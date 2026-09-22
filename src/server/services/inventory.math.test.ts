import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aggregateOrderQuantities,
  automaticMovementDelta,
  manualMovementDelta,
  manualMovementReason,
  pendingOrderLines,
} from "./inventory.math.ts";

describe("manualMovementDelta", () => {
  it("returns a negative delta when the physical count is below the expected stock", () => {
    assert.equal(
      manualMovementDelta({
        type: "adjustment",
        countedStock: 7,
        expectedStock: 10,
        reason: "conteo físico",
      }),
      -3,
    );
  });

  it("returns a positive delta when the physical count is above the expected stock", () => {
    assert.equal(
      manualMovementDelta({
        type: "adjustment",
        countedStock: 12,
        expectedStock: 10,
        reason: "conteo físico",
      }),
      2,
    );
  });

  it("returns 0 when the physical count matches the expected stock", () => {
    assert.equal(
      manualMovementDelta({
        type: "adjustment",
        countedStock: 10,
        expectedStock: 10,
        reason: "conteo físico",
      }),
      0,
    );
  });

  it("brings an oversold product back to zero with a positive delta", () => {
    assert.equal(
      manualMovementDelta({
        type: "adjustment",
        countedStock: 0,
        expectedStock: -2,
        reason: "regularización de sobreventa",
      }),
      2,
    );
  });

  it("always subtracts for a waste movement", () => {
    assert.equal(manualMovementDelta({ type: "waste", qty: 3, reason: "rotura" }), -3);
  });

  it("always adds for a restock movement", () => {
    assert.equal(manualMovementDelta({ type: "restock", qty: 3, reason: "compra" }), 3);
  });

  it("keeps the smallest valid quantity at one unit for waste and restock", () => {
    assert.equal(manualMovementDelta({ type: "waste", qty: 1, reason: "rotura" }), -1);
    assert.equal(manualMovementDelta({ type: "restock", qty: 1 }), 1);
  });
});

describe("manualMovementReason", () => {
  it("keeps the reason of an adjustment", () => {
    assert.equal(
      manualMovementReason({
        type: "adjustment",
        countedStock: 7,
        expectedStock: 10,
        reason: "conteo físico",
      }),
      "conteo físico",
    );
  });

  it("keeps the reason of a waste movement", () => {
    assert.equal(manualMovementReason({ type: "waste", qty: 2, reason: "rotura" }), "rotura");
  });

  it("returns null for a restock with no reason", () => {
    assert.equal(manualMovementReason({ type: "restock", qty: 2 }), null);
  });

  it("keeps the reason of a restock when it was given", () => {
    assert.equal(manualMovementReason({ type: "restock", qty: 2, reason: "compra" }), "compra");
  });
});

describe("automaticMovementDelta", () => {
  it("subtracts the sold units", () => {
    assert.equal(automaticMovementDelta("sale", 2), -2);
  });

  it("adds back the returned units", () => {
    assert.equal(automaticMovementDelta("return", 2), 2);
  });

  it("gives a sale and its return opposite signs for the same quantity", () => {
    assert.equal(automaticMovementDelta("sale", 5) + automaticMovementDelta("return", 5), 0);
  });
});

describe("aggregateOrderQuantities", () => {
  it("merges two lines of the same product into a single quantity", () => {
    const lines = [
      { productId: "p1", qty: 2 },
      { productId: "p1", qty: 3 },
    ];

    assert.deepEqual(aggregateOrderQuantities(lines), [{ productId: "p1", qty: 5 }]);
  });

  it("keeps different products apart", () => {
    const lines = [
      { productId: "p1", qty: 2 },
      { productId: "p2", qty: 1 },
    ];

    assert.deepEqual(aggregateOrderQuantities(lines), lines);
  });

  it("preserves the order of first appearance", () => {
    const lines = [
      { productId: "p2", qty: 1 },
      { productId: "p1", qty: 1 },
      { productId: "p2", qty: 4 },
    ];

    assert.deepEqual(
      aggregateOrderQuantities(lines).map((line) => line.productId),
      ["p2", "p1"],
    );
  });

  it("returns an empty array for an order with no lines", () => {
    assert.deepEqual(aggregateOrderQuantities([]), []);
  });
});

describe("pendingOrderLines", () => {
  const lines = [
    { productId: "p1", qty: 2 },
    { productId: "p2", qty: 1 },
  ];

  it("returns every aggregated line when nothing was recorded yet", () => {
    assert.deepEqual(pendingOrderLines(lines, []), lines);
  });

  it("returns nothing when every product already has its movement (webhook redelivery)", () => {
    assert.deepEqual(pendingOrderLines(lines, ["p1", "p2"]), []);
  });

  it("returns only the products left after a partial write", () => {
    assert.deepEqual(pendingOrderLines(lines, ["p1"]), [{ productId: "p2", qty: 1 }]);
  });

  it("aggregates repeated lines of the same product before filtering", () => {
    const repeated = [
      { productId: "p1", qty: 2 },
      { productId: "p1", qty: 3 },
    ];

    assert.deepEqual(pendingOrderLines(repeated, []), [{ productId: "p1", qty: 5 }]);
  });

  it("drops the whole product once it was recorded, even if it came in two lines", () => {
    const repeated = [
      { productId: "p1", qty: 2 },
      { productId: "p1", qty: 3 },
    ];

    assert.deepEqual(pendingOrderLines(repeated, ["p1"]), []);
  });

  it("ignores a recorded product that is not part of the order", () => {
    assert.deepEqual(pendingOrderLines(lines, ["p9"]), lines);
  });

  it("returns an empty array for an order with no lines", () => {
    assert.deepEqual(pendingOrderLines([], ["p1"]), []);
  });
});
