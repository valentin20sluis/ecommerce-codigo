// Import relativo con extensión: este archivo se importa directo con `node --test`
// (docs/testing/unit-test-candidates.md), y Node no resuelve el alias `@/`.
import { BadRequestError } from "../../lib/api-error.core.ts";
import type { ClerkUserProjection } from "@/server/repositories/user.repository";

/**
 * Forma normalizada de una identidad de Clerk. El webhook la entrega en
 * snake_case y el Backend API en camelCase: cada llamador adapta la suya y la
 * elección del email primario vive en un solo sitio.
 */
export type ClerkIdentity = {
  clerkId: string;
  emails: readonly { id: string; address: string }[];
  primaryEmailId: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
};

export function toUserProjection(identity: ClerkIdentity): ClerkUserProjection {
  const primary =
    identity.emails.find((email) => email.id === identity.primaryEmailId) ?? identity.emails[0];

  if (!primary?.address) {
    throw new BadRequestError(`El usuario ${identity.clerkId} llegó sin email utilizable.`);
  }

  return {
    clerkId: identity.clerkId,
    email: primary.address.toLowerCase(),
    firstName: identity.firstName,
    lastName: identity.lastName,
    imageUrl: identity.imageUrl || null,
  };
}
