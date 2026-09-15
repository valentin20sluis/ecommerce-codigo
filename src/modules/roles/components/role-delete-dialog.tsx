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
import { useDeleteRole } from "@/modules/roles/hooks/use-role-mutations";
import type { RoleListItem } from "@/modules/roles/types";

type RoleDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleListItem | null;
};

export function RoleDeleteDialog({ open, onOpenChange, role }: RoleDeleteDialogProps) {
  const deleteRole = useDeleteRole();

  async function onConfirm() {
    if (!role) return;

    try {
      await deleteRole.mutateAsync(role.id);
      toast.success(`Rol "${role.name}" eliminado.`);
      onOpenChange(false);
    } catch {
      // 409 (rol de sistema o con usuarios) se muestra dentro del diálogo.
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar «{role?.name}»</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer. Los roles de sistema y los que tengan usuarios
            asignados no se pueden eliminar.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {deleteRole.error ? (
          <p role="alert" className="text-destructive text-sm">
            {deleteRole.error.message}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteRole.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void onConfirm();
            }}
            disabled={deleteRole.isPending}
          >
            {deleteRole.isPending ? "Eliminando…" : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
