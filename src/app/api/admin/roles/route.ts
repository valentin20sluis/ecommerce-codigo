import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { createRoleSchema } from "@/modules/roles/schemas/role.schema";
import * as roleRepository from "@/server/repositories/role.repository";
import { createRole } from "@/server/services/access-control.service";

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.ROLES_READ);

    return NextResponse.json(await roleRepository.listWithCounts());
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission(PERMISSIONS.ROLES_CREATE);
    const input = createRoleSchema.parse(await request.json());

    const role = await createRole(actor, input);

    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
