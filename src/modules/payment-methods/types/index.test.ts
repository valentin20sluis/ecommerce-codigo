import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toPaymentMethodDto } from "./index.ts";

describe("toPaymentMethodDto", () => {
  const card = {
    id: "pm1",
    userId: "u1",
    stripePaymentMethodId: "pm_123",
    brand: "visa",
    last4: "4242",
    expMonth: 8,
    expYear: 2028,
    createdAt: new Date("2026-01-05T10:00:00.000Z"),
  };

  it("omits userId and stripePaymentMethodId from the output", () => {
    const dto = toPaymentMethodDto(card);

    assert.equal("userId" in dto, false);
    assert.equal("stripePaymentMethodId" in dto, false);
  });

  it("serializes createdAt to an ISO string and keeps the rest of the fields", () => {
    const dto = toPaymentMethodDto(card);

    assert.deepEqual(dto, {
      id: "pm1",
      brand: "visa",
      last4: "4242",
      expMonth: 8,
      expYear: 2028,
      createdAt: "2026-01-05T10:00:00.000Z",
    });
  });
});
