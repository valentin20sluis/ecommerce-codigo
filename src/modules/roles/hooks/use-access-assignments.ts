"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { roleKeys } from "@/modules/roles/hooks/use-roles";
import type { SetRolePermissionsInput } from "@/modules/roles/schemas/role.schema";
import type { SetUserRolesInput, UsersQuery } from "@/modules/roles/schemas/user-role.schema";
import { setRolePermissions } from "@/modules/roles/services/role.service";
import { fetchUsers, setUserRoles } from "@/modules/roles/services/user-role.service";

export function useSetRolePermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SetRolePermissionsInput }) =>
      setRolePermissions(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roleKeys.all }),
  });
}

export function useUsers(query: UsersQuery) {
  return useQuery({
    queryKey: roleKeys.users(query),
    queryFn: () => fetchUsers(query),
    // Evita el salto de layout al cambiar de página o afinar la búsqueda.
    placeholderData: keepPreviousData,
  });
}

export function useSetUserRoles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SetUserRolesInput }) =>
      setUserRoles(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.usersAll });
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
    },
  });
}
