import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

import { inArray, sql } from "drizzle-orm";

import { PERMISSION_DEFINITIONS } from "@/lib/permissions.catalog";
import { RETIRED_ROLE_SLUGS, SYSTEM_ROLES } from "@/modules/roles/constants";
import { closePool, dbTx, type Executor } from "@/server/db/pool";
import { permissions, rolePermissions, roles, userRoles } from "@/server/db/schema";
import * as roleRepository from "@/server/repositories/role.repository";
import * as userRepository from "@/server/repositories/user.repository";

const SUPER_ADMIN_ROLE_SLUG = "super_admin";

async function seedPermissions(tx: Executor): Promise<Map<string, string>> {
  await tx
    .insert(permissions)
    .values(
      PERMISSION_DEFINITIONS.map((definition) => ({
        code: definition.code,
        resource: definition.resource,
        action: definition.action,
        description: definition.description,
      })),
    )
    .onConflictDoUpdate({
      target: permissions.code,
      set: {
        resource: sql`excluded.resource`,
        action: sql`excluded.action`,
        description: sql`excluded.description`,
      },
    });

  const rows = await tx.select({ id: permissions.id, code: permissions.code }).from(permissions);

  return new Map(rows.map((row) => [row.code, row.id]));
}

async function seedRoles(tx: Executor): Promise<Map<string, string>> {
  await tx
    .insert(roles)
    .values(
      SYSTEM_ROLES.map((role) => ({
        slug: role.slug,
        name: role.name,
        description: role.description,
        isSystem: true,
      })),
    )
    .onConflictDoUpdate({
      target: roles.slug,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        isSystem: true,
        updatedAt: new Date(),
      },
    });

  const rows = await tx
    .select({ id: roles.id, slug: roles.slug })
    .from(roles)
    .where(
      inArray(
        roles.slug,
        SYSTEM_ROLES.map((role) => role.slug),
      ),
    );

  return new Map(rows.map((row) => [row.slug, row.id]));
}

/**
 * Concede lo que falte sin revocar: un permiso añadido a un rol de sistema desde
 * la UI sobrevive a la siguiente corrida.
 */
async function seedRolePermissions(
  tx: Executor,
  roleIds: Map<string, string>,
  permissionIds: Map<string, string>,
): Promise<number> {
  const pairs = SYSTEM_ROLES.flatMap((role) => {
    const roleId = roleIds.get(role.slug);
    if (!roleId) return [];

    return role.permissions.flatMap((code) => {
      const permissionId = permissionIds.get(code);
      return permissionId ? [{ roleId, permissionId }] : [];
    });
  });

  if (pairs.length > 0) {
    await tx.insert(rolePermissions).values(pairs).onConflictDoNothing();
  }

  return pairs.length;
}

/**
 * Un rol retirado del catálogo con usuarios asignados no se borra: `user_roles`
 * lo referencia con `onDelete: restrict`. Se avisa y el seed sigue.
 */
async function retireRoles(tx: Executor): Promise<string[]> {
  const messages: string[] = [];

  for (const slug of RETIRED_ROLE_SLUGS) {
    const role = await roleRepository.findBySlug(slug, tx);
    if (!role) continue;

    const assigned = await roleRepository.countAssignedUsers(role.id, tx);
    if (assigned > 0) {
      messages.push(
        `Rol retirado "${slug}" conserva ${assigned} usuario(s): reasígnalos y vuelve a sembrar.`,
      );
      continue;
    }

    await roleRepository.remove(tx, role.id);
    messages.push(`Rol retirado "${slug}" eliminado.`);
  }

  return messages;
}

async function seedAdminAssignment(
  tx: Executor,
  superAdminRoleId: string | undefined,
): Promise<string> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) return "SEED_ADMIN_EMAIL no definido: sin asignación de administrador.";
  if (!superAdminRoleId) {
    return `Rol "${SUPER_ADMIN_ROLE_SLUG}" ausente: sin asignación de administrador.`;
  }

  const user = await userRepository.findByEmail(email, tx);

  if (!user) {
    return `Usuario ${email} aún no sincronizado desde Clerk: sin asignación de administrador. Corre "npm run db:sync-users" y repite el seed.`;
  }

  await tx
    .insert(userRoles)
    .values({ userId: user.id, roleId: superAdminRoleId, assignedBy: null })
    .onConflictDoNothing();

  return `Rol "${SUPER_ADMIN_ROLE_SLUG}" garantizado para ${email}.`;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está definida. Configúrala en .env.local antes de sembrar.");
  }

  const summary = await dbTx.transaction(async (tx) => {
    const permissionIds = await seedPermissions(tx);
    const roleIds = await seedRoles(tx);
    const grants = await seedRolePermissions(tx, roleIds, permissionIds);
    const retired = await retireRoles(tx);
    const adminMessage = await seedAdminAssignment(tx, roleIds.get(SUPER_ADMIN_ROLE_SLUG));

    return {
      permissions: permissionIds.size,
      roles: roleIds.size,
      grants,
      retired,
      adminMessage,
    };
  });

  console.log(`Permisos en catálogo: ${summary.permissions}`);
  console.log(`Roles de sistema: ${summary.roles}`);
  console.log(`Asignaciones rol×permiso garantizadas: ${summary.grants}`);
  for (const message of summary.retired) console.log(message);
  console.log(summary.adminMessage);
  console.log("Seed completado.");
}

main()
  .catch((error) => {
    console.error("Seed fallido:", error);
    process.exitCode = 1;
  })
  .finally(closePool);
