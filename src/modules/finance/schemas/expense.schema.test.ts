import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createExpenseSchema,
  createRecurringExpenseSchema,
  expenseFormSchema,
  expensesQuerySchema,
  recurringFormSchema,
  toCreateExpenseInput,
  toCreateRecurringInput,
  toUpdateRecurringInput,
  updateExpenseSchema,
  updateRecurringExpenseSchema,
} from "./expense.schema.ts";

const validExpense = {
  category: "rent",
  description: "Alquiler marzo",
  amountCents: 150000,
  incurredOn: "2026-03-01",
};

describe("createExpenseSchema", () => {
  it("accepts a valid expense", () => {
    assert.equal(createExpenseSchema.safeParse(validExpense).success, true);
  });

  it("rejects a zero amount", () => {
    assert.equal(createExpenseSchema.safeParse({ ...validExpense, amountCents: 0 }).success, false);
  });

  it("rejects an amount above the ceiling (would overflow int4 into a 500)", () => {
    assert.equal(
      createExpenseSchema.safeParse({ ...validExpense, amountCents: 100_000_000 }).success,
      false,
    );
  });

  it("rejects a fractional amount", () => {
    assert.equal(createExpenseSchema.safeParse({ ...validExpense, amountCents: 10.5 }).success, false);
  });

  it("rejects an unknown category", () => {
    assert.equal(createExpenseSchema.safeParse({ ...validExpense, category: "food" }).success, false);
  });

  it("rejects a one-character description", () => {
    assert.equal(createExpenseSchema.safeParse({ ...validExpense, description: "a" }).success, false);
  });

  it("rejects a datetime where a plain date is expected", () => {
    assert.equal(
      createExpenseSchema.safeParse({ ...validExpense, incurredOn: "2026-03-01T00:00:00.000Z" }).success,
      false,
    );
  });
});

describe("updateExpenseSchema", () => {
  it("accepts a partial update", () => {
    assert.equal(updateExpenseSchema.safeParse({ amountCents: 200000 }).success, true);
  });

  it("rejects an empty update", () => {
    assert.equal(updateExpenseSchema.safeParse({}).success, false);
  });
});

describe("expensesQuerySchema", () => {
  it("applies pagination defaults", () => {
    const result = expensesQuerySchema.safeParse({ from: "2026-03-01", to: "2026-03-31" });
    assert.equal(result.success, true);
    assert.equal(result.data?.page, 1);
    assert.equal(result.data?.pageSize, 20);
  });

  it("rejects to before from", () => {
    assert.equal(expensesQuerySchema.safeParse({ from: "2026-03-31", to: "2026-03-01" }).success, false);
  });

  it("accepts a span right at the 1826-day cap", () => {
    assert.equal(expensesQuerySchema.safeParse({ from: "2021-01-01", to: "2026-01-01" }).success, true);
  });

  it("rejects a span above the cap", () => {
    assert.equal(expensesQuerySchema.safeParse({ from: "2000-01-01", to: "2026-01-01" }).success, false);
  });

  it("rejects an unknown category filter", () => {
    assert.equal(
      expensesQuerySchema.safeParse({ from: "2026-03-01", to: "2026-03-31", category: "food" }).success,
      false,
    );
  });
});

describe("createRecurringExpenseSchema", () => {
  const valid = {
    category: "rent",
    description: "Alquiler",
    amountCents: 100,
    dayOfMonth: 5,
    startsOn: "2026-03-01",
  };

  it("accepts a valid template", () => {
    assert.equal(createRecurringExpenseSchema.safeParse(valid).success, true);
  });

  it("rejects day 32", () => {
    assert.equal(createRecurringExpenseSchema.safeParse({ ...valid, dayOfMonth: 32 }).success, false);
  });

  it("rejects endsOn before startsOn", () => {
    assert.equal(
      createRecurringExpenseSchema.safeParse({ ...valid, endsOn: "2026-02-01" }).success,
      false,
    );
  });
});

describe("updateRecurringExpenseSchema", () => {
  it("accepts pausing a template", () => {
    assert.equal(updateRecurringExpenseSchema.safeParse({ isActive: false }).success, true);
  });

  it("accepts clearing endsOn with null", () => {
    assert.equal(updateRecurringExpenseSchema.safeParse({ endsOn: null }).success, true);
  });

  it("rejects startsOn (not editable, 017 D7)", () => {
    assert.equal(updateRecurringExpenseSchema.safeParse({ startsOn: "2026-01-01" }).success, false);
  });

  it("rejects an empty update", () => {
    assert.equal(updateRecurringExpenseSchema.safeParse({}).success, false);
  });
});

describe("expenseFormSchema / toCreateExpenseInput", () => {
  const form = { category: "rent" as const, description: "Alquiler", amount: "1500,50", incurredOn: "2026-03-01" };

  it("converts a comma decimal into integer cents", () => {
    const parsed = expenseFormSchema.parse(form);
    assert.deepEqual(toCreateExpenseInput(parsed), {
      category: "rent",
      description: "Alquiler",
      amountCents: 150050,
      incurredOn: "2026-03-01",
    });
  });

  it("rejects a zero amount in the form", () => {
    assert.equal(expenseFormSchema.safeParse({ ...form, amount: "0" }).success, false);
  });

  it("rejects an amount above the ceiling in the form", () => {
    assert.equal(expenseFormSchema.safeParse({ ...form, amount: "1000000.00" }).success, false);
  });

  it("rejects text as an amount", () => {
    assert.equal(expenseFormSchema.safeParse({ ...form, amount: "abc" }).success, false);
  });
});

describe("recurringFormSchema / converters", () => {
  const form = {
    category: "software" as const,
    description: "Hosting",
    amount: "20",
    dayOfMonth: "31",
    startsOn: "2026-01-31",
    endsOn: "",
    isActive: true,
  };

  it("builds a create input with a null endsOn when empty", () => {
    const parsed = recurringFormSchema.parse(form);
    assert.deepEqual(toCreateRecurringInput(parsed), {
      category: "software",
      description: "Hosting",
      amountCents: 2000,
      dayOfMonth: 31,
      startsOn: "2026-01-31",
      endsOn: null,
    });
  });

  it("builds an update input without startsOn and with endsOn null when empty", () => {
    const parsed = recurringFormSchema.parse(form);
    assert.deepEqual(toUpdateRecurringInput(parsed), {
      category: "software",
      description: "Hosting",
      amountCents: 2000,
      dayOfMonth: 31,
      endsOn: null,
      isActive: true,
    });
  });

  it("rejects a day of month outside 1-31", () => {
    assert.equal(recurringFormSchema.safeParse({ ...form, dayOfMonth: "0" }).success, false);
    assert.equal(recurringFormSchema.safeParse({ ...form, dayOfMonth: "32" }).success, false);
  });

  it("rejects an end date before the start date", () => {
    assert.equal(recurringFormSchema.safeParse({ ...form, endsOn: "2026-01-01" }).success, false);
  });
});
