import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toCategoryRevenueDto } from "./revenue.ts";

describe("toCategoryRevenueDto", () => {
  it("shows 'no coverage' as a null margin, not zero", () => {
    const dto = toCategoryRevenueDto({
      categoryId: "c1",
      categoryName: "Audio",
      revenueCents: 10000,
      units: 3,
      marginCentsKnown: 0,
      revenueCentsKnown: 0,
    });

    assert.deepEqual(dto, { categoryId: "c1", categoryName: "Audio", revenueCents: 10000, marginCents: null, units: 3 });
  });

  it("keeps the known margin when the category has full coverage", () => {
    const dto = toCategoryRevenueDto({
      categoryId: "c2",
      categoryName: "Video",
      revenueCents: 20000,
      units: 5,
      marginCentsKnown: 8000,
      revenueCentsKnown: 20000,
    });

    assert.equal(dto.marginCents, 8000);
  });
});
