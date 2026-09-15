import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  categoriesQuerySchema,
  createCategorySchema,
  publicCategoriesQuerySchema,
  updateCategorySchema,
} from "./category.schema.ts";

describe("createCategorySchema", () => {
  it("accepts a minimal valid category", () => {
    assert.equal(createCategorySchema.safeParse({ name: "Audio", slug: "audio" }).success, true);
  });

  it("rejects a slug with spaces or uppercase letters", () => {
    assert.equal(createCategorySchema.safeParse({ name: "Audio", slug: "audio video" }).success, false);
    assert.equal(createCategorySchema.safeParse({ name: "Audio", slug: "Audio" }).success, false);
  });
});

describe("updateCategorySchema", () => {
  it("keeps isActive optional with no default on a partial update", () => {
    const result = updateCategorySchema.safeParse({ name: "Nuevo" });

    assert.equal(result.success, true);
    assert.equal(result.data?.isActive, undefined);
  });
});

describe("categoriesQuerySchema", () => {
  it('defaults status to "all" and applies default pagination', () => {
    const result = categoriesQuerySchema.safeParse({});

    assert.equal(result.success, true);
    assert.deepEqual(result.data, { status: "all", page: 1, pageSize: 20 });
  });
});

describe("publicCategoriesQuerySchema", () => {
  it("accepts a query without a status field", () => {
    const result = publicCategoriesQuerySchema.safeParse({});

    assert.equal(result.success, true);
    assert.equal("status" in (result.data ?? {}), false);
  });
});
