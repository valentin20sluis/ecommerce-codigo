"use client";

import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDeleteProduct } from "@/modules/products/hooks/use-product-mutations";
import type { ProductListItemDto } from "@/modules/products/types";

type ProductDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductListItemDto | null;
};

export function ProductDeleteDialog({ open, onOpenChange, product }: ProductDeleteDialogProps) {
  const deleteProduct = useDeleteProduct();

  async function onConfirm() {
    if (!product) return;

    try {
      await deleteProduct.mutateAsync(product.id);
      toast.success(`Producto "${product.name}" eliminado.`);
      onOpenChange(false);
    } catch {
      // El mensaje del servidor se muestra dentro del diálogo.
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar «{product?.name}»</AlertDialogTitle>
          <AlertDialogDescription>
            El borrado es definitivo y no se puede deshacer. Si solo quieres retirarlo del
            catálogo, edítalo y desmarca «Activo».
          </AlertDialogDescription>
        </AlertDialogHeader>

        {deleteProduct.error ? (
          <p role="alert" className="text-destructive text-sm">
            {deleteProduct.error.message}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteProduct.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void onConfirm();
            }}
            disabled={deleteProduct.isPending}
          >
            {deleteProduct.isPending ? "Eliminando…" : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
