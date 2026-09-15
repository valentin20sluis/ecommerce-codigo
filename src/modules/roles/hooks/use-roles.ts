"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchPermissionGroups, fetchRole, fetchRoles } from "@/modules/roles/services/role.service";
import type { UsersQuery } from "@/modules/roles/schemas/user-role.schema";

export const roleKeys = {
  all: ["roles"] as const,
  lists: () => [...roleKeys.all, "list"] as const,
  detail: (id: string) => [...roleKeys.all, "detail", id] as const,
  permissions: () => ["permissions"] as const,
  usersAll: ["users"] as const,
  users: (query: UsersQuery) => [...roleKeys.usersAll, query] as const,
};

export function useRoles() {
  return useQuery({
    queryKey: roleKeys.lists(),
    queryFn: fetchRoles,
  });
}

export function useRole(id: string | null) {
  return useQuery({
    queryKey: roleKeys.detail(id ?? ""),
    queryFn: () => fetchRole(id as string),
    enabled: Boolean(id),
  });
}

export function usePermissions() {
  return useQuery({
    queryKey: roleKeys.permissions(),
    queryFn: fetchPermissionGroups,
    // El catálogo nace del código: solo cambia con un deploy + seed.
    staleTime: 10 * 60 * 1000,
  });
}
