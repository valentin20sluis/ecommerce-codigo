import { asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/server/db";
import type { Executor, ReadExecutor } from "@/server/db/pool";
import {
  permissions,
  rolePermissions,
  roles,
  userRoles,
  type NewRole,
  type Role,
} from "@/server/db/schema";

export type RoleWithCounts = Role & {
  permissionCount: number;
  userCount: number;
};

export async function findById(id: string, executor: ReadExecutor = db): Promise<Role | null> {
  const [row] = await executor.select().from(roles).where(eq(roles.id, id)).limit(1);
  return row ?? null;
}

export async function findBySlug(slug: string, executor: ReadExecutor = db): Promise<Role | null> {
  const [row] = await executor.select().from(roles).where(eq(roles.slug, slug)).limit(1);
  return row ?? null;
}

export function listWithCounts(executor: ReadExecutor = db): Promise<RoleWithCounts[]> {
  return executor
    .select({
      id: roles.id,
      slug: roles.slug,
      name: roles.name,
      description: roles.description,
      isSystem: roles.isSystem,
      createdAt: roles.createdAt,
      updatedAt: roles.updatedAt,
      permissionCount: sql<number>`count(distinct ${rolePermissions.permissionId})::int`,
      userCount: sql<number>`count(distinct ${userRoles.userId})::int`,
    })
    .from(roles)
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .leftJoin(userRoles, eq(userRoles.roleId, roles.id))
    .groupBy(roles.id)
    .orderBy(asc(roles.name));
}

export async function create(executor: Executor, values: NewRole): Promise<Role> {
  const [row] = await executor.insert(roles).values(values).returning();
  return row;
}

export async function update(
  executor: Executor,
  id: string,
  values: Partial<Pick<NewRole, "name" | "description">>,
): Promise<Role | null> {
  const [row] = await executor
    .update(roles)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(roles.id, id))
    .returning();

  return row ?? null;
}

export async function remove(executor: Executor, id: string): Promise<void> {
  await executor.delete(roles).where(eq(roles.id, id));
}

export async function getPermissionIds(
  roleId: string,
  executor: ReadExecutor = db,
): Promise<string[]> {
  const rows = await executor
    .select({ permissionId: rolePermissions.permissionId })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, roleId));

  return rows.map((row) => row.permissionId);
}

export async function getPermissionCodesBySlug(
  slug: string,
  executor: ReadExecutor = db,
): Promise<string[]> {
  const rows = await executor
    .select({ code: permissions.code })
    .from(roles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(roles.slug, slug));

  return rows.map((row) => row.code);
}

export async function replacePermissions(
  executor: Executor,
  roleId: string,
  permissionIds: string[],
): Promise<void> {
  await executor.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

  if (permissionIds.length === 0) return;

  await executor
    .insert(rolePermissions)
    .values(permissionIds.map((permissionId) => ({ roleId, permissionId })));
}

export async function countAssignedUsers(
  roleId: string,
  executor: ReadExecutor = db,
): Promise<number> {
  const [row] = await executor
    .select({ total: sql<number>`count(*)::int` })
    .from(userRoles)
    .where(eq(userRoles.roleId, roleId));

  return row?.total ?? 0;
}

export async function findExistingIds(
  ids: string[],
  executor: ReadExecutor = db,
): Promise<string[]> {
  if (ids.length === 0) return [];

  const rows = await executor
    .select({ id: roles.id })
    .from(roles)
    .where(inArray(roles.id, ids));

  return rows.map((row) => row.id);
}
