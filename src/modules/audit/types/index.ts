import type { AuditLog, AuditSeverity } from "@/server/db/schema";
import type { Serialized } from "@/types/api";

export type AuditLogActorDto = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
};

export type AuditLogListItem = Serialized<AuditLog> & {
  actor: AuditLogActorDto | null;
};

export type { AuditSeverity };
