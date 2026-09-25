import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { currentUtcMonth } from "../profit.ts";
import { accountingQuerySchema } from "./accounting.schema.ts";

const MONTH = "2026-02";

function nextUtcMonth(now: Date): string {
  return currentUtcMonth(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)));
}

function accepts(input: Record<string, string>): boolean {
  return accountingQuerySchema.safeParse(input).success;
}

describe("accountingQuerySchema", () => {
  it("defaults to page 1 when page is missing", () => {
    assert.deepEqual(accountingQuerySchema.parse({ month: MONTH }), { month: MONTH, page: 1 });
  });

  it("coerces a page sent as query string text", () => {
    assert.deepEqual(accountingQuerySchema.parse({ month: MONTH, page: "3" }), { month: MONTH, page: 3 });
  });

  it("accepts the current UTC month", () => {
    assert.equal(accepts({ month: currentUtcMonth(new Date()) }), true);
  });

  it("rejects a missing month", () => {
    assert.equal(accepts({ page: "1" }), false);
  });

  it("rejects a malformed month", () => {
    assert.equal(accepts({ month: "2026-2" }), false);
  });

  it("rejects a future month", () => {
    assert.equal(accepts({ month: nextUtcMonth(new Date()) }), false);
  });

  it("rejects page 0", () => {
    assert.equal(accepts({ month: MONTH, page: "0" }), false);
  });

  it("rejects a negative page", () => {
    assert.equal(accepts({ month: MONTH, page: "-1" }), false);
  });

  it("rejects a fractional page", () => {
    assert.equal(accepts({ month: MONTH, page: "1.5" }), false);
  });

  it("rejects a non-numeric page", () => {
    assert.equal(accepts({ month: MONTH, page: "abc" }), false);
  });

  it("rejects an empty page", () => {
    assert.equal(accepts({ month: MONTH, page: "" }), false);
  });

  it("drops a client-sent page size instead of honouring it", () => {
    const parsed = accountingQuerySchema.parse({ month: MONTH, pageSize: "500" });
    assert.equal("pageSize" in parsed, false);
  });
});
