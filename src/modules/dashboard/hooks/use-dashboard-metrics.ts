"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  DEFAULT_DASHBOARD_RANGE,
  metricsQuerySchema,
  type DashboardRange,
} from "@/modules/dashboard/schemas/metrics.schema";
import { fetchDashboardMetrics } from "@/modules/dashboard/services/metrics.service";

export const dashboardMetricKeys = {
  all: ["dashboard-metrics"] as const,
  byRange: (range: DashboardRange) => [...dashboardMetricKeys.all, range] as const,
};

/** Un minuto (D6): sin `refetchIntervalInBackground`, una pestaña oculta no consulta. */
const REFETCH_INTERVAL_MS = 60_000;

export function useDashboardMetrics(range: DashboardRange) {
  return useQuery({
    queryKey: dashboardMetricKeys.byRange(range),
    queryFn: () => fetchDashboardMetrics({ range }),
    refetchInterval: REFETCH_INTERVAL_MS,
    // Conserva los datos del rango anterior mientras llega el nuevo: el refetch
    // y el cambio de rango no devuelven la vista al skeleton (AC10).
    placeholderData: keepPreviousData,
  });
}

/**
 * Única traducción entre la URL y `metricsQuerySchema`: la vista es compartible
 * por enlace y un `?range=` inválido cae al default sin romper nada (AC3/AC9).
 */
export function useMetricsRange() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const range = useMemo<DashboardRange>(() => {
    const parsed = metricsQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
    return parsed.success ? parsed.data.range : DEFAULT_DASHBOARD_RANGE;
  }, [searchParams]);

  const setRange = useCallback(
    (next: DashboardRange) => {
      router.replace(`${pathname}?range=${next}`, { scroll: false });
    },
    [pathname, router],
  );

  return { range, setRange };
}
