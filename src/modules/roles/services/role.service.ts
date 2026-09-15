import { api } from "@/lib/axios";
import type {
  CreateRoleInput,
  SetRolePermissionsInput,
  UpdateRoleInput,
} from "@/modules/roles/schemas/role.schema";
import type {
  PermissionGroupDto,
  RoleDetail,
  RoleDto,
  RoleListItem,
} from "@/modules/roles/types";

export async function fetchRoles(): Promise<RoleListItem[]> {
  const { data } = await api.get<RoleListItem[]>("/admin/roles");
  return data;
}

export async function fetchRole(id: string): Promise<RoleDetail> {
  const { data } = await api.get<RoleDetail>(`/admin/roles/${id}`);
  return data;
}

export async function fetchPermissionGroups(): Promise<PermissionGroupDto[]> {
  const { data } = await api.get<PermissionGroupDto[]>("/admin/permissions");
  return data;
}

export async function createRole(input: CreateRoleInput): Promise<RoleDto> {
  const { data } = await api.post<RoleDto>("/admin/roles", input);
  return data;
}

export async function updateRole(id: string, input: UpdateRoleInput): Promise<RoleDto> {
  const { data } = await api.patch<RoleDto>(`/admin/roles/${id}`, input);
  return data;
}

export async function deleteRole(id: string): Promise<void> {
  await api.delete(`/admin/roles/${id}`);
}

export async function setRolePermissions(
  id: string,
  input: SetRolePermissionsInput,
): Promise<RoleDetail> {
  const { data } = await api.put<RoleDetail>(`/admin/roles/${id}/permissions`, input);
  return data;
}
