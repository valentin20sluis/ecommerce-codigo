import { and, asc, desc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";

import { db } from "@/server/db";
import type { Executor, ReadExecutor } from "@/server/db/pool";
import {
  permissions,
  rolePermissions,
  roles,
  userRoles,
  users,
  type Role,
  type User,
} from "@/server/db/schema";

export type ClerkUserProjection = {
  clerkId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
};

export type UserWithRoles = User & { roles: Pick<Role, "id" | "slug" | "name">[] };

export type ListUsersParams = {
  q?: string;
  page: number;
  pageSize: number;
};

export async function findById(id: string, executor: ReadExecutor = db): Promise<User | null> {
  const [row] = await executor.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

export async function findByClerkId(
  clerkId: string,
  executor: ReadExecutor = db,
): Promise<User | null> {
  const [row] = await executor.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  return row ?? null;
}

export async function findByEmail(
  email: string,
  executor: ReadExecutor = db,
): Promise<User | null> {
  const [row] = await executor.select().from(users).where(eq(users.email, email)).limit(1);
  return row ?? null;
}

/**
 * Detecta la colisión de email contra OTRO clerk_id antes de escribir, porque el
 * índice único de `users.email` también cubre filas dadas de baja lógica.
 */
export async function findEmailOwnedByAnotherClerkId(
  email: string,
  clerkId: string,
  executor: ReadExecutor = db,
): Promise<User | null> {
  const [row] = await executor
    .select()
    .from(users)
    .where(and(eq(users.email, email), ne(users.clerkId, clerkId)))
    .limit(1);

  return row ?? null;
}

export async function upsertFromClerk(
  executor: Executor,
  projection: ClerkUserProjection,
): Promise<User> {
  const [row] = await executor
    .insert(users)
    .values({ ...projection, isActive: true, deletedAt: null })
    .onConflictDoUpdate({
      target: users.clerkId,
      set: {
        email: projection.email,
        firstName: projection.firstName,
        lastName: projection.lastName,
        imageUrl: projection.imageUrl,
        isActive: true,
        deletedAt: null,
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
}

export async function softDeleteByClerkId(
  executor: Executor,
  clerkId: string,
): Promise<User | null> {
  const now = new Date();

  const [row] = await executor
    .update(users)
    .set({ isActive: false, deletedAt: now, updatedAt: now })
    .where(eq(users.clerkId, clerkId))
    .returning();

  return row ?? null;
}

/** Libera el email de un tombstone para que lo pueda tomar una cuenta nueva. */
export async function releaseEmail(
  executor: Executor,
  id: string,
  replacement: string,
): Promise<void> {
  await executor
    .update(users)
    .set({ email: replacement, updatedAt: new Date() })
    .where(eq(users.id, id));
}

/**
 * Persiste el Customer de Stripe creado perezosamente (010 D3). El guard
 * `isNull` hace la escritura idempotente: si dos requests simultáneos crearon un
 * Customer cada uno, solo el primero queda enlazado y el segundo se descarta,
 * sin chocar contra `users_stripe_customer_id_unique`.
 */
export async function setStripeCustomerId(
  executor: Executor,
  userId: string,
  stripeCustomerId: string,
): Promise<User | null> {
  const [row] = await executor
    .update(users)
    .set({ stripeCustomerId, updatedAt: new Date() })
    .where(and(eq(users.id, userId), isNull(users.stripeCustomerId)))
    .returning();

  return row ?? null;
}

export async function listPaginated(
  params: ListUsersParams,
  executor: ReadExecutor = db,
): Promise<{ data: UserWithRoles[]; total: number }> {
  const term = params.q?.trim();
  const filter = term
    ? or(
        ilike(users.email, `%${term}%`),
        ilike(users.firstName, `%${term}%`),
        ilike(users.lastName, `%${term}%`),
      )
    : undefined;

  const [{ total }] = await executor
    .select({ total: sql<number>`count(*)::int` })
    .from(users)
    .where(filter);

  const rows = await executor
    .select()
    .from(users)
    .where(filter)
    .orderBy(desc(users.createdAt))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  return { data: await attachRoles(rows, executor), total };
}

/** Una sola consulta para todos los usuarios de la página; nunca N+1. */
async function attachRoles(rows: User[], executor: ReadExecutor): Promise<UserWithRoles[]> {
  if (rows.length === 0) return [];

  const assignments = await executor
    .select({
      userId: userRoles.userId,
      id: roles.id,
      slug: roles.slug,
      name: roles.name,
    })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(
      inArray(
        userRoles.userId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(asc(roles.name));

  const byUser = new Map<string, Pick<Role, "id" | "slug" | "name">[]>();
  for (const { userId, ...role } of assignments) {
    const bucket = byUser.get(userId);
    if (bucket) bucket.push(role);
    else byUser.set(userId, [role]);
  }

  return rows.map((row) => ({ ...row, roles: byUser.get(row.id) ?? [] }));
}

export async function findWithRoles(
  id: string,
  executor: ReadExecutor = db,
): Promise<UserWithRoles | null> {
  const user = await findById(id, executor);
  if (!user) return null;

  const [withRoles] = await attachRoles([user], executor);
  return withRoles;
}

export async function getRoleIds(userId: string, executor: ReadExecutor = db): Promise<string[]> {
  const rows = await executor
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));

  return rows.map((row) => row.roleId);
}

export async function replaceRoles(
  executor: Executor,
  userId: string,
  roleIds: string[],
  assignedBy: string | null,
): Promise<void> {
  await executor.delete(userRoles).where(eq(userRoles.userId, userId));

  if (roleIds.length === 0) return;

  await executor.insert(userRoles).values(roleIds.map((roleId) => ({ userId, roleId, assignedBy })));
}

/** Join único `user_roles → role_permissions → permissions`. */
export async function findEffectivePermissionCodes(
  userId: string,
  executor: ReadExecutor = db,
): Promise<string[]> {
  const rows = await executor
    .selectDistinct({ code: permissions.code })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(userRoles.userId, userId));

  return rows.map((row) => row.code);
}

export async function countRoleAssignments(
  userId: string,
  executor: ReadExecutor = db,
): Promise<number> {
  const [row] = await executor
    .select({ total: sql<number>`count(*)::int` })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));

  return row?.total ?? 0;
}

/**
 * Usuarios activos que conservan un permiso dado. Sostiene la protección contra
 * dejar el panel sin ningún administrador.
 */
export async function countActiveUsersWithPermission(
  code: string,
  executor: ReadExecutor = db,
): Promise<number> {
  const [row] = await executor
    .select({ total: sql<number>`count(distinct ${users.id})::int` })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(and(eq(permissions.code, code), eq(users.isActive, true), isNull(users.deletedAt)));

  return row?.total ?? 0;
}
