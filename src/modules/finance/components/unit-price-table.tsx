"use client";

import { useMemo } from "react";
import { PencilIcon } from "lucide-react";

import { createDataTableColumnHelper, DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { formatPriceFromCents } from "@/lib/utils";
import type { UnitPriceRowDto } from "@/modules/finance/types/finance";

type UnitPriceTableProps = {
  rows: UnitPriceRowDto[];
  isLoading: boolean;
  errorMessage: string | null;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onEditCost: (row: UnitPriceRowDto) => void;
  /** Sin `finance.manage_costs` la tabla se ve completa, pero sin acción de editar. */
  canManageCosts: boolean;
};

const helper = createDataTableColumnHelper<UnitPriceRowDto>();

/** "Sin dato" en vez de 0%/NaN cuando el producto todavía no tiene costo (015 D5). */
function marginLabel(marginCents: number | null, marginPercent: number | null): string {
  if (marginCents === null || marginPercent === null) return "Sin dato";
  return `${formatPriceFromCents(marginCents)} (${marginPercent}%)`;
}

export function UnitPriceTable({
  rows,
  isLoading,
  errorMessage,
  page,
  pageSize,
  total,
  onPageChange,
  onEditCost,
  canManageCosts,
}: UnitPriceTableProps) {
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("name", {
          header: "Producto",
          cell: (context) => {
            const row = context.row.original;

            return (
              <div className="flex flex-col">
                <span className="text-sm font-medium">{row.name}</span>
                <span className="text-muted-foreground font-mono text-xs">{row.sku ?? "—"}</span>
              </div>
            );
          },
        }),
        helper.accessor("priceCents", {
          header: "Precio",
          cell: (context) => (
            <span className="tabular-nums">{formatPriceFromCents(context.getValue())}</span>
          ),
        }),
        helper.accessor("costCents", {
          header: "Costo",
          cell: (context) => {
            const value = context.getValue();
            return (
              <span className="text-muted-foreground tabular-nums">
                {value === null ? "Sin dato" : formatPriceFromCents(value)}
              </span>
            );
          },
        }),
        helper.display({
          id: "margin",
          header: "Margen",
          cell: (context) => {
            const row = context.row.original;
            return <span className="tabular-nums">{marginLabel(row.marginCents, row.marginPercent)}</span>;
          },
        }),
        helper.display({
          id: "actions",
          header: "Acciones",
          cell: (context) => {
            const row = context.row.original;

            if (!canManageCosts) return null;

            return (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditCost(row)}
                  aria-label={`Editar el costo de ${row.name}`}
                >
                  <PencilIcon className="size-4" />
                  Editar costo
                </Button>
              </div>
            );
          },
        }),
      ]),
    [canManageCosts, onEditCost],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      errorMessage={errorMessage}
      emptyMessage="No hay productos que coincidan con la búsqueda."
      pagination={{ page, pageSize, total, onPageChange }}
    />
  );
}
