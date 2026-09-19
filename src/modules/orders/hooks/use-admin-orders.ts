"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  adminOrdersQuerySchema,
  type AdminOrdersQuery,
  type UpdateOrderStatusInput,
} from "@/modules/orders/schemas/admin-order.schema";
import {
  fetchAdminOrders,
  updateOrderStatus,
} from "@/modules/orders/services/admin-order.service";

export const adminOrderKeys = {
  all: ["admin-orders"] as const,
  list: (query: AdminOrdersQuery) => [...adminOrderKeys.all, query] as const,
};

export type AdminOrderFiltersState = Omit<AdminOrdersQuery, "page" | "pageSize">;

export const DEFAULT_ADMIN_ORDERS_QUERY: AdminOrdersQuery = { page: 1, pageSize: 20 };

export function useAdminOrders(query: AdminOrdersQuery) {
  return useQuery({
    queryKey: adminOrderKeys.list(query),
    queryFn: () => fetchAdminOrders(query),
    // Mantiene la página anterior visible mientras llega la siguiente.
    placeholderData: keepPreviousData,
  });
}

/**
 * Única traducción entre la URL y `adminOrdersQuerySchema`: la vista es
 * compartible por enlace y sobrevive al refresco (AC2).
 */
export function useAdminOrderFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = useMemo<AdminOrdersQuery>(() => {
    const parsed = adminOrdersQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
    return parsed.success ? parsed.data : DEFAULT_ADMIN_ORDERS_QUERY;
  }, [searchParams]);

  const push = useCallback(
    (next: AdminOrdersQuery) => {
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
    (patch: Partial<AdminOrderFiltersState>) => push({ ...query, ...patch, page: 1 }),
    [push, query],
  );

  const setPage = useCallback((page: number) => push({ ...query, page }), [push, query]);

  const reset = useCallback(() => push(DEFAULT_ADMIN_ORDERS_QUERY), [push]);

  return { query, setFilters, setPage, reset };
}

/** Invalida toda la key: el avance de estado puede sacar la fila del filtro activo. */
export function useAdvanceOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateOrderStatusInput }) =>
      updateOrderStatus(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminOrderKeys.all }),
  });
}
