import { BadRequestError, ConflictError, NotFoundError } from "@/lib/api-error";
import { diffChanges, logAudit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/permissions.catalog";
import { dbTx, type Executor } from "@/server/db/pool";
import type { Role, User } from "@/server/db/schema";
import * as permissionRepository from "@/server/repositories/permission.repository";
import * as roleRepository from "@/server/repositories/role.repository";
import * as userRepository from "@/server/repositories/user.repository";
import type { UserWithRoles } from "@/server/repositories/user.repository";

const ROLE_ENTITY = "role";
const USER_ENTITY = "user";

export type CreateRoleInput = {
  slug: string;
  name: string;
  description?: string | null;
};

export type UpdateRoleInput = {
  name?: string;
  description?: string | null;
};

/**
 * Ninguna operación puede dejar el panel sin un solo administrador. Se evalúa
 * dentro de la transacción para que el rescate sea un rollback.
 */
async function assertAdminAccessSurvives(tx: Executor): Promise<void> {
  const remaining = await userRepository.countActiveUsersWithPermission(
    PERMISSIONS.ADMIN_ACCESS,
    tx,
  );

  if (remaining === 0) {
    throw new ConflictError(
      "La operación dejaría el panel sin ningún usuario con acceso de administración.",
    );
  }
}

async function requireRole(tx: Executor, id: string): Promise<Role> {
  const role = await roleRepository.findById(id, tx);
  if (!role) throw new NotFoundError("El rol no existe.");

  return role;
}

export async function createRole(actor: User, input: CreateRoleInput): Promise<Role> {
  return dbTx.transaction(async (tx) => {
    const existing = await roleRepository.findBySlug(input.slug, tx);
    if (existing) throw new ConflictError(`Ya existe un rol con el slug "${input.slug}".`);

    const role = await roleRepository.create(tx, {
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      isSystem: false,
    });

    await logAudit(tx, {
      actorId: actor.id,
      action: "role.created",
      entityType: ROLE_ENTITY,
      entityId: role.id,
      changes: { before: null, after: { slug: role.slug, name: role.name } },
    });

    return role;
  });
}

export async function updateRole(
  actor: User,
  id: string,
  input: UpdateRoleInput,
): Promise<Role> {
  return dbTx.transaction(async (tx) => {
    const current = await requireRole(tx, id);

    if (current.isSystem && input.name !== undefined && input.name !== current.name) {
      throw new ConflictError("Los roles de sistema no se pueden renombrar.");
    }

    const updated = await roleRepository.update(tx, id, {
      name: input.name ?? current.name,
      description: input.description === undefined ? current.description : input.description,
    });

    if (!updated) throw new NotFoundError("El rol no existe.");

    const changes = diffChanges(
      { name: current.name, description: current.description },
      { name: updated.name, description: updated.description },
    );

    if (changes) {
      await logAudit(tx, {
        actorId: actor.id,
        action: "role.updated",
        entityType: ROLE_ENTITY,
        entityId: updated.id,
        changes,
      });
    }

    return updated;
  });
}

export async function deleteRole(actor: User, id: string): Promise<void> {
  await dbTx.transaction(async (tx) => {
    const role = await requireRole(tx, id);

    if (role.isSystem) {
      throw new ConflictError("Los roles de sistema no se pueden eliminar.");
    }

    const assigned = await roleRepository.countAssignedUsers(id, tx);
    if (assigned > 0) {
      throw new ConflictError(
        `El rol tiene ${assigned} usuario(s) asignado(s). Reasígnalos antes de eliminarlo.`,
      );
    }

    await roleRepository.remove(tx, id);

    await logAudit(tx, {
      actorId: actor.id,
      action: "role.deleted",
      entityType: ROLE_ENTITY,
      entityId: role.id,
      changes: { before: { slug: role.slug, name: role.name }, after: null },
      severity: "warning",
    });

    await assertAdminAccessSurvives(tx);
  });
}

export async function setRolePermissions(
  actor: User,
  roleId: string,
  permissionIds: string[],
): Promise<Role> {
  const requested = [...new Set(permissionIds)];

  return dbTx.transaction(async (tx) => {
    const role = await requireRole(tx, roleId);

    const catalog = await permissionRepository.findAll(tx);
    const codeById = new Map(catalog.map((permission) => [permission.id, permission.code]));

    const unknown = requested.filter((id) => !codeById.has(id));
    if (unknown.length > 0) {
      throw new BadRequestError("Se enviaron permisos inexistentes.", { permissionIds: unknown });
    }

    const before = await roleRepository.getPermissionIds(roleId, tx);

    await roleRepository.replacePermissions(tx, roleId, requested);

    await logAudit(tx, {
      actorId: actor.id,
      action: "role.permissions_changed",
      entityType: ROLE_ENTITY,
      entityId: roleId,
      changes: {
        before: { permissions: before.map((id) => codeById.get(id)).sort() },
        after: { permissions: requested.map((id) => codeById.get(id)).sort() },
      },
      severity: "warning",
    });

    await assertAdminAccessSurvives(tx);

    return role;
  });
}

export async function setUserRoles(
  actor: User,
  userId: string,
  roleIds: string[],
): Promise<UserWithRoles> {
  const requested = [...new Set(roleIds)];

  return dbTx.transaction(async (tx) => {
    const target = await userRepository.findById(userId, tx);
    if (!target) throw new NotFoundError("El usuario no existe.");

    const existingIds = await roleRepository.findExistingIds(requested, tx);
    if (existingIds.length !== requested.length) {
      const unknown = requested.filter((id) => !existingIds.includes(id));
      throw new BadRequestError("Se enviaron roles inexistentes.", { roleIds: unknown });
    }

    const before = await userRepository.getRoleIds(userId, tx);

    await userRepository.replaceRoles(tx, userId, requested, actor.id);

    await logAudit(tx, {
      actorId: actor.id,
      action: "user.roles_changed",
      entityType: USER_ENTITY,
      entityId: userId,
      changes: { before: { roleIds: [...before].sort() }, after: { roleIds: [...requested].sort() } },
      severity: "warning",
    });

    await assertAdminAccessSurvives(tx);

    const updated = await userRepository.findWithRoles(userId, tx);
    if (!updated) throw new NotFoundError("El usuario no existe.");

    return updated;
  });
}
