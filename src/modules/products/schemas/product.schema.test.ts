import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createProductSchema,
  productFormSchema,
  productsQuerySchema,
  publicProductsQuerySchema,
  updateProductSchema,
} from "./product.schema.ts";

const CATEGORY_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

const baseProduct = {
  name: "Mouse",
  slug: "mouse-x",
  categoryId: CATEGORY_ID,
  priceCents: 1000,
  stock: 5,
};

describe("createProductSchema", () => {
  it("accepts a minimal valid product", () => {
    assert.equal(createProductSchema.safeParse(baseProduct).success, true);
  });

  it("rejects a slug with uppercase letters", () => {
    const result = createProductSchema.safeParse({ ...baseProduct, slug: "Mouse-X" });

    assert.equal(result.success, false);
  });

  it("treats an empty-string sku as absent", () => {
    const result = createProductSchema.safeParse({ ...baseProduct, sku: "" });

    assert.equal(result.success, true);
    assert.equal(result.data?.sku, undefined);
  });

  it("rejects a negative priceCents", () => {
    assert.equal(createProductSchema.safeParse({ ...baseProduct, priceCents: -1 }).success, false);
  });

  it("rejects an imageUrl that is neither an absolute URL nor a relative path", () => {
    const result = createProductSchema.safeParse({ ...baseProduct, imageUrl: "not a url or path" });

    assert.equal(result.success, false);
  });

  it("accepts a relative imageUrl path", () => {
    const result = createProductSchema.safeParse({ ...baseProduct, imageUrl: "/img/x.png" });

    assert.equal(result.success, true);
  });
});

describe("updateProductSchema", () => {
  it("accepts a partial payload with a single field", () => {
    assert.equal(updateProductSchema.safeParse({ name: "Nuevo nombre" }).success, true);
  });

  it("leaves isActive undefined when omitted (no default, unlike create)", () => {
    const result = updateProductSchema.safeParse({ name: "Nuevo nombre" });

    assert.equal(result.success, true);
    assert.equal(result.data?.isActive, undefined);
  });

  it("rejects a payload that tries to set stock: it only moves through the inventory module", () => {
    assert.equal(updateProductSchema.safeParse({ name: "Nuevo nombre", stock: 5 }).success, false);
  });

  it("accepts a lowStockThreshold", () => {
    assert.equal(updateProductSchema.safeParse({ lowStockThreshold: 2 }).success, true);
  });
});

describe("productsQuerySchema", () => {
  it("defaults status, page and pageSize when omitted", () => {
    const result = productsQuerySchema.safeParse({});

    assert.equal(result.success, true);
    assert.deepEqual(result.data, { status: "all", page: 1, pageSize: 20 });
  });

  it("coerces string page/pageSize to numbers", () => {
    const result = productsQuerySchema.safeParse({ page: "2", pageSize: "10" });

    assert.equal(result.success, true);
    assert.equal(result.data?.page, 2);
    assert.equal(result.data?.pageSize, 10);
  });

  it("rejects a pageSize above 100", () => {
    assert.equal(productsQuerySchema.safeParse({ pageSize: 101 }).success, false);
  });
});

describe("productFormSchema", () => {
  const baseForm = {
    name: "Mouse",
    slug: "mouse-x",
    sku: "",
    description: "d",
    categoryId: CATEGORY_ID,
    compareAtPrice: "",
    stock: "5",
    lowStockThreshold: "5",
    isActive: true,
    imageUrl: "",
  };

  it("rejects a price with more than two decimals", () => {
    const result = productFormSchema.safeParse({ ...baseForm, price: "19.999" });

    assert.equal(result.success, false);
  });

  it("accepts an empty string for sku and compareAtPrice", () => {
    const result = productFormSchema.safeParse({ ...baseForm, price: "19.99" });

    assert.equal(result.success, true);
  });

  it("rejects a low stock threshold that is not a whole number", () => {
    const result = productFormSchema.safeParse({
      ...baseForm,
      price: "19.99",
      lowStockThreshold: "2.5",
    });

    assert.equal(result.success, false);
  });
});

describe("publicProductsQuerySchema", () => {
  it("splits a comma-separated categories string into an array", () => {
    const result = publicProductsQuerySchema.safeParse({ categories: "a,b, c" });

    assert.equal(result.success, true);
    assert.deepEqual(result.data?.categories, ["a", "b", "c"]);
  });

  it("drops price bands outside PRICE_BANDS instead of rejecting the query", () => {
    const result = publicProductsQuerySchema.safeParse({ priceBands: "lt100,bogus,gt700" });

    assert.equal(result.success, true);
    assert.deepEqual(result.data?.priceBands, ["lt100", "gt700"]);
  });

  it("treats an absent categories param as undefined, never an empty array", () => {
    const result = publicProductsQuerySchema.safeParse({});

    assert.equal(result.success, true);
    assert.equal(result.data?.categories, undefined);
  });
});
