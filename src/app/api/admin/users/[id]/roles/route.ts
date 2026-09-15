import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { setUserRolesSchema } from "@/modules/roles/schemas/user-role.schema";
import { setUserRoles } from "@/server/services/access-control.service";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission(PERMISSIONS.USERS_ASSIGN_ROLES);

    const { id } = await context.params;
    const userId = z.uuid().parse(id);
    const { roleIds } = setUserRolesSchema.parse(await request.json());

    return NextResponse.json(await setUserRoles(actor, userId, roleIds));
  } catch (error) {
    return toErrorResponse(error);
  }
}
