import { api } from "@/lib/axios";
import type { AuditLogsQuery } from "@/modules/audit/schemas/audit-log.schema";
import type { AuditLogListItem } from "@/modules/audit/types";
import type { Paginated } from "@/types/api";

export async function fetchAuditLogs(
  query: AuditLogsQuery,
): Promise<Paginated<AuditLogListItem>> {
  const { data } = await api.get<Paginated<AuditLogListItem>>("/admin/audit-logs", {
    params: query,
  });

  return data;
}
