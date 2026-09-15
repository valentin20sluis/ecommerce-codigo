"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { PublicCategoriesQuery } from "@/modules/categories/schemas/category.schema";
import { fetchPublicCategories } from "@/modules/categories/services/storefront-category.service";

export const storefrontCategoryKeys = {
  all: ["storefront-categories"] as const,
  list: (query: PublicCategoriesQuery) => [...storefrontCategoryKeys.all, query] as const,
};

/** Consumido por la futura página `/products` con filtros; el home no la usa (005 T20). */
export function useStorefrontCategories(query: PublicCategoriesQuery) {
  return useQuery({
    queryKey: storefrontCategoryKeys.list(query),
    queryFn: () => fetchPublicCategories(query),
    placeholderData: keepPreviousData,
  });
}
