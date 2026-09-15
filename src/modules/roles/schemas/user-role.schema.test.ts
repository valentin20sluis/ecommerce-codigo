import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { setUserRolesSchema, usersQuerySchema } from "./user-role.schema.ts";

const ROLE_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

describe("setUserRolesSchema", () => {
  it("accepts an array of UUIDs", () => {
    assert.equal(setUserRolesSchema.safeParse({ roleIds: [ROLE_ID] }).success, true);
  });

  it("rejects more than 20 role ids", () => {
    const tooMany = Array.from({ length: 21 }, () => ROLE_ID);

    assert.equal(setUserRolesSchema.safeParse({ roleIds: tooMany }).success, false);
  });

  it("accepts exactly 20 role ids", () => {
    const max = Array.from({ length: 20 }, () => ROLE_ID);

    assert.equal(setUserRolesSchema.safeParse({ roleIds: max }).success, true);
  });
});

describe("usersQuerySchema", () => {
  it("defaults page and pageSize when omitted", () => {
    const result = usersQuerySchema.safeParse({});

    assert.equal(result.success, true);
    assert.deepEqual(result.data, { page: 1, pageSize: 20 });
  });
});
