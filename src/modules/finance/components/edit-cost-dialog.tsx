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
import { formatPriceFromCents } from "@/lib/utils";
import { useUpdateUnitPriceCost } from "@/modules/finance/hooks/use-unit-price";
import {
  costFormSchema,
  toUpdateCostInput,
  type CostFormValues,
} from "@/modules/finance/schemas/unit-price.schema";
import type { UnitPriceRowDto } from "@/modules/finance/types/finance";

type EditCostDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: UnitPriceRowDto | null;
};

function emptyValues(costCents: number | null): CostFormValues {
  return { cost: costCents === null ? "" : (costCents / 100).toFixed(2) };
}

export function EditCostDialog({ open, onOpenChange, product }: EditCostDialogProps) {
  const updateCost = useUpdateUnitPriceCost();

  const form = useForm<CostFormValues>({
    resolver: zodResolver(costFormSchema),
    defaultValues: emptyValues(null),
  });

  const { formState, handleSubmit, register, reset } = form;
  const resetMutation = updateCost.reset;

  useEffect(() => {
    if (!open || !product) return;

    resetMutation();
    reset(emptyValues(product.costCents));
  }, [open, product, reset, resetMutation]);

  if (!product) return null;

  function onSubmit(values: CostFormValues) {
    const target = product;
    if (!target) return;

    const input = toUpdateCostInput(values);

    updateCost.mutate(
      { productId: target.productId, input },
      {
        onSuccess: () => {
          toast.success(`Costo de «${target.name}» actualizado.`);
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar costo de «{product.name}»</DialogTitle>
          <DialogDescription>
            Precio de venta: {formatPriceFromCents(product.priceCents)}. Deja el campo vacío
            para borrar el costo cargado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="unit-cost">Costo unitario</FieldLabel>
            <Input id="unit-cost" inputMode="decimal" placeholder="0.00" {...register("cost")} />
            <FieldDescription>Mismo formato que el precio: hasta dos decimales.</FieldDescription>
            <FieldError errors={[formState.errors.cost]} />
          </Field>

          {updateCost.error ? (
            <p role="alert" className="text-destructive text-sm">
              {updateCost.error.message}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateCost.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={updateCost.isPending}>
              {updateCost.isPending ? "Guardando…" : "Guardar costo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
