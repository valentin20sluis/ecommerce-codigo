"use client";

import { useMemo } from "react";
import { UserCogIcon } from "lucide-react";

import { createDataTableColumnHelper, DataTable } from "@/components/shared/data-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { UserListItem } from "@/modules/roles/types";

type UserTableProps = {
  users: UserListItem[];
  isLoading: boolean;
  errorMessage: string | null;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onAssignRoles: (user: UserListItem) => void;
};

const helper = createDataTableColumnHelper<UserListItem>();

function initials(user: UserListItem): string {
  const source = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  return source.slice(0, 2).toUpperCase();
}

export function UserTable({
  users,
  isLoading,
  errorMessage,
  page,
  pageSize,
  total,
  onPageChange,
  onAssignRoles,
}: UserTableProps) {
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("email", {
          header: "Usuario",
          cell: (context) => {
            const user = context.row.original;
            const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");

            return (
              <div className="flex items-center gap-3">
                <Avatar className="size-8">
                  {user.imageUrl ? <AvatarImage src={user.imageUrl} alt="" /> : null}
                  <AvatarFallback>{initials(user)}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{fullName || "Sin nombre"}</span>
                  <span className="text-muted-foreground truncate text-xs">{user.email}</span>
                </div>
              </div>
            );
          },
        }),
        helper.accessor("roles", {
          header: "Roles",
          cell: (context) => {
            const roles = context.getValue();

            if (roles.length === 0) {
              return <span className="text-muted-foreground text-sm">Cliente (por defecto)</span>;
            }

            return (
              <div className="flex flex-wrap gap-1">
                {roles.map((role) => (
                  <Badge key={role.id} variant="secondary">
                    {role.name}
                  </Badge>
                ))}
              </div>
            );
          },
        }),
        helper.accessor("isActive", {
          header: "Estado",
          cell: (context) =>
            context.getValue() ? (
              <Badge variant="outline">Activo</Badge>
            ) : (
              <Badge variant="destructive">Inactivo</Badge>
            ),
        }),
        helper.display({
          id: "actions",
          header: "",
          cell: (context) => (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAssignRoles(context.row.original)}
                aria-label={`Asignar roles a ${context.row.original.email}`}
              >
                <UserCogIcon className="size-4" />
              </Button>
            </div>
          ),
        }),
      ]),
    [onAssignRoles],
  );

  return (
    <DataTable
      columns={columns}
      data={users}
      isLoading={isLoading}
      errorMessage={errorMessage}
      emptyMessage="No hay usuarios que coincidan."
      pagination={{ page, pageSize, total, onPageChange }}
    />
  );
}
