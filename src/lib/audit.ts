import { headers } from "next/headers";

import type { Executor } from "@/server/db/pool";
import type { AuditChanges, AuditSeverity } from "@/server/db/schema";
import * as auditLogRepository from "@/server/repositories/audit-log.repository";

import { isSecurityAction, maskRecord } from "./audit.rules";

export * from "./audit.rules";

export type RequestContext = {
  ipAddress: string | null;
  userAgent: string | null;
};

export type AuditEntry = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  changes?: AuditChanges | null;
  metadata?: Record<string, unknown> | null;
  severity?: AuditSeverity;
  context?: RequestContext;
};

const IP_PATTERN = /^[0-9a-fA-F:.]+$/;

export async function getRequestContext(): Promise<RequestContext> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwarded || headerList.get("x-real-ip")?.trim() || "";

  return {
    // Una IP malformada rompería el INSERT sobre la columna `inet`.
    ipAddress: IP_PATTERN.test(candidate) ? candidate : null,
    userAgent: headerList.get("user-agent"),
  };
}

async function resolveContext(entry: AuditEntry): Promise<RequestContext> {
  if (entry.context) return entry.context;

  try {
    return await getRequestContext();
  } catch {
    return { ipAddress: null, userAgent: null };
  }
}

/**
 * Escribe la bitácora usando el `executor` de la mutación auditada, de modo que
 * un rollback de negocio revierta también el log (SETUP §5.2 regla 2).
 */
export async function logAudit(executor: Executor, entry: AuditEntry): Promise<void> {
  const context = await resolveContext(entry);

  try {
    await auditLogRepository.insert(executor, {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      changes: entry.changes
        ? {
            before: maskRecord(entry.changes.before),
            after: maskRecord(entry.changes.after),
          }
        : null,
      metadata: maskRecord(entry.metadata ?? null),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      severity: entry.severity ?? "info",
    });
  } catch (error) {
    if (isSecurityAction(entry.action)) throw error;
    console.error(`[audit] no se pudo registrar "${entry.action}"`, error);
  }
}
