"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { roleKeys } from "@/modules/roles/hooks/use-roles";
import type { CreateRoleInput, UpdateRoleInput } from "@/modules/roles/schemas/role.schema";
import { createRole, deleteRole, updateRole } from "@/modules/roles/services/role.service";

export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRoleInput) => createRole(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roleKeys.all }),
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRoleInput }) => updateRole(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roleKeys.all }),
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roleKeys.all }),
  });
}
