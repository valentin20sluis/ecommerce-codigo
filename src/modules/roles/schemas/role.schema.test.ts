import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createRoleSchema, setRolePermissionsSchema, updateRoleSchema } from "./role.schema.ts";

const PERMISSION_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

describe("createRoleSchema", () => {
  it("accepts a valid lowercase slug", () => {
    assert.equal(createRoleSchema.safeParse({ slug: "support-lead", name: "Support Lead" }).success, true);
  });

  it("rejects a slug starting with a digit or containing uppercase letters", () => {
    assert.equal(createRoleSchema.safeParse({ slug: "1support", name: "X" }).success, false);
    assert.equal(createRoleSchema.safeParse({ slug: "Support", name: "X" }).success, false);
  });
});

describe("updateRoleSchema", () => {
  it("accepts a partial payload with only description", () => {
    assert.equal(updateRoleSchema.safeParse({ description: "nueva" }).success, true);
  });
});

describe("setRolePermissionsSchema", () => {
  it("accepts an array of UUIDs", () => {
    assert.equal(setRolePermissionsSchema.safeParse({ permissionIds: [PERMISSION_ID] }).success, true);
  });

  it("rejects more than 500 permission ids", () => {
    const tooMany = Array.from({ length: 501 }, () => PERMISSION_ID);

    assert.equal(setRolePermissionsSchema.safeParse({ permissionIds: tooMany }).success, false);
  });

  it("accepts exactly 500 permission ids", () => {
    const max = Array.from({ length: 500 }, () => PERMISSION_ID);

    assert.equal(setRolePermissionsSchema.safeParse({ permissionIds: max }).success, true);
  });
});
