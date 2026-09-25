"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { currentUtcMonth, recentUtcMonths } from "@/modules/finance/profit";
import { fetchProfitStatement } from "@/modules/finance/services/profit.service";

export const profitKeys = {
  all: ["finance", "profit"] as const,
  statement: (month: string) => [...profitKeys.all, "statement", month] as const,
};

const SELECTABLE_MONTHS = 24;

/**
 * Mes elegido en `?month=` (020 D7). Solo vale un mes de la lista del selector:
 * cualquier otro valor (mal formado, futuro o fuera de los 24) cae al mes
 * actual, así el `Select` nunca queda con un valor que no puede mostrar.
 */
export function useProfitMonth() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const now = useMemo(() => new Date(), []);
  const months = useMemo(() => recentUtcMonths(now, SELECTABLE_MONTHS), [now]);

  const requested = searchParams.get("month");
  const month = requested && months.includes(requested) ? requested : currentUtcMonth(now);

  const setMonth = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("month", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return { month, months, setMonth };
}

export function useProfitStatement(month: string) {
  return useQuery({
    queryKey: profitKeys.statement(month),
    queryFn: () => fetchProfitStatement({ month }),
  });
}
