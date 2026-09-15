import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cn, formatPriceFromCents, slugify, toCents } from "./utils.ts";

describe("formatPriceFromCents", () => {
  it("formats an integer cents amount with two decimals", () => {
    assert.equal(formatPriceFromCents(1999), "19,99");
  });

  it("formats zero cents as 0,00", () => {
    assert.equal(formatPriceFromCents(0), "0,00");
  });

  it("formats a negative amount", () => {
    assert.equal(formatPriceFromCents(-500), "-5,00");
  });
});

describe("toCents", () => {
  it("converts a dot-decimal string to integer cents", () => {
    assert.equal(toCents("19.99"), 1999);
  });

  it("converts a comma-decimal string to integer cents", () => {
    assert.equal(toCents("19,99"), 1999);
  });

  it("rounds .995 up instead of truncating (floating point safety)", () => {
    assert.equal(toCents("19.995"), 2000);
  });

  it("returns NaN for an empty string", () => {
    assert.ok(Number.isNaN(toCents("")));
  });

  it("returns NaN for a non-numeric string", () => {
    assert.ok(Number.isNaN(toCents("abc")));
  });
});

describe("slugify", () => {
  it("lowercases, strips accents and hyphenates a plain phrase", () => {
    assert.equal(slugify("Audio & Vídeo"), "audio-video");
  });

  it("collapses repeated separators and trims leading/trailing hyphens", () => {
    assert.equal(slugify("--Hola Mundo--"), "hola-mundo");
  });

  it("returns an empty string for an all-symbol input", () => {
    assert.equal(slugify("***"), "");
  });
});

describe("cn", () => {
  it("merges class names and resolves conflicting Tailwind utilities", () => {
    assert.equal(cn("px-2 py-1", "px-4"), "py-1 px-4");
  });
});
