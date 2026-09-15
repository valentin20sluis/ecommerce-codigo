"use client";

import { useCallback, useState } from "react";

import { AuditLogDetailSheet } from "@/modules/audit/components/audit-log-detail-sheet";
import { AuditLogFilters } from "@/modules/audit/components/audit-log-filters";
import { AuditLogTable } from "@/modules/audit/components/audit-log-table";
import { useAuditLogFilters, useAuditLogs } from "@/modules/audit/hooks/use-audit-logs";
import type { AuditLogListItem } from "@/modules/audit/types";

export function AuditLogExplorer() {
  const { query, setFilters, setPage, reset } = useAuditLogFilters();
  const logs = useAuditLogs(query);

  const [selected, setSelected] = useState<AuditLogListItem | null>(null);
  const [isDetailOpen, setDetailOpen] = useState(false);

  const onSelect = useCallback((log: AuditLogListItem) => {
    setSelected(log);
    setDetailOpen(true);
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <AuditLogFilters filters={query} onChange={setFilters} onReset={reset} />

      <AuditLogTable
        logs={logs.data?.data ?? []}
        isLoading={logs.isLoading}
        errorMessage={logs.error?.message ?? null}
        page={query.page}
        pageSize={query.pageSize}
        total={logs.data?.meta.total ?? 0}
        onPageChange={setPage}
        onSelect={onSelect}
      />

      <AuditLogDetailSheet open={isDetailOpen} onOpenChange={setDetailOpen} log={selected} />
    </div>
  );
}
