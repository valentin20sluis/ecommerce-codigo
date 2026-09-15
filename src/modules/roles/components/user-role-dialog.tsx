"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useSetUserRoles } from "@/modules/roles/hooks/use-access-assignments";
import { useRoles } from "@/modules/roles/hooks/use-roles";
import type { RoleListItem, UserListItem } from "@/modules/roles/types";

type UserRoleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserListItem | null;
};

type AssignmentFormProps = {
  user: UserListItem;
  roles: RoleListItem[];
  onDone: () => void;
};

/** Se monta con `key` por usuario: el estado inicial nace de props, sin efectos. */
function AssignmentForm({ user, roles, onDone }: AssignmentFormProps) {
  const setUserRoles = useSetUserRoles();
  const [selected, setSelected] = useState(() => new Set(user.roles.map((role) => role.id)));

  function toggle(roleId: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(roleId);
      else next.delete(roleId);
      return next;
    });
  }

  async function onSave() {
    try {
      await setUserRoles.mutateAsync({ id: user.id, input: { roleIds: [...selected] } });
      toast.success("Roles actualizados.");
      onDone();
    } catch {
      // El servidor puede rechazar (p. ej. último administrador); se muestra abajo.
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {roles.map((role) => (
          <label key={role.id} className="hover:bg-muted/50 flex items-start gap-3 rounded-md p-2">
            <Checkbox
              checked={selected.has(role.id)}
              onCheckedChange={(checked) => toggle(role.id, checked)}
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{role.name}</span>
              <span className="text-muted-foreground text-xs">{role.description ?? role.slug}</span>
            </span>
          </label>
        ))}
      </div>

      {setUserRoles.error ? (
        <p role="alert" className="text-destructive text-sm">
          {setUserRoles.error.message}
        </p>
      ) : null}

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button onClick={onSave} disabled={setUserRoles.isPending}>
          {setUserRoles.isPending ? "Guardando…" : "Guardar"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function UserRoleDialog({ open, onOpenChange, user }: UserRoleDialogProps) {
  const roles = useRoles();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Roles de {user?.email}</DialogTitle>
          <DialogDescription>
            Sin ningún rol asignado, el usuario queda como cliente por defecto.
          </DialogDescription>
        </DialogHeader>

        {roles.isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-6 w-full" />
            ))}
          </div>
        ) : roles.error ? (
          <p role="alert" className="text-destructive text-sm">
            {roles.error.message}
          </p>
        ) : roles.data && user ? (
          <AssignmentForm
            key={user.id}
            user={user}
            roles={roles.data}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
