import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { auditLogsQuerySchema } from "./audit-log.schema.ts";

describe("auditLogsQuerySchema", () => {
  it("defaults page to 1 and pageSize to 50 when omitted", () => {
    const result = auditLogsQuerySchema.safeParse({});

    assert.equal(result.success, true);
    assert.deepEqual(result.data, { page: 1, pageSize: 50 });
  });

  it("accepts a known severity", () => {
    assert.equal(auditLogsQuerySchema.safeParse({ severity: "warning" }).success, true);
  });

  it("rejects a severity outside info/warning/error", () => {
    assert.equal(auditLogsQuerySchema.safeParse({ severity: "critical" }).success, false);
  });
});
