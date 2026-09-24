import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveExpenseRange, toLocalDateString } from "./expense-range.ts";

describe("toLocalDateString", () => {
  it("returns the local calendar day of an instant, not the UTC slice", () => {
    assert.equal(toLocalDateString(new Date(2026, 2, 1).toISOString()), "2026-03-01");
  });
});

describe("resolveExpenseRange", () => {
  it("resolves 'this_month' from the 1st (UTC) to today", () => {
    const now = new Date(2026, 2, 15, 10, 30);

    assert.deepEqual(resolveExpenseRange({ preset: "this_month" }, now), {
      from: "2026-03-01",
      to: now.toISOString().slice(0, 10),
    });
  });

  it("resolves 'last_month' to the whole previous calendar month", () => {
    assert.deepEqual(resolveExpenseRange({ preset: "last_month" }, new Date(2026, 2, 15)), {
      from: "2026-02-01",
      to: "2026-02-28",
    });
  });

  it("uses the LOCAL day of the calendar picks for a custom range (no off-by-one east of UTC)", () => {
    const range = resolveExpenseRange({
      preset: "custom",
      from: new Date(2026, 2, 1).toISOString(),
      to: new Date(2026, 2, 5, 23, 59, 59, 999).toISOString(),
    });

    assert.deepEqual(range, { from: "2026-03-01", to: "2026-03-05" });
  });

  it("returns null for a half-picked custom range", () => {
    assert.equal(
      resolveExpenseRange({ preset: "custom", from: new Date(2026, 2, 1).toISOString() }),
      null,
    );
  });
});
