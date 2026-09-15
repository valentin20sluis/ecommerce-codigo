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
import { useDeleteCategory } from "@/modules/categories/hooks/use-category-mutations";
import type { CategoryDto } from "@/modules/categories/types";

type CategoryDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: CategoryDto | null;
};

export function CategoryDeleteDialog({
  open,
  onOpenChange,
  category,
}: CategoryDeleteDialogProps) {
  const deleteCategory = useDeleteCategory();

  async function onConfirm() {
    if (!category) return;

    try {
      await deleteCategory.mutateAsync(category.id);
      toast.success(`Categoría "${category.name}" eliminada.`);
      onOpenChange(false);
    } catch {
      // El mensaje del servidor se muestra dentro del diálogo.
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar «{category?.name}»</AlertDialogTitle>
          <AlertDialogDescription>
            El borrado es definitivo y no se puede deshacer. Si solo quieres ocultarla del
            catálogo, edítala y desmarca «Activa».
          </AlertDialogDescription>
        </AlertDialogHeader>

        {deleteCategory.error ? (
          <p role="alert" className="text-destructive text-sm">
            {deleteCategory.error.message}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteCategory.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void onConfirm();
            }}
            disabled={deleteCategory.isPending}
          >
            {deleteCategory.isPending ? "Eliminando…" : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
