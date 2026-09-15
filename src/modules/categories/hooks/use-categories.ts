"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  categoriesQuerySchema,
  type CategoriesQuery,
} from "@/modules/categories/schemas/category.schema";
import { fetchCategories } from "@/modules/categories/services/category.service";

export const categoryKeys = {
  all: ["categories"] as const,
  list: (query: CategoriesQuery) => [...categoryKeys.all, query] as const,
};

export type CategoryFiltersState = Omit<CategoriesQuery, "page" | "pageSize">;

export const DEFAULT_CATEGORIES_QUERY: CategoriesQuery = {
  status: "all",
  page: 1,
  pageSize: 20,
};

export function useCategories(query: CategoriesQuery) {
  return useQuery({
    queryKey: categoryKeys.list(query),
    queryFn: () => fetchCategories(query),
    // Mantiene la página anterior visible mientras llega la siguiente.
    placeholderData: keepPreviousData,
  });
}

/**
 * Única traducción entre la URL y `categoriesQuerySchema`: la vista es
 * compartible por enlace y sobrevive al refresco (AC4).
 */
export function useCategoryFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = useMemo<CategoriesQuery>(() => {
    const parsed = categoriesQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
    return parsed.success ? parsed.data : DEFAULT_CATEGORIES_QUERY;
  }, [searchParams]);

  const push = useCallback(
    (next: CategoriesQuery) => {
      const params = new URLSearchParams();

      for (const [key, value] of Object.entries(next)) {
        if (value === undefined || value === "") continue;
        params.set(key, String(value));
      }

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router],
  );

  const setFilters = useCallback(
    (patch: Partial<CategoryFiltersState>) => push({ ...query, ...patch, page: 1 }),
    [push, query],
  );

  const setPage = useCallback((page: number) => push({ ...query, page }), [push, query]);

  const reset = useCallback(() => push(DEFAULT_CATEGORIES_QUERY), [push]);

  return { query, setFilters, setPage, reset };
}
