"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { productsQuerySchema, type ProductsQuery } from "@/modules/products/schemas/product.schema";
import { fetchProducts } from "@/modules/products/services/product.service";

export const productKeys = {
  all: ["products"] as const,
  list: (query: ProductsQuery) => [...productKeys.all, query] as const,
};

export type ProductFiltersState = Omit<ProductsQuery, "page" | "pageSize">;

export const DEFAULT_PRODUCTS_QUERY: ProductsQuery = {
  status: "all",
  page: 1,
  pageSize: 20,
};

export function useProducts(query: ProductsQuery) {
  return useQuery({
    queryKey: productKeys.list(query),
    queryFn: () => fetchProducts(query),
    // Mantiene la página anterior visible mientras llega la siguiente.
    placeholderData: keepPreviousData,
  });
}

/**
 * Única traducción entre la URL y `productsQuerySchema`: la vista es compartible
 * por enlace y sobrevive al refresco (AC5).
 */
export function useProductFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = useMemo<ProductsQuery>(() => {
    const parsed = productsQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
    return parsed.success ? parsed.data : DEFAULT_PRODUCTS_QUERY;
  }, [searchParams]);

  const push = useCallback(
    (next: ProductsQuery) => {
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
    (patch: Partial<ProductFiltersState>) => push({ ...query, ...patch, page: 1 }),
    [push, query],
  );

  const setPage = useCallback((page: number) => push({ ...query, page }), [push, query]);

  const reset = useCallback(() => push(DEFAULT_PRODUCTS_QUERY), [push]);

  return { query, setFilters, setPage, reset };
}
