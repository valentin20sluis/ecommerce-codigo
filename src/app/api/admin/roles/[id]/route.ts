import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { NotFoundError, toErrorResponse } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { updateRoleSchema } from "@/modules/roles/schemas/role.schema";
import * as roleRepository from "@/server/repositories/role.repository";
import { deleteRole, updateRole } from "@/server/services/access-control.service";

type Context = { params: Promise<{ id: string }> };

async function resolveId(context: Context): Promise<string> {
  const { id } = await context.params;
  return z.uuid().parse(id);
}

export async function GET(_request: NextRequest, context: Context) {
  try {
    await requirePermission(PERMISSIONS.ROLES_READ);

    const id = await resolveId(context);
    const role = await roleRepository.findById(id);
    if (!role) throw new NotFoundError("El rol no existe.");

    const permissionIds = await roleRepository.getPermissionIds(id);

    return NextResponse.json({ ...role, permissionIds });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission(PERMISSIONS.ROLES_UPDATE);

    const id = await resolveId(context);
    const input = updateRoleSchema.parse(await request.json());

    return NextResponse.json(await updateRole(actor, id, input));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission(PERMISSIONS.ROLES_DELETE);

    await deleteRole(actor, await resolveId(context));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
