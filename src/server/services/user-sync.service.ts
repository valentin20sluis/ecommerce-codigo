import type { WebhookEvent } from "@clerk/nextjs/webhooks";

import { BadRequestError, ConflictError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { dbTx, type Executor } from "@/server/db/pool";
import type { User } from "@/server/db/schema";
import * as userRepository from "@/server/repositories/user.repository";
import type { ClerkUserProjection } from "@/server/repositories/user.repository";

import { toUserProjection } from "./user-projection";

export { toUserProjection, type ClerkIdentity } from "./user-projection";

const ENTITY_TYPE = "user";

/** Los payloads se derivan del propio `WebhookEvent`; no se redeclaran a mano. */
export type ClerkUserData = Extract<
  WebhookEvent,
  { type: "user.created" | "user.updated" }
>["data"];

export type ClerkUserDeletedData = Extract<WebhookEvent, { type: "user.deleted" }>["data"];

/** Origen del sync; queda en `audit_logs.metadata.source`. */
export type ClerkSyncSource = "clerk_webhook" | "clerk_backfill";

/**
 * El índice único de `users.email` también cubre las bajas lógicas. Si el email
 * pertenece a un tombstone, se libera; si pertenece a una cuenta viva, es 409.
 */
async function ensureEmailIsAvailable(tx: Executor, projection: ClerkUserProjection): Promise<void> {
  const conflicting = await userRepository.findEmailOwnedByAnotherClerkId(
    projection.email,
    projection.clerkId,
    tx,
  );

  if (!conflicting) return;

  if (conflicting.isActive) {
    await logAudit(tx, {
      actorId: null,
      action: "user.sync_conflict",
      entityType: ENTITY_TYPE,
      entityId: conflicting.id,
      metadata: { reason: "email_taken_by_active_user", clerkId: projection.clerkId },
      severity: "warning",
    });

    throw new ConflictError("El email ya pertenece a otra cuenta activa.");
  }

  const released = `deleted+${conflicting.id}@deleted.invalid`;

  await userRepository.releaseEmail(tx, conflicting.id, released);

  await logAudit(tx, {
    actorId: null,
    action: "user.email_released",
    entityType: ENTITY_TYPE,
    entityId: conflicting.id,
    changes: { before: { email: conflicting.email }, after: { email: released } },
    metadata: { reason: "reassigned_to_new_clerk_user" },
    severity: "warning",
  });
}

export type UserUpsertResult = { user: User; created: boolean };

/**
 * Upsert idempotente + auditoría en la misma transacción. Lo comparten el
 * webhook en vivo y el backfill del Backend API; solo cambia `source`.
 */
export async function applyUserUpsert(
  projection: ClerkUserProjection,
  source: ClerkSyncSource,
): Promise<UserUpsertResult> {
  return dbTx.transaction(async (tx) => {
    const existing = await userRepository.findByClerkId(projection.clerkId, tx);

    await ensureEmailIsAvailable(tx, projection);

    const user = await userRepository.upsertFromClerk(tx, projection);

    await logAudit(tx, {
      actorId: null,
      action: existing ? "user.updated" : "user.created",
      entityType: ENTITY_TYPE,
      entityId: user.id,
      changes: {
        before: existing ? { email: existing.email, isActive: existing.isActive } : null,
        after: { email: user.email, isActive: user.isActive },
      },
      metadata: { source },
    });

    return { user, created: !existing };
  });
}

/** Adaptador del payload snake_case del webhook sobre `applyUserUpsert`. */
export async function syncUserUpserted(data: ClerkUserData): Promise<User> {
  const projection = toUserProjection({
    clerkId: data.id,
    emails: data.email_addresses.map((email) => ({ id: email.id, address: email.email_address })),
    primaryEmailId: data.primary_email_address_id,
    firstName: data.first_name,
    lastName: data.last_name,
    imageUrl: data.image_url,
  });

  const { user } = await applyUserUpsert(projection, "clerk_webhook");

  return user;
}

export async function syncUserDeleted(data: ClerkUserDeletedData): Promise<User | null> {
  if (!data.id) {
    throw new BadRequestError("El evento user.deleted llegó sin identificador.");
  }

  const clerkId = data.id;

  return dbTx.transaction(async (tx) => {
    const user = await userRepository.softDeleteByClerkId(tx, clerkId);
    if (!user) return null;

    await logAudit(tx, {
      actorId: null,
      action: "user.deleted",
      entityType: ENTITY_TYPE,
      entityId: user.id,
      changes: { before: { isActive: true }, after: { isActive: false } },
      metadata: { source: "clerk_webhook" },
    });

    return user;
  });
}
