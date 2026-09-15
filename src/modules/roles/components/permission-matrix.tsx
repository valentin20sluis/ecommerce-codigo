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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useSetRolePermissions } from "@/modules/roles/hooks/use-access-assignments";
import { usePermissions, useRole } from "@/modules/roles/hooks/use-roles";
import type { PermissionGroupDto, RoleListItem } from "@/modules/roles/types";

type PermissionMatrixProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleListItem | null;
};

type MatrixFormProps = {
  roleId: string;
  groups: PermissionGroupDto[];
  initialPermissionIds: string[];
  onDone: () => void;
};

/** Se monta con `key` cuando los datos ya están: el estado inicial nace de props. */
function MatrixForm({ roleId, groups, initialPermissionIds, onDone }: MatrixFormProps) {
  const setRolePermissions = useSetRolePermissions();
  const [selected, setSelected] = useState(() => new Set(initialPermissionIds));

  function toggle(permissionId: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(permissionId);
      else next.delete(permissionId);
      return next;
    });
  }

  async function onSave() {
    try {
      await setRolePermissions.mutateAsync({ id: roleId, input: { permissionIds: [...selected] } });
      toast.success("Permisos actualizados.");
      onDone();
    } catch {
      // El mensaje del servidor se muestra bajo la matriz.
    }
  }

  return (
    <>
      <ScrollArea className="max-h-[50vh] pr-3">
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <section key={group.resource} className="flex flex-col gap-2">
              <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {group.resource}
              </h3>
              {group.permissions.map((permission) => (
                <label
                  key={permission.id}
                  className="hover:bg-muted/50 flex items-start gap-3 rounded-md p-2"
                >
                  <Checkbox
                    checked={selected.has(permission.id)}
                    onCheckedChange={(checked) => toggle(permission.id, checked)}
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="font-mono text-sm">{permission.code}</span>
                    <span className="text-muted-foreground text-xs">{permission.description}</span>
                  </span>
                </label>
              ))}
            </section>
          ))}
        </div>
      </ScrollArea>

      {setRolePermissions.error ? (
        <p role="alert" className="text-destructive text-sm">
          {setRolePermissions.error.message}
        </p>
      ) : null}

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button onClick={onSave} disabled={setRolePermissions.isPending}>
          {setRolePermissions.isPending ? "Guardando…" : "Guardar permisos"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function PermissionMatrix({ open, onOpenChange, role }: PermissionMatrixProps) {
  const groups = usePermissions();
  const detail = useRole(open && role ? role.id : null);

  const isLoading = groups.isLoading || detail.isLoading;
  const loadError = groups.error ?? detail.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Permisos de «{role?.name}»</DialogTitle>
          <DialogDescription>
            Los cambios no se aplican hasta que guardes. Queda registrado en la bitácora.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-6 w-full" />
            ))}
          </div>
        ) : loadError ? (
          <p role="alert" className="text-destructive text-sm">
            {loadError.message}
          </p>
        ) : groups.data && detail.data ? (
          <MatrixForm
            key={detail.data.id}
            roleId={detail.data.id}
            groups={groups.data}
            initialPermissionIds={detail.data.permissionIds}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
