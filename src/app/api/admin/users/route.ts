import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { usersQuerySchema } from "@/modules/roles/schemas/user-role.schema";
import * as userRepository from "@/server/repositories/user.repository";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.USERS_READ);

    const query = usersQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const { data, total } = await userRepository.listPaginated(query);

    return NextResponse.json({
      data,
      meta: { page: query.page, pageSize: query.pageSize, total },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
