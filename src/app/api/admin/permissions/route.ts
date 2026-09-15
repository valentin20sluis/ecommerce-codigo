import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/api-error";
import { groupByResource, PERMISSIONS, requirePermission } from "@/lib/permissions";
import * as permissionRepository from "@/server/repositories/permission.repository";

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.ROLES_READ);

    const permissions = await permissionRepository.findAll();

    return NextResponse.json(groupByResource(permissions));
  } catch (error) {
    return toErrorResponse(error);
  }
}
