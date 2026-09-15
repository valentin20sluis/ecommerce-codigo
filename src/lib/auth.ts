import { cache } from "react";
import { auth } from "@clerk/nextjs/server";

import { UnauthorizedError } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import type { User } from "@/server/db/schema";
import * as userRepository from "@/server/repositories/user.repository";

/**
 * Clerk autentica; `users` es el espejo local. Cacheado por request para que el
 * layout y los handlers no repitan la consulta.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const { userId } = await auth();
  if (!userId) return null;

  return userRepository.findByClerkId(userId);
});

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();

  return user;
}

/** Acceso al panel: es un permiso más, nunca una comparación por nombre de rol. */
export async function requireAdmin(): Promise<User> {
  return requirePermission(PERMISSIONS.ADMIN_ACCESS);
}
