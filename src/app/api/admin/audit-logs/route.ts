import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { auditLogsQuerySchema } from "@/modules/audit/schemas/audit-log.schema";
import * as auditLogRepository from "@/server/repositories/audit-log.repository";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.AUDIT_READ);

    const query = auditLogsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const { data, total } = await auditLogRepository.listPaginated(query);

    return NextResponse.json({
      data,
      meta: { page: query.page, pageSize: query.pageSize, total },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
