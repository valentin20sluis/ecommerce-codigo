import type { Permission, Role, User } from "@/server/db/schema";
import type { Serialized } from "@/types/api";

export type RoleDto = Serialized<Role>;

export type RoleListItem = RoleDto & {
  permissionCount: number;
  userCount: number;
};

export type RoleDetail = RoleDto & {
  permissionIds: string[];
};

export type PermissionDto = Serialized<Permission>;

export type PermissionGroupDto = {
  resource: string;
  permissions: PermissionDto[];
};

export type AssignedRole = Pick<Role, "id" | "slug" | "name">;

export type UserListItem = Pick<
  Serialized<User>,
  "id" | "email" | "firstName" | "lastName" | "imageUrl" | "isActive" | "createdAt"
> & {
  roles: AssignedRole[];
};
