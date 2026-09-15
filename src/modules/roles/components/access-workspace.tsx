"use client";

import { useCallback, useState } from "react";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDebounce } from "@/hooks/use-debounce";
import { PermissionMatrix } from "@/modules/roles/components/permission-matrix";
import { RoleDeleteDialog } from "@/modules/roles/components/role-delete-dialog";
import { RoleFormDialog } from "@/modules/roles/components/role-form-dialog";
import { RoleTable } from "@/modules/roles/components/role-table";
import { UserRoleDialog } from "@/modules/roles/components/user-role-dialog";
import { UserTable } from "@/modules/roles/components/user-table";
import { useUsers } from "@/modules/roles/hooks/use-access-assignments";
import { useRoles } from "@/modules/roles/hooks/use-roles";
import type { RoleListItem, UserListItem } from "@/modules/roles/types";

const USERS_PAGE_SIZE = 20;

type RoleDialog = "form" | "delete" | "permissions" | null;

export function AccessWorkspace() {
  const [roleDialog, setRoleDialog] = useState<RoleDialog>(null);
  const [activeRole, setActiveRole] = useState<RoleListItem | null>(null);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [activeUser, setActiveUser] = useState<UserListItem | null>(null);
  const [isUserDialogOpen, setUserDialogOpen] = useState(false);

  const debouncedSearch = useDebounce(search);

  const roles = useRoles();
  const users = useUsers({
    q: debouncedSearch || undefined,
    page,
    pageSize: USERS_PAGE_SIZE,
  });

  const openRoleDialog = useCallback((dialog: Exclude<RoleDialog, null>, role: RoleListItem | null) => {
    setActiveRole(role);
    setRoleDialog(dialog);
  }, []);

  const onEdit = useCallback(
    (role: RoleListItem) => openRoleDialog("form", role),
    [openRoleDialog],
  );
  const onDelete = useCallback(
    (role: RoleListItem) => openRoleDialog("delete", role),
    [openRoleDialog],
  );
  const onManagePermissions = useCallback(
    (role: RoleListItem) => openRoleDialog("permissions", role),
    [openRoleDialog],
  );

  const onAssignRoles = useCallback((user: UserListItem) => {
    setActiveUser(user);
    setUserDialogOpen(true);
  }, []);

  function onSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  return (
    <Tabs defaultValue="roles" className="flex flex-1 flex-col gap-4">
      <TabsList>
        <TabsTrigger value="roles">Roles</TabsTrigger>
        <TabsTrigger value="users">Usuarios</TabsTrigger>
      </TabsList>

      <TabsContent value="roles" className="flex flex-col gap-4">
        <div className="flex justify-end">
          <Button onClick={() => openRoleDialog("form", null)}>
            <PlusIcon className="size-4" />
            Nuevo rol
          </Button>
        </div>

        <RoleTable
          roles={roles.data ?? []}
          isLoading={roles.isLoading}
          errorMessage={roles.error?.message ?? null}
          onEdit={onEdit}
          onDelete={onDelete}
          onManagePermissions={onManagePermissions}
        />
      </TabsContent>

      <TabsContent value="users" className="flex flex-col gap-4">
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar por email o nombre…"
          className="max-w-sm"
          aria-label="Buscar usuarios"
        />

        <UserTable
          users={users.data?.data ?? []}
          isLoading={users.isLoading}
          errorMessage={users.error?.message ?? null}
          page={page}
          pageSize={USERS_PAGE_SIZE}
          total={users.data?.meta.total ?? 0}
          onPageChange={setPage}
          onAssignRoles={onAssignRoles}
        />
      </TabsContent>

      <RoleFormDialog
        open={roleDialog === "form"}
        onOpenChange={(open) => setRoleDialog(open ? "form" : null)}
        role={activeRole}
      />
      <RoleDeleteDialog
        open={roleDialog === "delete"}
        onOpenChange={(open) => setRoleDialog(open ? "delete" : null)}
        role={activeRole}
      />
      <PermissionMatrix
        open={roleDialog === "permissions"}
        onOpenChange={(open) => setRoleDialog(open ? "permissions" : null)}
        role={activeRole}
      />
      <UserRoleDialog
        open={isUserDialogOpen}
        onOpenChange={setUserDialogOpen}
        user={activeUser}
      />
    </Tabs>
  );
}
