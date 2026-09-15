import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { diffChanges, isSecurityAction, maskSensitive, REDACTED } from "./audit.rules.ts";

describe("maskSensitive", () => {
  it("redacts a top-level key that matches a sensitive fragment", () => {
    assert.deepEqual(maskSensitive({ password: "x", name: "ok" }), {
      password: REDACTED,
      name: "ok",
    });
  });

  it("redacts a sensitive key nested inside an object", () => {
    assert.deepEqual(maskSensitive({ user: { apiKey: "abc", id: 1 } }), {
      user: { apiKey: REDACTED, id: 1 },
    });
  });

  it("redacts sensitive keys inside array items", () => {
    assert.deepEqual(maskSensitive([{ token: "t" }, { ok: 1 }]), [{ token: REDACTED }, { ok: 1 }]);
  });

  it("serializes a Date to an ISO string instead of masking it", () => {
    const date = new Date("2026-01-01T00:00:00.000Z");

    assert.deepEqual(maskSensitive({ createdAt: date }), { createdAt: "2026-01-01T00:00:00.000Z" });
  });

  it("redacts anything past the max recursion depth, even a non-sensitive leaf", () => {
    type Nested = { a: { b: { c: { d: { e: { f: { g: { h: { i: unknown } } } } } } } } };
    const deeplyNested = { a: { b: { c: { d: { e: { f: { g: { h: { i: 1 } } } } } } } } };

    const masked = maskSensitive(deeplyNested) as Nested;

    assert.equal(masked.a.b.c.d.e.f.g.h.i, REDACTED);
  });
});

describe("diffChanges", () => {
  it("returns null when nothing changed", () => {
    assert.equal(diffChanges({ a: 1 }, { a: 1 }), null);
  });

  it("keeps only the keys that changed", () => {
    assert.deepEqual(diffChanges({ a: 1, b: 2 }, { a: 1, b: 3 }), {
      before: { b: 2 },
      after: { b: 3 },
    });
  });

  it("treats a missing key as null on the side that lacks it", () => {
    assert.deepEqual(diffChanges({}, { a: 1 }), { before: { a: null }, after: { a: 1 } });
  });
});

describe("isSecurityAction", () => {
  it("recognizes an auth.* action as a security action", () => {
    assert.equal(isSecurityAction("auth.login_failed"), true);
  });

  it("does not treat an unrelated action as a security action", () => {
    assert.equal(isSecurityAction("product.created"), false);
  });
});
