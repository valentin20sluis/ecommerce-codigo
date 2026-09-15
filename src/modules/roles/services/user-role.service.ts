import { api } from "@/lib/axios";
import type { SetUserRolesInput, UsersQuery } from "@/modules/roles/schemas/user-role.schema";
import type { UserListItem } from "@/modules/roles/types";
import type { Paginated } from "@/types/api";

export async function fetchUsers(query: UsersQuery): Promise<Paginated<UserListItem>> {
  const { data } = await api.get<Paginated<UserListItem>>("/admin/users", {
    params: { q: query.q || undefined, page: query.page, pageSize: query.pageSize },
  });

  return data;
}

export async function setUserRoles(id: string, input: SetUserRolesInput): Promise<UserListItem> {
  const { data } = await api.put<UserListItem>(`/admin/users/${id}/roles`, input);
  return data;
}
