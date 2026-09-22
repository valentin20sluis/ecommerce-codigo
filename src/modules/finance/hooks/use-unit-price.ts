"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  unitPriceQuerySchema,
  type UnitPriceQuery,
  type UpdateCostInput,
} from "@/modules/finance/schemas/unit-price.schema";
import { fetchUnitPrices, updateUnitPriceCost } from "@/modules/finance/services/unit-price.service";

export const unitPriceKeys = {
  all: ["finance", "unit-price"] as const,
  list: (query: UnitPriceQuery) => [...unitPriceKeys.all, "list", query] as const,
};

export type UnitPriceFiltersState = Omit<UnitPriceQuery, "page" | "pageSize">;

export const DEFAULT_UNIT_PRICE_QUERY: UnitPriceQuery = { page: 1, pageSize: 20 };

export function useUnitPrices(query: UnitPriceQuery) {
  return useQuery({
    queryKey: unitPriceKeys.list(query),
    queryFn: () => fetchUnitPrices(query),
    // Mantiene la página anterior visible mientras llega la siguiente.
    placeholderData: keepPreviousData,
  });
}

/** Única traducción entre la URL y `unitPriceQuerySchema`, mismo patrón que inventario. */
export function useUnitPriceFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = useMemo<UnitPriceQuery>(() => {
    const parsed = unitPriceQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
    return parsed.success ? parsed.data : DEFAULT_UNIT_PRICE_QUERY;
  }, [searchParams]);

  const push = useCallback(
    (next: UnitPriceQuery) => {
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
    (patch: Partial<UnitPriceFiltersState>) => push({ ...query, ...patch, page: 1 }),
    [push, query],
  );

  const setPage = useCallback((page: number) => push({ ...query, page }), [push, query]);

  return { query, setFilters, setPage };
}

export function useUpdateUnitPriceCost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, input }: { productId: string; input: UpdateCostInput }) =>
      updateUnitPriceCost(productId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: unitPriceKeys.all });
    },
  });
}
