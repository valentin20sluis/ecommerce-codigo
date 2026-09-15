import { api } from "@/lib/axios";
import type { PublicCategoriesQuery } from "@/modules/categories/schemas/category.schema";
import type { CategoryListResponse } from "@/modules/categories/types";

export async function fetchPublicCategories(
  query: PublicCategoriesQuery,
): Promise<CategoryListResponse> {
  const { data } = await api.get<CategoryListResponse>("/categories", { params: query });
  return data;
}
