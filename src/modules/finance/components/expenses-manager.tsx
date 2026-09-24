"use client";

import { useCallback, useState } from "react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPriceFromCents } from "@/lib/utils";
import { ConfirmDeleteDialog } from "@/modules/finance/components/confirm-delete-dialog";
import { ExpenseFiltersBar } from "@/modules/finance/components/expense-filters";
import { ExpenseFormDialog } from "@/modules/finance/components/expense-form-dialog";
import { ExpensesTable } from "@/modules/finance/components/expenses-table";
import { RecurringExpensesTable } from "@/modules/finance/components/recurring-expenses-table";
import { RecurringFormDialog } from "@/modules/finance/components/recurring-form-dialog";
import {
  EXPENSES_PAGE_SIZE,
  useDeleteExpense,
  useDeleteRecurringExpense,
  useExpenseFilters,
  useExpenses,
  useRecurringExpenses,
} from "@/modules/finance/hooks/use-expenses";
import type { ExpenseDto, RecurringExpenseDto } from "@/modules/finance/types/expense";

type ExpensesManagerProps = {
  /** Lo resuelve la página en servidor con `can('finance.manage_expenses')`. */
  canManage: boolean;
};

export function ExpensesManager({ canManage }: ExpensesManagerProps) {
  const { filters, query, setPreset, setCustomRange, setCategory, setPage } = useExpenseFilters();
  const expenses = useExpenses(query);
  const recurring = useRecurringExpenses();

  const deleteExpense = useDeleteExpense();
  const deleteRecurring = useDeleteRecurringExpense();

  const [expenseForm, setExpenseForm] = useState<ExpenseDto | "new" | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseDto | null>(null);
  const [recurringForm, setRecurringForm] = useState<RecurringExpenseDto | "new" | null>(null);
  const [recurringToDelete, setRecurringToDelete] = useState<RecurringExpenseDto | null>(null);

  const { reset: resetDeleteExpense } = deleteExpense;
  const { reset: resetDeleteRecurring } = deleteRecurring;

  const askDeleteExpense = useCallback(
    (row: ExpenseDto) => {
      resetDeleteExpense();
      setExpenseToDelete(row);
    },
    [resetDeleteExpense],
  );

  const askDeleteRecurring = useCallback(
    (row: RecurringExpenseDto) => {
      resetDeleteRecurring();
      setRecurringToDelete(row);
    },
    [resetDeleteRecurring],
  );

  const editExpense = useCallback((row: ExpenseDto) => setExpenseForm(row), []);
  const editRecurring = useCallback((row: RecurringExpenseDto) => setRecurringForm(row), []);

  function confirmDeleteExpense() {
    const target = expenseToDelete;
    if (!target) return;

    deleteExpense.mutate(target.id, {
      onSuccess: () => {
        toast.success("Egreso eliminado.");
        setExpenseToDelete(null);
      },
    });
  }

  function confirmDeleteRecurring() {
    const target = recurringToDelete;
    if (!target) return;

    deleteRecurring.mutate(target.id, {
      onSuccess: () => {
        toast.success("Plantilla eliminada. Los egresos ya generados se conservan.");
        setRecurringToDelete(null);
      },
    });
  }

  return (
    <>
      <Tabs defaultValue="expenses">
        <TabsList>
          <TabsTrigger value="expenses">Egresos</TabsTrigger>
          <TabsTrigger value="recurring">Recurrentes</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="flex flex-col gap-5 pt-3">
          <ExpenseFiltersBar
            filters={filters}
            onPresetChange={setPreset}
            onCustomRangeChange={setCustomRange}
            onCategoryChange={setCategory}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              Total del filtro:{" "}
              <strong className="tabular-nums">
                {formatPriceFromCents(expenses.data?.totalCents ?? 0)}
              </strong>{" "}
              <span className="text-muted-foreground">
                · {expenses.data?.meta.total ?? 0} egreso(s)
              </span>
            </p>

            {canManage ? (
              <Button size="sm" onClick={() => setExpenseForm("new")}>
                <PlusIcon className="size-4" />
                Nuevo egreso
              </Button>
            ) : null}
          </div>

          {query === null ? (
            <p className="text-muted-foreground text-sm">Elige un rango de fechas para ver los egresos.</p>
          ) : null}

          <ExpensesTable
            rows={expenses.data?.data ?? []}
            isLoading={expenses.isLoading}
            errorMessage={expenses.error?.message ?? null}
            page={filters.page}
            pageSize={EXPENSES_PAGE_SIZE}
            total={expenses.data?.meta.total ?? 0}
            onPageChange={setPage}
            onEdit={editExpense}
            onDelete={askDeleteExpense}
            canManage={canManage}
          />
        </TabsContent>

        <TabsContent value="recurring" className="flex flex-col gap-5 pt-3">
          {canManage ? (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setRecurringForm("new")}>
                <PlusIcon className="size-4" />
                Nueva plantilla
              </Button>
            </div>
          ) : null}

          <RecurringExpensesTable
            rows={recurring.data ?? []}
            isLoading={recurring.isLoading}
            errorMessage={recurring.error?.message ?? null}
            onEdit={editRecurring}
            onDelete={askDeleteRecurring}
            canManage={canManage}
          />
        </TabsContent>
      </Tabs>

      <ExpenseFormDialog
        open={expenseForm !== null}
        onOpenChange={(open) => (open ? undefined : setExpenseForm(null))}
        expense={expenseForm === "new" ? null : expenseForm}
      />

      <RecurringFormDialog
        open={recurringForm !== null}
        onOpenChange={(open) => (open ? undefined : setRecurringForm(null))}
        template={recurringForm === "new" ? null : recurringForm}
      />

      <ConfirmDeleteDialog
        open={expenseToDelete !== null}
        onOpenChange={(open) => (open ? undefined : setExpenseToDelete(null))}
        title={`Eliminar «${expenseToDelete?.description ?? ""}»`}
        description="El borrado es definitivo. Queda una copia completa del egreso en la bitácora de auditoría."
        isPending={deleteExpense.isPending}
        errorMessage={deleteExpense.error?.message ?? null}
        onConfirm={confirmDeleteExpense}
      />

      <ConfirmDeleteDialog
        open={recurringToDelete !== null}
        onOpenChange={(open) => (open ? undefined : setRecurringToDelete(null))}
        title={`Eliminar «${recurringToDelete?.description ?? ""}»`}
        description="Dejará de generar egresos. Los ya generados se conservan. Si solo quieres detenerla un tiempo, edítala y desmarca «Activa»."
        isPending={deleteRecurring.isPending}
        errorMessage={deleteRecurring.error?.message ?? null}
        onConfirm={confirmDeleteRecurring}
      />
    </>
  );
}
