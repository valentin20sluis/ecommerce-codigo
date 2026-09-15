import { cache } from "react";

import { ForbiddenError } from "@/lib/api-error";
import { getCurrentUser, requireAuth } from "@/lib/auth";
import { DEFAULT_ROLE_SLUG, type PermissionCode } from "@/lib/permissions.catalog";
import type { User } from "@/server/db/schema";
import * as roleRepository from "@/server/repositories/role.repository";
import * as userRepository from "@/server/repositories/user.repository";

export * from "@/lib/permissions.catalog";

/**
 * Resuelve `clerk_id → users → user_roles → role_permissions → permissions`.
 * Un usuario sin asignaciones hereda las del rol por defecto: ese fallback vive
 * aquí y solo aquí (docs/SETUP.md §5.1 regla 3).
 */
export const getEffectivePermissions = cache(async (): Promise<ReadonlySet<string>> => {
  const user = await getCurrentUser();
  return resolvePermissionsFor(user);
});

async function resolvePermissionsFor(user: User | null): Promise<ReadonlySet<string>> {
  if (!user || !user.isActive) return new Set<string>();

  const assignments = await userRepository.countRoleAssignments(user.id);
  const codes =
    assignments > 0
      ? await userRepository.findEffectivePermissionCodes(user.id)
      : await roleRepository.getPermissionCodesBySlug(DEFAULT_ROLE_SLUG);

  return new Set(codes);
}

export async function can(code: PermissionCode): Promise<boolean> {
  const effective = await getEffectivePermissions();
  return effective.has(code);
}

/** Segunda capa del guard: autoriza por código y devuelve el usuario del request. */
export async function requirePermission(code: PermissionCode): Promise<User> {
  const user = await requireAuth();

  const effective = await getEffectivePermissions();
  if (!effective.has(code)) {
    throw new ForbiddenError(`Se requiere el permiso "${code}".`);
  }

  return user;
}
