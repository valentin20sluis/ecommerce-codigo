"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  auditLogsQuerySchema,
  type AuditLogsQuery,
} from "@/modules/audit/schemas/audit-log.schema";
import { fetchAuditLogs } from "@/modules/audit/services/audit-log.service";

export const auditLogKeys = {
  all: ["audit-logs"] as const,
  list: (query: AuditLogsQuery) => [...auditLogKeys.all, query] as const,
};

export type AuditLogFiltersState = Omit<AuditLogsQuery, "page" | "pageSize">;

const DEFAULT_QUERY: AuditLogsQuery = { page: 1, pageSize: 50 };

export function useAuditLogs(query: AuditLogsQuery) {
  return useQuery({
    queryKey: auditLogKeys.list(query),
    queryFn: () => fetchAuditLogs(query),
    // Mantiene la página anterior visible mientras llega la siguiente.
    placeholderData: keepPreviousData,
  });
}

/**
 * Única traducción entre la URL y `auditLogsQuerySchema`: la vista es
 * compartible por enlace y sobrevive al refresco.
 */
export function useAuditLogFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = useMemo<AuditLogsQuery>(() => {
    const parsed = auditLogsQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
    return parsed.success ? parsed.data : DEFAULT_QUERY;
  }, [searchParams]);

  const push = useCallback(
    (next: AuditLogsQuery) => {
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
    (patch: Partial<AuditLogFiltersState>) => push({ ...query, ...patch, page: 1 }),
    [push, query],
  );

  const setPage = useCallback((page: number) => push({ ...query, page }), [push, query]);

  const reset = useCallback(() => push(DEFAULT_QUERY), [push]);

  return { query, setFilters, setPage, reset };
}
