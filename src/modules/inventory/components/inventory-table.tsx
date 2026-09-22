"use client";

import { useMemo } from "react";
import { HistoryIcon, SlidersHorizontalIcon } from "lucide-react";

import { createDataTableColumnHelper, DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { STOCK_LEVEL_VARIANT, stockLevel } from "@/modules/inventory/constants";
import type { InventoryRowDto } from "@/modules/inventory/types/inventory";

type InventoryTableProps = {
  rows: InventoryRowDto[];
  isLoading: boolean;
  errorMessage: string | null;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onAdjust: (row: InventoryRowDto) => void;
  onViewMovements: (row: InventoryRowDto) => void;
  /** Sin `inventory.adjust` la tabla se ve completa, pero sin botón de ajuste (AC8). */
  canAdjust: boolean;
};

const helper = createDataTableColumnHelper<InventoryRowDto>();

export function InventoryTable({
  rows,
  isLoading,
  errorMessage,
  page,
  pageSize,
  total,
  onPageChange,
  onAdjust,
  onViewMovements,
  canAdjust,
}: InventoryTableProps) {
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
        helper.accessor("categoryName", {
          header: "Categoría",
          cell: (context) => <span className="text-sm">{context.getValue()}</span>,
        }),
        helper.accessor("stock", {
          header: "Stock",
          cell: (context) => {
            const row = context.row.original;
            const level = stockLevel(row.stock, row.lowStockThreshold);

            return (
              <Badge variant={STOCK_LEVEL_VARIANT[level]} className="tabular-nums">
                {row.stock}
                {level === "negative" ? " · sobreventa" : null}
                {level === "low" ? " · bajo" : null}
              </Badge>
            );
          },
        }),
        helper.accessor("lowStockThreshold", {
          header: "Umbral",
          cell: (context) => (
            <span className="text-muted-foreground tabular-nums">{context.getValue()}</span>
          ),
        }),
        helper.accessor("isActive", {
          header: "Estado",
          cell: (context) => (
            <span className="text-muted-foreground text-xs">
              {context.getValue() ? "Activo" : "Inactivo"}
            </span>
          ),
        }),
        helper.accessor("updatedAt", {
          header: "Actualizado",
          cell: (context) => (
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              {formatDateTime(context.getValue())}
            </span>
          ),
        }),
        helper.display({
          id: "actions",
          header: "Acciones",
          cell: (context) => {
            const row = context.row.original;

            return (
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewMovements(row)}
                  aria-label={`Ver el kardex de ${row.name}`}
                >
                  <HistoryIcon className="size-4" />
                  Kardex
                </Button>
                {canAdjust ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAdjust(row)}
                    aria-label={`Ajustar el stock de ${row.name}`}
                  >
                    <SlidersHorizontalIcon className="size-4" />
                    Ajustar
                  </Button>
                ) : null}
              </div>
            );
          },
        }),
      ]),
    [canAdjust, onAdjust, onViewMovements],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      errorMessage={errorMessage}
      emptyMessage="No hay productos que coincidan con los filtros."
      pagination={{ page, pageSize, total, onPageChange }}
    />
  );
}
