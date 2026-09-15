"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { MAX_ORDERS } from "@/modules/orders/constants";
import {
  orderFiltersSchema,
  type OrderFilterPeriod,
  type OrderFilters,
  type OrdersQuery,
} from "@/modules/orders/schemas/order.schema";
import { fetchMyOrders } from "@/modules/orders/services/order.service";

export const orderKeys = {
  all: ["orders"] as const,
  list: (query: OrdersQuery) => [...orderKeys.all, "list", query] as const,
  receipt: (orderId: string) => [...orderKeys.all, "receipt", orderId] as const,
};

const DEFAULT_FILTERS: OrderFilters = { period: "month" };

export function useMyOrders(query: OrdersQuery) {
  return useQuery({
    queryKey: orderKeys.list(query),
    queryFn: () => fetchMyOrders(query),
    // Mantiene el listado anterior mientras llega el del nuevo rango.
    placeholderData: keepPreviousData,
  });
}

/** Preset por defecto: del día 1 a las 00:00 locales hasta ahora. */
function currentMonthRange(): { from: string; to: string } {
  const now = new Date();

  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    to: now.toISOString(),
  };
}

/**
 * Única traducción entre la URL y `orderFiltersSchema`: el filtro sobrevive al
 * refresco y la vista es compartible por enlace (009 AC4).
 */
export function useOrderFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo<OrderFilters>(() => {
    const parsed = orderFiltersSchema.safeParse(Object.fromEntries(searchParams.entries()));
    return parsed.success ? parsed.data : DEFAULT_FILTERS;
  }, [searchParams]);

  const query = useMemo<OrdersQuery>(
    () =>
      filters.period === "custom"
        ? { from: filters.from, to: filters.to, limit: MAX_ORDERS }
        : { ...currentMonthRange(), limit: MAX_ORDERS },
    [filters],
  );

  const push = useCallback(
    (next: OrderFilters) => {
      const params = new URLSearchParams();

      for (const [key, value] of Object.entries(next)) {
        if (value === undefined || value === "") continue;
        params.set(key, String(value));
      }

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router],
  );

  const setPeriod = useCallback(
    (period: OrderFilterPeriod) =>
      // Volver a "mes actual" descarta el rango: dejarlo en la URL confundiría al recargar.
      push(period === "month" ? { period } : { ...filters, period }),
    [filters, push],
  );

  const setRange = useCallback(
    (range: { from?: string; to?: string }) => push({ period: "custom", ...range }),
    [push],
  );

  return { filters, query, setPeriod, setRange };
}
