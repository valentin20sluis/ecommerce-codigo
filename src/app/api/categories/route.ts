import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api-error";
import { publicCategoriesQuerySchema } from "@/modules/categories/schemas/category.schema";
import * as categoryRepository from "@/server/repositories/category.repository";

// Pública por diseño (005): solo GET, siempre `status: "active"`, nunca expone
// categorías inactivas. No es la misma exención temporal que /api/admin/categories (002 D2).
export async function GET(request: NextRequest) {
  try {
    const query = publicCategoriesQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const { data, total } = await categoryRepository.listPaginated({
      status: "active",
      q: query.q,
      page: query.page,
      pageSize: query.pageSize,
    });

    return NextResponse.json({
      data,
      meta: { page: query.page, pageSize: query.pageSize, total },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
