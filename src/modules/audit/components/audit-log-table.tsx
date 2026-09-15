"use client";

import { useMemo } from "react";

import { createDataTableColumnHelper, DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AuditLogListItem, AuditSeverity } from "@/modules/audit/types";

type AuditLogTableProps = {
  logs: AuditLogListItem[];
  isLoading: boolean;
  errorMessage: string | null;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onSelect: (log: AuditLogListItem) => void;
};

const SEVERITY_VARIANT: Record<AuditSeverity, "secondary" | "outline" | "destructive"> = {
  info: "secondary",
  warning: "outline",
  error: "destructive",
};

const helper = createDataTableColumnHelper<AuditLogListItem>();

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString("es", { dateStyle: "short", timeStyle: "medium" });
}

export function AuditLogTable({
  logs,
  isLoading,
  errorMessage,
  page,
  pageSize,
  total,
  onPageChange,
  onSelect,
}: AuditLogTableProps) {
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("createdAt", {
          header: "Fecha",
          cell: (context) => (
            <span className="text-muted-foreground font-mono text-xs whitespace-nowrap">
              {formatTimestamp(context.getValue())}
            </span>
          ),
        }),
        helper.accessor("action", {
          header: "Acción",
          cell: (context) => <span className="font-mono text-sm">{context.getValue()}</span>,
        }),
        helper.accessor("entityType", {
          header: "Entidad",
          cell: (context) => (
            <div className="flex flex-col">
              <span className="text-sm">{context.getValue()}</span>
              <span className="text-muted-foreground truncate font-mono text-xs">
                {context.row.original.entityId ?? "—"}
              </span>
            </div>
          ),
        }),
        helper.accessor("actor", {
          header: "Actor",
          cell: (context) => {
            const actor = context.getValue();
            return actor ? (
              <span className="text-sm">{actor.email}</span>
            ) : (
              <span className="text-muted-foreground text-sm">Sistema</span>
            );
          },
        }),
        helper.accessor("severity", {
          header: "Severidad",
          cell: (context) => (
            <Badge variant={SEVERITY_VARIANT[context.getValue()]}>{context.getValue()}</Badge>
          ),
        }),
        helper.display({
          id: "actions",
          header: "",
          cell: (context) => (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => onSelect(context.row.original)}>
                Ver detalle
              </Button>
            </div>
          ),
        }),
      ]),
    [onSelect],
  );

  return (
    <DataTable
      columns={columns}
      data={logs}
      isLoading={isLoading}
      errorMessage={errorMessage}
      emptyMessage="No hay eventos que coincidan con los filtros."
      pagination={{ page, pageSize, total, onPageChange }}
    />
  );
}
