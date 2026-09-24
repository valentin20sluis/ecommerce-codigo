"use client";

import { useMemo } from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";

import { createDataTableColumnHelper, DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPriceFromCents } from "@/lib/utils";
import { EXPENSE_CATEGORY_LABEL, formatDateOnly } from "@/modules/finance/constants";
import type { RecurringExpenseDto } from "@/modules/finance/types/expense";

type RecurringExpensesTableProps = {
  rows: RecurringExpenseDto[];
  isLoading: boolean;
  errorMessage: string | null;
  onEdit: (row: RecurringExpenseDto) => void;
  onDelete: (row: RecurringExpenseDto) => void;
  canManage: boolean;
};

const helper = createDataTableColumnHelper<RecurringExpenseDto>();

export function RecurringExpensesTable({
  rows,
  isLoading,
  errorMessage,
  onEdit,
  onDelete,
  canManage,
}: RecurringExpensesTableProps) {
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("description", {
          header: "Plantilla",
          cell: (context) => {
            const row = context.row.original;

            return (
              <div className="flex flex-col">
                <span className="text-sm font-medium">{row.description}</span>
                <span className="text-muted-foreground text-xs">
                  {EXPENSE_CATEGORY_LABEL[row.category]}
                </span>
              </div>
            );
          },
        }),
        helper.accessor("amountCents", {
          header: "Monto mensual",
          cell: (context) => (
            <span className="tabular-nums">{formatPriceFromCents(context.getValue())}</span>
          ),
        }),
        helper.accessor("dayOfMonth", {
          header: "Día",
          cell: (context) => <span className="tabular-nums">{context.getValue()}</span>,
        }),
        helper.accessor("nextDueOn", {
          header: "Próximo vencimiento",
          cell: (context) => {
            const value = context.getValue();

            return (
              <span className="text-muted-foreground whitespace-nowrap">
                {value ? formatDateOnly(value) : "—"}
              </span>
            );
          },
        }),
        helper.accessor("isActive", {
          header: "Estado",
          cell: (context) => (
            <Badge variant={context.getValue() ? "default" : "outline"}>
              {context.getValue() ? "Activa" : "Pausada"}
            </Badge>
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
      emptyMessage="Todavía no hay plantillas recurrentes."
    />
  );
}
