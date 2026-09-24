import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  dueOccurrences,
  lastOccurrenceOnOrBefore,
  minStartsOn,
  nextDueOn,
  occurrenceDate,
  toUtcDateString,
} from "./recurring.ts";

describe("toUtcDateString", () => {
  it("returns the UTC calendar day", () => {
    assert.equal(toUtcDateString(new Date(Date.UTC(2026, 2, 5, 23, 59))), "2026-03-05");
  });
});

describe("occurrenceDate", () => {
  it("keeps a day that exists in the month", () => {
    assert.equal(occurrenceDate(2026, 3, 5), "2026-03-05");
  });

  it("clamps day 31 to the last day of a 30-day month", () => {
    assert.equal(occurrenceDate(2026, 4, 31), "2026-04-30");
  });

  it("clamps day 31 to Feb 28 in a common year", () => {
    assert.equal(occurrenceDate(2026, 2, 31), "2026-02-28");
  });

  it("clamps day 31 to Feb 29 in a leap year", () => {
    assert.equal(occurrenceDate(2028, 2, 31), "2028-02-29");
  });
});

describe("dueOccurrences", () => {
  const monthEnd = { dayOfMonth: 31, startsOn: "2026-01-31", endsOn: null, generatedThrough: null };

  it("generates every occurrence from the start up to today, clamped in short months", () => {
    assert.deepEqual(dueOccurrences(monthEnd, "2026-04-15"), [
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
  });

  it("only returns what is after the watermark", () => {
    assert.deepEqual(dueOccurrences({ ...monthEnd, generatedThrough: "2026-02-28" }, "2026-04-15"), [
      "2026-03-31",
    ]);
  });

  it("does not regenerate anything at or before the watermark (a deleted occurrence stays deleted)", () => {
    assert.deepEqual(dueOccurrences({ ...monthEnd, generatedThrough: "2026-03-31" }, "2026-04-15"), []);
  });

  it("is idempotent: after generating up to the last date, nothing is due", () => {
    const first = dueOccurrences(monthEnd, "2026-04-15");
    const wm = first[first.length - 1];
    assert.deepEqual(dueOccurrences({ ...monthEnd, generatedThrough: wm }, "2026-04-15"), []);
  });

  it("stops at endsOn", () => {
    assert.deepEqual(dueOccurrences({ ...monthEnd, endsOn: "2026-02-28" }, "2026-04-15"), [
      "2026-01-31",
      "2026-02-28",
    ]);
  });

  it("skips the first month's occurrence when it falls before startsOn", () => {
    const w = { dayOfMonth: 5, startsOn: "2026-03-20", endsOn: null, generatedThrough: null };

    assert.deepEqual(dueOccurrences(w, "2026-05-10"), ["2026-04-05", "2026-05-05"]);
  });

  it("returns nothing when today is before the start", () => {
    const w = { dayOfMonth: 1, startsOn: "2026-06-01", endsOn: null, generatedThrough: null };

    assert.deepEqual(dueOccurrences(w, "2026-05-01"), []);
  });

  it("includes an occurrence that falls exactly on today", () => {
    const w = { dayOfMonth: 15, startsOn: "2026-03-01", endsOn: null, generatedThrough: null };

    assert.deepEqual(dueOccurrences(w, "2026-03-15"), ["2026-03-15"]);
  });
});

describe("lastOccurrenceOnOrBefore", () => {
  const w = { dayOfMonth: 5, startsOn: "2026-01-01", endsOn: null };

  it("returns this month's occurrence once it has passed", () => {
    assert.equal(lastOccurrenceOnOrBefore(w, "2026-03-10"), "2026-03-05");
  });

  it("returns last month's occurrence when this month's has not happened yet", () => {
    assert.equal(lastOccurrenceOnOrBefore(w, "2026-03-04"), "2026-02-05");
  });

  it("returns null when nothing has happened yet", () => {
    assert.equal(lastOccurrenceOnOrBefore({ ...w, startsOn: "2026-06-01" }, "2026-03-04"), null);
  });
});

describe("nextDueOn", () => {
  const w = { dayOfMonth: 15, startsOn: "2026-01-01", endsOn: null, isActive: true };

  it("returns this month's occurrence when it is still ahead", () => {
    assert.equal(nextDueOn(w, "2026-03-10"), "2026-03-15");
  });

  it("is strictly after today", () => {
    assert.equal(nextDueOn(w, "2026-03-15"), "2026-04-15");
  });

  it("returns null when the template has ended", () => {
    assert.equal(nextDueOn({ ...w, endsOn: "2026-03-01" }, "2026-03-10"), null);
  });

  it("returns null when the template is paused", () => {
    assert.equal(nextDueOn({ ...w, isActive: false }, "2026-03-10"), null);
  });

  it("starts at the first valid occurrence when startsOn is in the future", () => {
    const future = { dayOfMonth: 5, startsOn: "2026-06-20", endsOn: null, isActive: true };

    assert.equal(nextDueOn(future, "2026-03-01"), "2026-07-05");
  });

  it("clamps day 31 into a short month", () => {
    const monthEnd = { dayOfMonth: 31, startsOn: "2026-01-01", endsOn: null, isActive: true };

    assert.equal(nextDueOn(monthEnd, "2026-01-31"), "2026-02-28");
  });
});

describe("minStartsOn", () => {
  it("is exactly 1826 days before today", () => {
    assert.equal(minStartsOn("2026-09-24"), "2021-09-24");
  });
});
