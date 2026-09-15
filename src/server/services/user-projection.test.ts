import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BadRequestError } from "../../lib/api-error.core.ts";
import { toUserProjection, type ClerkIdentity } from "./user-projection.ts";

function identity(overrides: Partial<ClerkIdentity>): ClerkIdentity {
  return {
    clerkId: "user_1",
    emails: [{ id: "e1", address: "First@Example.com" }],
    primaryEmailId: "e1",
    firstName: "Ana",
    lastName: null,
    imageUrl: null,
    ...overrides,
  };
}

describe("toUserProjection", () => {
  it("picks the email matching primaryEmailId and lowercases it", () => {
    const projection = toUserProjection(
      identity({
        emails: [
          { id: "e1", address: "First@Example.com" },
          { id: "e2", address: "second@example.com" },
        ],
        primaryEmailId: "e2",
      }),
    );

    assert.equal(projection.email, "second@example.com");
  });

  it("falls back to the first email when primaryEmailId matches none", () => {
    const projection = toUserProjection(identity({ primaryEmailId: "missing" }));

    assert.equal(projection.email, "first@example.com");
  });

  it("turns an empty imageUrl into null", () => {
    const projection = toUserProjection(identity({ imageUrl: "" }));

    assert.equal(projection.imageUrl, null);
  });

  it("throws BadRequestError when there is no usable email", () => {
    assert.throws(
      () => toUserProjection(identity({ emails: [], primaryEmailId: null })),
      BadRequestError,
    );
  });
});
