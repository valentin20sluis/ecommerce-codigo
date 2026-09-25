"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { useUpdateTaxSettings } from "@/modules/finance/hooks/use-taxes";
import {
  formatRateBpsAsPercent,
  incomeTaxRateFormSchema,
  toUpdateTaxSettingsInput,
  type IncomeTaxRateFormValues,
} from "@/modules/finance/schemas/taxes.schema";

type IncomeTaxRateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRateBps: number;
};

export function IncomeTaxRateDialog({ open, onOpenChange, currentRateBps }: IncomeTaxRateDialogProps) {
  const updateSettings = useUpdateTaxSettings();

  const form = useForm<IncomeTaxRateFormValues>({
    resolver: zodResolver(incomeTaxRateFormSchema),
    defaultValues: { rate: formatRateBpsAsPercent(currentRateBps) },
  });

  const { formState, handleSubmit, register, reset } = form;
  const resetMutation = updateSettings.reset;

  useEffect(() => {
    if (!open) return;

    resetMutation();
    reset({ rate: formatRateBpsAsPercent(currentRateBps) });
  }, [open, currentRateBps, reset, resetMutation]);

  function onSubmit(values: IncomeTaxRateFormValues) {
    updateSettings.mutate(toUpdateTaxSettingsInput(values), {
      onSuccess: () => {
        toast.success("Tasa de renta actualizada.");
        onOpenChange(false);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar tasa de impuesto a la renta</DialogTitle>
          <DialogDescription>
            Se usa para estimar la renta de cualquier periodo, incluidos los pasados. El régimen
            general es 29.5 %.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="income-tax-rate">Tasa (%)</FieldLabel>
            <Input id="income-tax-rate" inputMode="decimal" placeholder="29.5" {...register("rate")} />
            <FieldDescription>Entre 0 y 100, con hasta dos decimales.</FieldDescription>
            <FieldError errors={[formState.errors.rate]} />
          </Field>

          {updateSettings.error ? (
            <p role="alert" className="text-destructive text-sm">
              {updateSettings.error.message}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateSettings.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={updateSettings.isPending}>
              {updateSettings.isPending ? "Guardando…" : "Guardar tasa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
