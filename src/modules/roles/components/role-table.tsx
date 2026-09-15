"use client";

import { useMemo } from "react";
import { PencilIcon, ShieldCheckIcon, Trash2Icon } from "lucide-react";

import { createDataTableColumnHelper, DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RoleListItem } from "@/modules/roles/types";

type RoleTableProps = {
  roles: RoleListItem[];
  isLoading: boolean;
  errorMessage: string | null;
  onEdit: (role: RoleListItem) => void;
  onDelete: (role: RoleListItem) => void;
  onManagePermissions: (role: RoleListItem) => void;
};

const helper = createDataTableColumnHelper<RoleListItem>();

export function RoleTable({
  roles,
  isLoading,
  errorMessage,
  onEdit,
  onDelete,
  onManagePermissions,
}: RoleTableProps) {
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("name", {
          header: "Rol",
          cell: (context) => (
            <div className="flex flex-col">
              <span className="font-medium">{context.getValue()}</span>
              <span className="text-muted-foreground font-mono text-xs">
                {context.row.original.slug}
              </span>
            </div>
          ),
        }),
        helper.accessor("description", {
          header: "Descripción",
          cell: (context) => (
            <span className="text-muted-foreground line-clamp-2 text-sm">
              {context.getValue() ?? "—"}
            </span>
          ),
        }),
        helper.accessor("isSystem", {
          header: "Tipo",
          cell: (context) =>
            context.getValue() ? (
              <Badge variant="secondary">Sistema</Badge>
            ) : (
              <Badge variant="outline">Personalizado</Badge>
            ),
        }),
        helper.accessor("permissionCount", {
          header: "Permisos",
          cell: (context) => <span className="tabular-nums">{context.getValue()}</span>,
        }),
        helper.accessor("userCount", {
          header: "Usuarios",
          cell: (context) => <span className="tabular-nums">{context.getValue()}</span>,
        }),
        helper.display({
          id: "actions",
          header: "",
          cell: (context) => {
            const role = context.row.original;

            return (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onManagePermissions(role)}
                  aria-label={`Permisos de ${role.name}`}
                >
                  <ShieldCheckIcon className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(role)}
                  aria-label={`Editar ${role.name}`}
                >
                  <PencilIcon className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={role.isSystem}
                  onClick={() => onDelete(role)}
                  aria-label={`Eliminar ${role.name}`}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            );
          },
        }),
      ]),
    [onEdit, onDelete, onManagePermissions],
  );

  return (
    <DataTable
      columns={columns}
      data={roles}
      isLoading={isLoading}
      errorMessage={errorMessage}
      emptyMessage="Todavía no hay roles."
    />
  );
}
