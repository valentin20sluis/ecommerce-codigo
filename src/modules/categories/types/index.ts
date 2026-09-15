import type { Category } from "@/server/db/schema";
import type { Paginated, Serialized } from "@/types/api";

export type CategoryDto = Serialized<Category>;

export type CategoryListResponse = Paginated<CategoryDto>;
