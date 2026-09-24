"use client";

import { useMemo } from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";

import { createDataTableColumnHelper, DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPriceFromCents } from "@/lib/utils";
import { EXPENSE_CATEGORY_LABEL, formatDateOnly } from "@/modules/finance/constants";
import type { ExpenseDto } from "@/modules/finance/types/expense";

type ExpensesTableProps = {
  rows: ExpenseDto[];
  isLoading: boolean;
  errorMessage: string | null;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onEdit: (row: ExpenseDto) => void;
  onDelete: (row: ExpenseDto) => void;
  /** Sin `finance.manage_expenses` la tabla se ve completa, sin acciones (017 AC4). */
  canManage: boolean;
};

const helper = createDataTableColumnHelper<ExpenseDto>();

export function ExpensesTable({
  rows,
  isLoading,
  errorMessage,
  page,
  pageSize,
  total,
  onPageChange,
  onEdit,
  onDelete,
  canManage,
}: ExpensesTableProps) {
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("incurredOn", {
          header: "Fecha",
          cell: (context) => (
            <span className="whitespace-nowrap">{formatDateOnly(context.getValue())}</span>
          ),
        }),
        helper.accessor("category", {
          header: "Categoría",
          cell: (context) => <Badge variant="outline">{EXPENSE_CATEGORY_LABEL[context.getValue()]}</Badge>,
        }),
        helper.accessor("description", {
          header: "Descripción",
          cell: (context) => {
            const row = context.row.original;

            return (
              <div className="flex items-center gap-2">
                <span className="text-sm">{row.description}</span>
                {row.recurringExpenseId ? <Badge variant="secondary">Recurrente</Badge> : null}
              </div>
            );
          },
        }),
        helper.accessor("amountCents", {
          header: "Monto",
          cell: (context) => (
            <span className="tabular-nums">{formatPriceFromCents(context.getValue())}</span>
          ),
        }),
        helper.display({
          id: "actions",
          header: "Acciones",
          cell: (context) => {
            if (!canManage) return null;
            const row = context.row.original;

            return (
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(row)}
                  aria-label={`Editar ${row.description}`}
                >
                  <PencilIcon className="size-4" />
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(row)}
                  aria-label={`Eliminar ${row.description}`}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            );
          },
        }),
      ]),
    [canManage, onDelete, onEdit],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      errorMessage={errorMessage}
      emptyMessage="No hay egresos en el rango elegido."
      pagination={{ page, pageSize, total, onPageChange }}
    />
  );
}
