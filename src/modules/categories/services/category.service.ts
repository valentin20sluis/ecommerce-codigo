import { api } from "@/lib/axios";
import type {
  CategoriesQuery,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@/modules/categories/schemas/category.schema";
import type { CategoryDto, CategoryListResponse } from "@/modules/categories/types";

export async function fetchCategories(query: CategoriesQuery): Promise<CategoryListResponse> {
  const { data } = await api.get<CategoryListResponse>("/admin/categories", { params: query });
  return data;
}

export async function fetchCategory(id: string): Promise<CategoryDto> {
  const { data } = await api.get<CategoryDto>(`/admin/categories/${id}`);
  return data;
}

export async function createCategory(input: CreateCategoryInput): Promise<CategoryDto> {
  const { data } = await api.post<CategoryDto>("/admin/categories", input);
  return data;
}

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput,
): Promise<CategoryDto> {
  const { data } = await api.patch<CategoryDto>(`/admin/categories/${id}`, input);
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  await api.delete(`/admin/categories/${id}`);
}
