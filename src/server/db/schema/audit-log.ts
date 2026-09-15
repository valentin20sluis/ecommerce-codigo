import { desc, relations, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import { index, inet, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./user";

export const AUDIT_SEVERITIES = ["info", "warning", "error"] as const;

export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number];

export type AuditChanges = {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

export const auditSeverity = pgEnum("audit_severity", AUDIT_SEVERITIES);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    changes: jsonb("changes").$type<AuditChanges>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    severity: auditSeverity("severity").notNull().default("info"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_actor_created_at_idx").on(t.actorId, desc(t.createdAt)),
    index("audit_logs_action_idx").on(t.action),
    index("audit_logs_created_at_idx").on(desc(t.createdAt)),
  ],
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, { fields: [auditLogs.actorId], references: [users.id] }),
}));

export type AuditLog = InferSelectModel<typeof auditLogs>;
export type NewAuditLog = InferInsertModel<typeof auditLogs>;
