import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";

import { db } from "@/server/db";
import type { Executor, ReadExecutor } from "@/server/db/pool";
import {
  auditLogs,
  users,
  type AuditLog,
  type AuditSeverity,
  type NewAuditLog,
} from "@/server/db/schema";

export type AuditLogActor = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
};

export type AuditLogWithActor = AuditLog & { actor: AuditLogActor | null };

export type ListAuditLogsParams = {
  actorId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  severity?: AuditSeverity;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
};

export async function insert(executor: Executor, row: NewAuditLog): Promise<AuditLog> {
  const [created] = await executor.insert(auditLogs).values(row).returning();
  return created;
}

export async function listPaginated(
  params: ListAuditLogsParams,
  executor: ReadExecutor = db,
): Promise<{ data: AuditLogWithActor[]; total: number }> {
  const conditions: SQL[] = [];

  if (params.actorId) conditions.push(eq(auditLogs.actorId, params.actorId));
  if (params.entityType) conditions.push(eq(auditLogs.entityType, params.entityType));
  if (params.entityId) conditions.push(eq(auditLogs.entityId, params.entityId));
  if (params.action) conditions.push(eq(auditLogs.action, params.action));
  if (params.severity) conditions.push(eq(auditLogs.severity, params.severity));
  if (params.from) conditions.push(gte(auditLogs.createdAt, new Date(params.from)));
  if (params.to) conditions.push(lte(auditLogs.createdAt, new Date(params.to)));

  const filter = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await executor
    .select({ total: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(filter);

  const data = await executor
    .select({
      id: auditLogs.id,
      actorId: auditLogs.actorId,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      changes: auditLogs.changes,
      metadata: auditLogs.metadata,
      ipAddress: auditLogs.ipAddress,
      userAgent: auditLogs.userAgent,
      severity: auditLogs.severity,
      createdAt: auditLogs.createdAt,
      actor: {
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        imageUrl: users.imageUrl,
      },
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .where(filter)
    .orderBy(desc(auditLogs.createdAt))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  return { data, total };
}
