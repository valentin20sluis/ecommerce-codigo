import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toExpenseDto, toRecurringExpenseDto } from "./expense.ts";

describe("toExpenseDto", () => {
  it("keeps the client-facing fields and drops audit columns", () => {
    const dto = toExpenseDto({
      id: "e1",
      category: "rent",
      description: "Alquiler",
      amountCents: 150000,
      incurredOn: "2026-03-01",
      recurringExpenseId: null,
      createdBy: "u1",
      createdAt: new Date("2026-03-01T10:00:00Z"),
      updatedAt: new Date("2026-03-01T10:00:00Z"),
    });

    assert.deepEqual(dto, {
      id: "e1",
      category: "rent",
      description: "Alquiler",
      amountCents: 150000,
      incurredOn: "2026-03-01",
      recurringExpenseId: null,
    });
  });
});

describe("toRecurringExpenseDto", () => {
  const row = {
    id: "r1",
    category: "software" as const,
    description: "Hosting",
    amountCents: 2000,
    dayOfMonth: 15,
    startsOn: "2026-01-01",
    endsOn: null,
    isActive: true,
    generatedThrough: "2026-03-15",
    createdBy: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };

  it("derives the next due date and hides the watermark", () => {
    const dto = toRecurringExpenseDto(row, "2026-03-20");

    assert.equal(dto.nextDueOn, "2026-04-15");
    assert.equal("generatedThrough" in dto, false);
  });

  it("has no next due date when paused", () => {
    assert.equal(toRecurringExpenseDto({ ...row, isActive: false }, "2026-03-20").nextDueOn, null);
  });
});
