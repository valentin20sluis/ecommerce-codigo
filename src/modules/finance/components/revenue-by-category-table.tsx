"use client";

import { useMemo } from "react";

import { createDataTableColumnHelper, DataTable } from "@/components/shared/data-table";
import { formatPriceFromCents } from "@/lib/utils";
import type { CategoryRevenueDto } from "@/modules/finance/types/revenue";

type RevenueByCategoryTableProps = {
  rows: CategoryRevenueDto[];
};

const helper = createDataTableColumnHelper<CategoryRevenueDto>();

export function RevenueByCategoryTable({ rows }: RevenueByCategoryTableProps) {
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("categoryName", {
          header: "Categoría",
          cell: (context) => <span className="text-sm font-medium">{context.getValue()}</span>,
        }),
        helper.accessor("revenueCents", {
          header: "Ingresos",
          cell: (context) => <span className="tabular-nums">{formatPriceFromCents(context.getValue())}</span>,
        }),
        helper.accessor("units", {
          header: "Unidades",
          cell: (context) => <span className="tabular-nums">{context.getValue()}</span>,
        }),
        helper.accessor("marginCents", {
          header: "Margen",
          cell: (context) => {
            const value = context.getValue();
            return (
              <span className="text-muted-foreground tabular-nums">
                {value === null ? "Sin datos suficientes" : formatPriceFromCents(value)}
              </span>
            );
          },
        }),
      ]),
    [],
  );

  return (
    <DataTable columns={columns} data={rows} emptyMessage="Sin ventas en el rango." />
  );
}
