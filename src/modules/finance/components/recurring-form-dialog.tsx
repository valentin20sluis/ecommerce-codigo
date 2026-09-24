"use client";

import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
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
import {
  useCreateRecurringExpense,
  useUpdateRecurringExpense,
} from "@/modules/finance/hooks/use-expenses";
import { dueOccurrences, toUtcDateString } from "@/modules/finance/recurring";
import {
  EXPENSE_CATEGORY_VALUES,
  recurringFormSchema,
  toCreateRecurringInput,
  toUpdateRecurringInput,
  type ExpenseCategoryValue,
  type RecurringFormValues,
} from "@/modules/finance/schemas/expense.schema";
import type { RecurringExpenseDto } from "@/modules/finance/types/expense";

type RecurringFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` = alta. */
  template: RecurringExpenseDto | null;
};

function initialValues(template: RecurringExpenseDto | null): RecurringFormValues {
  if (!template) {
    return {
      category: "other",
      description: "",
      amount: "",
      dayOfMonth: "1",
      startsOn: toLocalDateString(new Date().toISOString()),
      endsOn: "",
      isActive: true,
    };
  }

  return {
    category: template.category,
    description: template.description,
    amount: (template.amountCents / 100).toFixed(2),
    dayOfMonth: String(template.dayOfMonth),
    startsOn: template.startsOn,
    endsOn: template.endsOn ?? "",
    isActive: template.isActive,
  };
}

/** Cuántos egresos de meses pasados generará el alta (017 D8): el aviso del formulario. */
function pastOccurrencesCount(values: Partial<RecurringFormValues>): number {
  const dayOfMonth = Number.parseInt(values.dayOfMonth ?? "", 10);
  if (!values.startsOn || !/^\d{4}-\d{2}-\d{2}$/.test(values.startsOn)) return 0;
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) return 0;

  return dueOccurrences(
    {
      dayOfMonth,
      startsOn: values.startsOn,
      endsOn: values.endsOn ? values.endsOn : null,
      generatedThrough: null,
    },
    toUtcDateString(new Date()),
  ).length;
}

export function RecurringFormDialog({ open, onOpenChange, template }: RecurringFormDialogProps) {
  const createMutation = useCreateRecurringExpense();
  const updateMutation = useUpdateRecurringExpense();
  const mutation = template ? updateMutation : createMutation;

  const form = useForm<RecurringFormValues>({
    resolver: zodResolver(recurringFormSchema),
    defaultValues: initialValues(null),
  });

  const { control, formState, handleSubmit, register, reset } = form;
  const resetCreate = createMutation.reset;
  const resetUpdate = updateMutation.reset;

  useEffect(() => {
    if (!open) return;

    resetCreate();
    resetUpdate();
    reset(initialValues(template));
  }, [open, template, reset, resetCreate, resetUpdate]);

  const watched = useWatch({ control });
  const backfill = template ? 0 : pastOccurrencesCount(watched);

  function onSubmit(values: RecurringFormValues) {
    const onSuccess = () => {
      toast.success(template ? "Plantilla actualizada." : "Plantilla creada.");
      onOpenChange(false);
    };

    if (template) {
      updateMutation.mutate({ id: template.id, input: toUpdateRecurringInput(values) }, { onSuccess });
    } else {
      createMutation.mutate(toCreateRecurringInput(values), { onSuccess });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Editar plantilla" : "Nueva plantilla recurrente"}</DialogTitle>
          <DialogDescription>
            Genera un egreso cada mes de forma automática. Editarla solo afecta los próximos
            vencimientos; lo ya generado no cambia.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="recurring-category">Categoría</FieldLabel>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="recurring-category" className="w-full">
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
            <FieldLabel htmlFor="recurring-description">Descripción</FieldLabel>
            <Input id="recurring-description" placeholder="Alquiler del local" {...register("description")} />
            <FieldError errors={[formState.errors.description]} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="recurring-amount">Monto mensual</FieldLabel>
              <Input id="recurring-amount" inputMode="decimal" placeholder="0.00" {...register("amount")} />
              <FieldError errors={[formState.errors.amount]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="recurring-day">Día del mes</FieldLabel>
              <Input id="recurring-day" inputMode="numeric" placeholder="1" {...register("dayOfMonth")} />
              <FieldDescription>Del 29 al 31, en meses cortos cae el último día.</FieldDescription>
              <FieldError errors={[formState.errors.dayOfMonth]} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="recurring-starts">Empieza el</FieldLabel>
              <Input id="recurring-starts" type="date" disabled={template !== null} {...register("startsOn")} />
              {template ? (
                <FieldDescription>No se edita: crea otra plantilla para otra fecha.</FieldDescription>
              ) : null}
              <FieldError errors={[formState.errors.startsOn]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="recurring-ends">Termina el (opcional)</FieldLabel>
              <Input id="recurring-ends" type="date" {...register("endsOn")} />
              <FieldError errors={[formState.errors.endsOn]} />
            </Field>
          </div>

          {template ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4" {...register("isActive")} />
              Activa (desmárcala para pausarla; al reactivarla no se generan los meses en pausa)
            </label>
          ) : null}

          {backfill > 0 ? (
            <p className="text-muted-foreground text-sm">
              Se generarán {backfill} egreso(s) de meses pasados al guardar.
            </p>
          ) : null}

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
