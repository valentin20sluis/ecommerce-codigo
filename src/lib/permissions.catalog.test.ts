import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { groupByResource } from "./permissions.catalog.ts";

describe("groupByResource", () => {
  it("groups items that share the same resource into one bucket", () => {
    const items = [
      { resource: "products", code: "products.read" },
      { resource: "products", code: "products.create" },
    ];

    const groups = groupByResource(items);

    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.resource, "products");
    assert.deepEqual(groups[0]?.permissions, items);
  });

  it("sorts the resulting groups alphabetically by resource", () => {
    const items = [
      { resource: "products", code: "products.read" },
      { resource: "categories", code: "categories.read" },
    ];

    const groups = groupByResource(items);

    assert.deepEqual(
      groups.map((group) => group.resource),
      ["categories", "products"],
    );
  });

  it("returns an empty array for an empty input", () => {
    assert.deepEqual(groupByResource([]), []);
  });

  it("keeps a single-item group when a resource has only one entry", () => {
    const items = [{ resource: "audit", code: "audit.read" }];

    const groups = groupByResource(items);

    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.permissions.length, 1);
  });
});
