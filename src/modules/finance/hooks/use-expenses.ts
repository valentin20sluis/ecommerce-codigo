"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { resolveExpenseRange } from "@/modules/finance/expense-range";
import type { RevenueFilterPreset } from "@/modules/finance/schemas/revenue.schema";
import {
  expenseFiltersSchema,
  type CreateExpenseInput,
  type CreateRecurringExpenseInput,
  type ExpenseCategoryValue,
  type ExpenseFilters,
  type ExpensesQuery,
  type UpdateExpenseInput,
  type UpdateRecurringExpenseInput,
} from "@/modules/finance/schemas/expense.schema";
import {
  createExpense,
  createRecurringExpense,
  deleteExpense,
  deleteRecurringExpense,
  fetchExpenses,
  fetchRecurringExpenses,
  updateExpense,
  updateRecurringExpense,
} from "@/modules/finance/services/expense.service";

export const EXPENSES_PAGE_SIZE = 20;

export const expenseKeys = {
  all: ["finance", "expenses"] as const,
  list: (query: ExpensesQuery) => [...expenseKeys.all, "list", query] as const,
  recurring: () => [...expenseKeys.all, "recurring"] as const,
};

const DEFAULT_FILTERS: ExpenseFilters = { preset: "this_month", page: 1 };

/** Única traducción entre la URL y `expenseFiltersSchema`, mismo patrón que `useRevenueFilters`. */
export function useExpenseFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo<ExpenseFilters>(() => {
    const parsed = expenseFiltersSchema.safeParse(Object.fromEntries(searchParams.entries()));
    return parsed.success ? parsed.data : DEFAULT_FILTERS;
  }, [searchParams]);

  const query = useMemo<ExpensesQuery | null>(() => {
    const range = resolveExpenseRange(filters);
    if (!range) return null;

    return { ...range, category: filters.category, page: filters.page, pageSize: EXPENSES_PAGE_SIZE };
  }, [filters]);

  const push = useCallback(
    (next: ExpenseFilters) => {
      const params = new URLSearchParams();

      for (const [key, value] of Object.entries(next)) {
        if (value === undefined || value === "") continue;
        if (key === "page" && value === 1) continue;
        params.set(key, String(value));
      }

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router],
  );

  const setPreset = useCallback(
    (preset: RevenueFilterPreset) =>
      push(
        preset === "custom"
          ? { ...filters, preset, page: 1 }
          : { preset, category: filters.category, page: 1 },
      ),
    [filters, push],
  );

  const setCustomRange = useCallback(
    (range: { from?: string; to?: string }) =>
      push({ category: filters.category, preset: "custom", ...range, page: 1 }),
    [filters.category, push],
  );

  const setCategory = useCallback(
    (category: ExpenseCategoryValue | undefined) => push({ ...filters, category, page: 1 }),
    [filters, push],
  );

  const setPage = useCallback((page: number) => push({ ...filters, page }), [filters, push]);

  return { filters, query, setPreset, setCustomRange, setCategory, setPage };
}

export function useExpenses(query: ExpensesQuery | null) {
  return useQuery({
    queryKey: query ? expenseKeys.list(query) : expenseKeys.all,
    queryFn: () => {
      if (!query) throw new Error("No hay rango seleccionado.");
      return fetchExpenses(query);
    },
    enabled: query !== null,
    placeholderData: keepPreviousData,
  });
}

export function useRecurringExpenses() {
  return useQuery({ queryKey: expenseKeys.recurring(), queryFn: fetchRecurringExpenses });
}

/**
 * Cualquier mutación invalida las dos vistas: crear una plantilla hace que la
 * siguiente lectura genere egresos, y borrar un egreso puede cambiar el
 * próximo vencimiento que muestra la otra pestaña.
 */
function useInvalidateExpenses() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: expenseKeys.all });
}

export function useCreateExpense() {
  const invalidate = useInvalidateExpenses();
  return useMutation({
    mutationFn: (input: CreateExpenseInput) => createExpense(input),
    onSuccess: invalidate,
  });
}

export function useUpdateExpense() {
  const invalidate = useInvalidateExpenses();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateExpenseInput }) => updateExpense(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteExpense() {
  const invalidate = useInvalidateExpenses();
  return useMutation({ mutationFn: (id: string) => deleteExpense(id), onSuccess: invalidate });
}

export function useCreateRecurringExpense() {
  const invalidate = useInvalidateExpenses();
  return useMutation({
    mutationFn: (input: CreateRecurringExpenseInput) => createRecurringExpense(input),
    onSuccess: invalidate,
  });
}

export function useUpdateRecurringExpense() {
  const invalidate = useInvalidateExpenses();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRecurringExpenseInput }) =>
      updateRecurringExpense(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteRecurringExpense() {
  const invalidate = useInvalidateExpenses();
  return useMutation({
    mutationFn: (id: string) => deleteRecurringExpense(id),
    onSuccess: invalidate,
  });
}
