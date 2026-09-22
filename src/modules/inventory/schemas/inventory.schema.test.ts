import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createStockMovementSchema,
  stockAdjustFormSchema,
  toStockMovementInput,
  type StockAdjustFormValues,
} from "./inventory.schema.ts";

const MAX_UNITS = 1_000_000;

function formValues(patch: Partial<StockAdjustFormValues>): StockAdjustFormValues {
  return { type: "adjustment", qty: "1", countedStock: "0", reason: "", ...patch };
}

/** Rutas de los issues de un parse fallido, para afirmar sobre el campo marcado. */
function issuePaths(values: StockAdjustFormValues): string[] {
  const result = stockAdjustFormSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => String(issue.path[0]));
}

describe("createStockMovementSchema", () => {
  it("accepts a quantity right at the cap", () => {
    assert.equal(
      createStockMovementSchema.safeParse({ type: "restock", qty: MAX_UNITS }).success,
      true,
    );
  });

  it("rejects a quantity above the cap", () => {
    assert.equal(
      createStockMovementSchema.safeParse({ type: "restock", qty: MAX_UNITS + 1 }).success,
      false,
    );
  });

  it("rejects a counted stock above the cap", () => {
    assert.equal(
      createStockMovementSchema.safeParse({
        type: "adjustment",
        countedStock: MAX_UNITS + 1,
        expectedStock: 0,
        reason: "conteo físico",
      }).success,
      false,
    );
  });

  it("accepts a negative expected stock down to the cap (oversold product)", () => {
    assert.equal(
      createStockMovementSchema.safeParse({
        type: "adjustment",
        countedStock: 0,
        expectedStock: -MAX_UNITS,
        reason: "regularización",
      }).success,
      true,
    );
  });

  it("rejects a waste with a reason shorter than three characters", () => {
    assert.equal(
      createStockMovementSchema.safeParse({ type: "waste", qty: 1, reason: "ok" }).success,
      false,
    );
  });
});

describe("stockAdjustFormSchema", () => {
  it("flags a restock whose reason is written but too short", () => {
    assert.deepEqual(issuePaths(formValues({ type: "restock", qty: "2", reason: "ok" })), [
      "reason",
    ]);
  });

  it("accepts a restock with no reason at all", () => {
    assert.deepEqual(issuePaths(formValues({ type: "restock", qty: "2", reason: "" })), []);
  });

  it("accepts a restock whose reason reaches the minimum", () => {
    assert.deepEqual(issuePaths(formValues({ type: "restock", qty: "2", reason: "eee" })), []);
  });

  it("flags a waste with no reason", () => {
    assert.deepEqual(issuePaths(formValues({ type: "waste", qty: "2", reason: "" })), ["reason"]);
  });

  it("flags a quantity above the cap so it never reaches the API", () => {
    assert.deepEqual(
      issuePaths(formValues({ type: "restock", qty: String(MAX_UNITS + 1), reason: "compra" })),
      ["qty"],
    );
  });

  it("flags a counted stock above the cap", () => {
    assert.deepEqual(
      issuePaths(
        formValues({ type: "adjustment", countedStock: String(MAX_UNITS + 1), reason: "conteo" }),
      ),
      ["countedStock"],
    );
  });

  it("flags a reason longer than the API allows", () => {
    assert.deepEqual(
      issuePaths(formValues({ type: "waste", qty: "1", reason: "x".repeat(301) })),
      ["reason"],
    );
  });

  it("flags a quantity of zero", () => {
    assert.deepEqual(issuePaths(formValues({ type: "restock", qty: "0", reason: "compra" })), [
      "qty",
    ]);
  });
});

describe("toStockMovementInput", () => {
  it("turns an accepted restock form with no reason into a body with no reason", () => {
    const input = toStockMovementInput(
      formValues({ type: "restock", qty: "2", reason: "" }),
      10,
    );

    assert.deepEqual(input, { type: "restock", qty: 2, reason: undefined });
  });

  it("carries the expected stock of the listing into an adjustment body", () => {
    const input = toStockMovementInput(
      formValues({ type: "adjustment", countedStock: "7", reason: "conteo físico" }),
      10,
    );

    assert.deepEqual(input, {
      type: "adjustment",
      countedStock: 7,
      expectedStock: 10,
      reason: "conteo físico",
    });
  });

  it("accepts every form value the schema approves (no silent ZodError)", () => {
    const approved: StockAdjustFormValues[] = [
      formValues({ type: "restock", qty: "2", reason: "" }),
      formValues({ type: "restock", qty: "2", reason: "eee" }),
      formValues({ type: "restock", qty: String(MAX_UNITS), reason: "compra grande" }),
      formValues({ type: "waste", qty: "3", reason: "rotura" }),
      formValues({ type: "adjustment", countedStock: "0", reason: "conteo físico" }),
    ];

    for (const values of approved) {
      assert.deepEqual(issuePaths(values), [], `el formulario ${values.type} debía ser válido`);
      assert.doesNotThrow(() => toStockMovementInput(values, 10));
    }
  });
});
