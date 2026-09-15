import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cardBrandLabel, formatExpiry, isExpired } from "./constants.ts";

describe("cardBrandLabel", () => {
  it("returns the mapped label for a known brand", () => {
    assert.equal(cardBrandLabel("visa"), "Visa");
  });

  it("capitalizes an unmapped brand as a fallback", () => {
    assert.equal(cardBrandLabel("unknown-brand-x"), "Unknown-brand-x");
  });
});

describe("formatExpiry", () => {
  it("pads a single-digit month with a leading zero", () => {
    assert.equal(formatExpiry(3, 2027), "03/2027");
  });

  it("keeps a two-digit month unpadded", () => {
    assert.equal(formatExpiry(11, 2027), "11/2027");
  });
});

describe("isExpired", () => {
  it("returns false for a card expiring after the reference date", () => {
    assert.equal(isExpired(6, 2026, new Date(2026, 4, 15)), false);
  });

  it("returns true for a card whose expiration month has fully elapsed", () => {
    assert.equal(isExpired(6, 2026, new Date(2026, 6, 15)), true);
  });

  it("treats the card as expired at the first instant of the month after expiry (boundary)", () => {
    assert.equal(isExpired(6, 2026, new Date(2026, 6, 1, 0, 0, 0, 0)), true);
    assert.equal(isExpired(6, 2026, new Date(2026, 6, 1, 0, 0, 0, -1)), false);
  });
});
