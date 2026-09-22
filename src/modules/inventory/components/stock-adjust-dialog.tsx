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
import { Textarea } from "@/components/ui/textarea";
import { MANUAL_MOVEMENT_HINT, STOCK_MOVEMENT_VIEW } from "@/modules/inventory/constants";
import { useCreateStockMovement } from "@/modules/inventory/hooks/use-inventory";
import {
  MANUAL_MOVEMENT_TYPES,
  stockAdjustFormSchema,
  toStockMovementInput,
  type CreateStockMovementInput,
  type ManualMovementType,
  type StockAdjustFormValues,
} from "@/modules/inventory/schemas/inventory.schema";
import type { InventoryRowDto } from "@/modules/inventory/types/inventory";

type StockAdjustDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: InventoryRowDto | null;
};

function emptyValues(stock: number): StockAdjustFormValues {
  return { type: "adjustment", qty: "1", countedStock: String(stock), reason: "" };
}

/** Stock que quedará si el movimiento se aplica sobre el valor que ve el admin. */
function previewStock(values: StockAdjustFormValues, stock: number): number | null {
  const qty = Number.parseInt(values.type === "adjustment" ? values.countedStock : values.qty, 10);
  if (!Number.isFinite(qty)) return null;

  if (values.type === "adjustment") return qty;
  return values.type === "waste" ? stock - qty : stock + qty;
}

export function StockAdjustDialog({ open, onOpenChange, product }: StockAdjustDialogProps) {
  const createMovement = useCreateStockMovement(product?.id ?? null);

  const form = useForm<StockAdjustFormValues>({
    resolver: zodResolver(stockAdjustFormSchema),
    defaultValues: emptyValues(0),
  });

  const { clearErrors, control, formState, handleSubmit, register, reset, setError } = form;
  const resetMutation = createMovement.reset;

  useEffect(() => {
    if (!open || !product) return;

    // Un 409 de la vez anterior no debe seguir en pantalla al reabrir.
    resetMutation();
    reset(emptyValues(product.stock));
  }, [open, product, reset, resetMutation]);

  const values = useWatch({ control });
  const type = (values.type ?? "adjustment") as ManualMovementType;

  if (!product) return null;

  const projected = previewStock(
    {
      type,
      qty: values.qty ?? "",
      countedStock: values.countedStock ?? "",
      reason: values.reason ?? "",
    },
    product.stock,
  );

  function onSubmit(formValues: StockAdjustFormValues) {
    const target = product;
    if (!target) return;

    clearErrors("root");

    let input: CreateStockMovementInput;

    try {
      // `expectedStock` sale del listado, no de un campo editable: si cambió
      // entre la carga y el guardado, la API responde 409 (AC2).
      input = toStockMovementInput(formValues, target.stock);
    } catch (error) {
      // El formulario validó pero el contrato no: es un desajuste entre ambos
      // schemas, así que se ve en pantalla en vez de morir en silencio.
      console.error("[inventory] formulario válido con body inválido", error);
      setError("root", {
        message: "No se pudo preparar el movimiento. Revisa la cantidad y el motivo.",
      });
      return;
    }

    // `mutate` (no `mutateAsync`) para no envolver la llamada en un catch vacío:
    // el fallo del servidor ya se muestra desde `createMovement.error`.
    createMovement.mutate(input, {
      onSuccess: () => {
        toast.success(`Stock de «${target.name}» actualizado.`);
        onOpenChange(false);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajustar stock de «{product.name}»</DialogTitle>
          <DialogDescription>
            Stock actual: {product.stock} u. Cada movimiento queda en el kardex y en la bitácora.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="stock-movement-type">Tipo de movimiento</FieldLabel>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="stock-movement-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MANUAL_MOVEMENT_TYPES.map((movementType) => (
                      <SelectItem key={movementType} value={movementType}>
                        {STOCK_MOVEMENT_VIEW[movementType].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldDescription>{MANUAL_MOVEMENT_HINT[type]}</FieldDescription>
          </Field>

          {type === "adjustment" ? (
            <Field>
              <FieldLabel htmlFor="stock-counted">Stock contado</FieldLabel>
              <Input
                id="stock-counted"
                inputMode="numeric"
                placeholder="0"
                {...register("countedStock")}
              />
              <FieldError errors={[formState.errors.countedStock]} />
            </Field>
          ) : (
            <Field>
              <FieldLabel htmlFor="stock-qty">Cantidad</FieldLabel>
              <Input id="stock-qty" inputMode="numeric" placeholder="1" {...register("qty")} />
              <FieldError errors={[formState.errors.qty]} />
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="stock-reason">
              Motivo{type === "restock" ? " (opcional)" : ""}
            </FieldLabel>
            <Textarea
              id="stock-reason"
              rows={2}
              placeholder="Qué pasó y por qué cambia el stock."
              {...register("reason")}
            />
            <FieldError errors={[formState.errors.reason]} />
          </Field>

          {projected !== null ? (
            <p className="text-muted-foreground text-sm">
              Stock resultante: <span className="text-foreground font-medium">{projected} u.</span>
              {projected < 0 ? " — quedará en negativo." : null}
            </p>
          ) : null}

          {formState.errors.root ? (
            <p role="alert" className="text-destructive text-sm">
              {formState.errors.root.message}
            </p>
          ) : null}

          {createMovement.error ? (
            <p role="alert" className="text-destructive text-sm">
              {createMovement.error.message}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMovement.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createMovement.isPending}>
              {createMovement.isPending ? "Registrando…" : "Registrar movimiento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
