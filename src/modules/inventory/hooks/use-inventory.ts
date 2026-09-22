"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { dashboardMetricKeys } from "@/modules/dashboard/hooks/use-dashboard-metrics";
import {
  inventoryQuerySchema,
  type CreateStockMovementInput,
  type InventoryQuery,
  type MovementsQuery,
} from "@/modules/inventory/schemas/inventory.schema";
import {
  createStockMovement,
  fetchInventory,
  fetchStockMovements,
} from "@/modules/inventory/services/inventory.service";
import { productKeys } from "@/modules/products/hooks/use-products";

export const inventoryKeys = {
  all: ["inventory"] as const,
  list: (query: InventoryQuery) => [...inventoryKeys.all, "list", query] as const,
  movements: (productId: string, query: MovementsQuery) =>
    [...inventoryKeys.all, "movements", productId, query] as const,
};

export type InventoryFiltersState = Omit<InventoryQuery, "page" | "pageSize">;

export const DEFAULT_INVENTORY_QUERY: InventoryQuery = { filter: "all", page: 1, pageSize: 20 };

export function useInventory(query: InventoryQuery) {
  return useQuery({
    queryKey: inventoryKeys.list(query),
    queryFn: () => fetchInventory(query),
    // Mantiene la página anterior visible mientras llega la siguiente.
    placeholderData: keepPreviousData,
  });
}

/**
 * Kardex de un producto: sin producto seleccionado no hay request, así que el
 * sheet cerrado no consulta nada.
 */
export function useStockMovements(productId: string | null, query: MovementsQuery) {
  return useQuery({
    queryKey: inventoryKeys.movements(productId ?? "", query),
    queryFn: () => {
      if (!productId) throw new Error("No hay producto seleccionado.");
      return fetchStockMovements(productId, query);
    },
    enabled: productId !== null,
  });
}

/**
 * Única traducción entre la URL y `inventoryQuerySchema`: la vista es
 * compartible por enlace y sobrevive al refresco, igual que productos y pedidos.
 */
export function useInventoryFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = useMemo<InventoryQuery>(() => {
    const parsed = inventoryQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
    return parsed.success ? parsed.data : DEFAULT_INVENTORY_QUERY;
  }, [searchParams]);

  const push = useCallback(
    (next: InventoryQuery) => {
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
    (patch: Partial<InventoryFiltersState>) => push({ ...query, ...patch, page: 1 }),
    [push, query],
  );

  const setPage = useCallback((page: number) => push({ ...query, page }), [push, query]);

  const reset = useCallback(() => push(DEFAULT_INVENTORY_QUERY), [push]);

  return { query, setFilters, setPage, reset };
}

/**
 * Un movimiento cambia el stock, el kardex, el listado de productos y la card de
 * stock bajo del dashboard: las cuatro keys se invalidan juntas para que ninguna
 * vista quede mostrando un stock viejo.
 */
export function useCreateStockMovement(productId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateStockMovementInput) => {
      if (!productId) throw new Error("No hay producto seleccionado.");
      return createStockMovement(productId, input);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: inventoryKeys.all }),
        queryClient.invalidateQueries({ queryKey: productKeys.all }),
        queryClient.invalidateQueries({ queryKey: dashboardMetricKeys.all }),
      ]);
    },
  });
}
