"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import {
  revenueFiltersSchema,
  type RevenueFilterPreset,
  type RevenueFilters,
  type RevenueQuery,
} from "@/modules/finance/schemas/revenue.schema";
import { fetchRevenueSummary } from "@/modules/finance/services/revenue.service";
import { resolveDateRangePreset } from "@/modules/finance/utils";

export const revenueKeys = {
  all: ["finance", "revenue"] as const,
  summary: (query: RevenueQuery) => [...revenueKeys.all, "summary", query] as const,
};

const DEFAULT_FILTERS: RevenueFilters = { preset: "this_month" };

/**
 * Traduce el filtro (preset o rango libre) a la query concreta que espera la
 * API, o `null` si el rango libre todavía no está completo (016 D3): elegir
 * "custom" no dispara nada hasta tener `from` y `to`.
 */
function resolveQuery(filters: RevenueFilters): RevenueQuery | null {
  if (filters.preset === "custom") {
    if (!filters.from || !filters.to) return null;
    return { from: filters.from, to: filters.to };
  }

  return resolveDateRangePreset(filters.preset);
}

/** Única traducción entre la URL y `revenueFiltersSchema`, mismo patrón que `useOrderFilters`. */
export function useRevenueFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo<RevenueFilters>(() => {
    const parsed = revenueFiltersSchema.safeParse(Object.fromEntries(searchParams.entries()));
    return parsed.success ? parsed.data : DEFAULT_FILTERS;
  }, [searchParams]);

  const query = useMemo(() => resolveQuery(filters), [filters]);

  const push = useCallback(
    (next: RevenueFilters) => {
      const params = new URLSearchParams();

      for (const [key, value] of Object.entries(next)) {
        if (value === undefined || value === "") continue;
        params.set(key, String(value));
      }

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router],
  );

  const setPreset = useCallback(
    (preset: RevenueFilterPreset) => push(preset === "custom" ? { ...filters, preset } : { preset }),
    [filters, push],
  );

  const setCustomRange = useCallback(
    (range: { from?: string; to?: string }) => push({ preset: "custom", ...range }),
    [push],
  );

  return { filters, query, setPreset, setCustomRange };
}

export function useRevenue(query: RevenueQuery | null) {
  return useQuery({
    queryKey: query ? revenueKeys.summary(query) : revenueKeys.all,
    queryFn: () => fetchRevenueSummary(query as RevenueQuery),
    enabled: query !== null,
  });
}
