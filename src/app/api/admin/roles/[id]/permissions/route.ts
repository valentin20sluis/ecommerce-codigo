import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { setRolePermissionsSchema } from "@/modules/roles/schemas/role.schema";
import * as roleRepository from "@/server/repositories/role.repository";
import { setRolePermissions } from "@/server/services/access-control.service";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission(PERMISSIONS.ROLES_MANAGE_PERMISSIONS);

    const { id } = await context.params;
    const roleId = z.uuid().parse(id);
    const { permissionIds } = setRolePermissionsSchema.parse(await request.json());

    const role = await setRolePermissions(actor, roleId, permissionIds);

    return NextResponse.json({
      ...role,
      permissionIds: await roleRepository.getPermissionIds(roleId),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
