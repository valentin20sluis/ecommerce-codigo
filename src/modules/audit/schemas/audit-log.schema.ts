import { z } from "zod";

/**
 * Duplicado a propósito, mismo patrón que `PRICE_BANDS` en `product.schema.ts`:
 * este archivo vive en `modules/` (puede llegar a un componente cliente) y no
 * debe importar de `server/db/schema`. La fuente de verdad para la columna y
 * el enum de Postgres sigue siendo `AUDIT_SEVERITIES` en
 * `src/server/db/schema/audit-log.ts`.
 */
const AUDIT_SEVERITIES = ["info", "warning", "error"] as const;

export const auditLogsQuerySchema = z.object({
  actorId: z.uuid().optional(),
  entityType: z.string().max(50).optional(),
  entityId: z.string().max(100).optional(),
  action: z.string().max(100).optional(),
  severity: z.enum(AUDIT_SEVERITIES).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type AuditLogsQuery = z.infer<typeof auditLogsQuerySchema>;
