"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  publicProductsQuerySchema,
  type PublicProductsQuery,
} from "@/modules/products/schemas/product.schema";
import { fetchPublicProducts } from "@/modules/products/services/storefront-product.service";

export const storefrontProductKeys = {
  all: ["storefront-products"] as const,
  list: (query: PublicProductsQuery) => [...storefrontProductKeys.all, query] as const,
};

/** Consumido por la página `/products` con filtros (006); el home no la usa (005 T20). */
export function useStorefrontProducts(query: PublicProductsQuery) {
  return useQuery({
    queryKey: storefrontProductKeys.list(query),
    queryFn: () => fetchPublicProducts(query),
    placeholderData: keepPreviousData,
  });
}

export type StorefrontProductFiltersState = Omit<PublicProductsQuery, "page" | "pageSize">;

export const DEFAULT_STOREFRONT_PRODUCTS_QUERY: PublicProductsQuery = {
  categories: undefined,
  priceBands: undefined,
  sort: "newest",
  page: 1,
  pageSize: 12,
};

/**
 * Sync URL↔query calcado de `useProductFilters` (admin, `use-products.ts`): la
 * vista de catálogo pagina en servidor, así que necesita el mismo requisito de URL
 * compartible/recargable, a diferencia del home que filtra local sobre datos ya
 * cargados (006 D3).
 */
export function useStorefrontProductFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = useMemo<PublicProductsQuery>(() => {
    const parsed = publicProductsQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
    return parsed.success ? parsed.data : DEFAULT_STOREFRONT_PRODUCTS_QUERY;
  }, [searchParams]);

  const push = useCallback(
    (next: PublicProductsQuery) => {
      const params = new URLSearchParams();

      for (const [key, value] of Object.entries(next)) {
        if (value === undefined || value === "") continue;
        if (Array.isArray(value) && value.length === 0) continue;
        params.set(key, String(value));
      }

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router],
  );

  const setFilters = useCallback(
    (patch: Partial<StorefrontProductFiltersState>) => push({ ...query, ...patch, page: 1 }),
    [push, query],
  );

  const setPage = useCallback((page: number) => push({ ...query, page }), [push, query]);

  const reset = useCallback(() => push(DEFAULT_STOREFRONT_PRODUCTS_QUERY), [push]);

  return { query, setFilters, setPage, reset };
}
