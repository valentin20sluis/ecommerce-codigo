"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EXPENSE_CATEGORY_LABEL } from "@/modules/finance/constants";
import { toLocalDateString } from "@/modules/finance/expense-range";
import { useCreateExpense, useUpdateExpense } from "@/modules/finance/hooks/use-expenses";
import {
  EXPENSE_CATEGORY_VALUES,
  expenseFormSchema,
  toCreateExpenseInput,
  type ExpenseCategoryValue,
  type ExpenseFormValues,
} from "@/modules/finance/schemas/expense.schema";
import type { ExpenseDto } from "@/modules/finance/types/expense";

type ExpenseFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` = alta. */
  expense: ExpenseDto | null;
};

function initialValues(expense: ExpenseDto | null): ExpenseFormValues {
  if (!expense) {
    return {
      category: "other",
      description: "",
      amount: "",
      incurredOn: toLocalDateString(new Date().toISOString()),
    };
  }

  return {
    category: expense.category,
    description: expense.description,
    amount: (expense.amountCents / 100).toFixed(2),
    incurredOn: expense.incurredOn,
  };
}

export function ExpenseFormDialog({ open, onOpenChange, expense }: ExpenseFormDialogProps) {
  const createMutation = useCreateExpense();
  const updateMutation = useUpdateExpense();
  const mutation = expense ? updateMutation : createMutation;

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: initialValues(null),
  });

  const { control, formState, handleSubmit, register, reset } = form;
  const resetCreate = createMutation.reset;
  const resetUpdate = updateMutation.reset;

  useEffect(() => {
    if (!open) return;

    resetCreate();
    resetUpdate();
    reset(initialValues(expense));
  }, [open, expense, reset, resetCreate, resetUpdate]);

  function onSubmit(values: ExpenseFormValues) {
    const input = toCreateExpenseInput(values);
    const onSuccess = () => {
      toast.success(expense ? "Egreso actualizado." : "Egreso registrado.");
      onOpenChange(false);
    };

    if (expense) updateMutation.mutate({ id: expense.id, input }, { onSuccess });
    else createMutation.mutate(input, { onSuccess });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{expense ? "Editar egreso" : "Nuevo egreso"}</DialogTitle>
          <DialogDescription>
            Gastos operativos del negocio. La compra de mercadería no se registra aquí: su costo ya
            está en el costo por producto.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="expense-category">Categoría</FieldLabel>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="expense-category" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORY_VALUES.map((category: ExpenseCategoryValue) => (
                      <SelectItem key={category} value={category}>
                        {EXPENSE_CATEGORY_LABEL[category]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[formState.errors.category]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="expense-description">Descripción</FieldLabel>
            <Input id="expense-description" placeholder="Alquiler de marzo" {...register("description")} />
            <FieldError errors={[formState.errors.description]} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="expense-amount">Monto</FieldLabel>
              <Input id="expense-amount" inputMode="decimal" placeholder="0.00" {...register("amount")} />
              <FieldError errors={[formState.errors.amount]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="expense-date">Fecha</FieldLabel>
              <Input id="expense-date" type="date" {...register("incurredOn")} />
              <FieldError errors={[formState.errors.incurredOn]} />
            </Field>
          </div>

          {mutation.error ? (
            <p role="alert" className="text-destructive text-sm">
              {mutation.error.message}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
