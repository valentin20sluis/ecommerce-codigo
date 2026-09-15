import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSetupSessionSchema, paymentMethodIdParamSchema } from "./payment-method.schema.ts";

const UUID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

describe("createSetupSessionSchema", () => {
  it("accepts an empty object", () => {
    assert.equal(createSetupSessionSchema.safeParse({}).success, true);
  });

  it("rejects a payload with any extra field (strict)", () => {
    assert.equal(createSetupSessionSchema.safeParse({ foo: "bar" }).success, false);
  });
});

describe("paymentMethodIdParamSchema", () => {
  it("accepts a valid UUID", () => {
    assert.equal(paymentMethodIdParamSchema.safeParse({ id: UUID }).success, true);
  });

  it("rejects a non-UUID string", () => {
    assert.equal(paymentMethodIdParamSchema.safeParse({ id: "not-a-uuid" }).success, false);
  });
});
