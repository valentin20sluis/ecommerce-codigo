import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api-error";
import { getCurrentUser } from "@/lib/auth";
import {
  categoriesQuerySchema,
  createCategorySchema,
} from "@/modules/categories/schemas/category.schema";
import * as categoryRepository from "@/server/repositories/category.repository";
import { createCategory } from "@/server/services/category.service";

// Sin autenticación ni requirePermission(): desviación deliberada y temporal
// documentada en docs/specs/002-categories-crud.md (D2, §11 y Enmienda 1 §12).
export async function GET(request: NextRequest) {
  try {
    const query = categoriesQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const { data, total } = await categoryRepository.listPaginated(query);

    return NextResponse.json({
      data,
      meta: { page: query.page, pageSize: query.pageSize, total },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getCurrentUser();
    const input = createCategorySchema.parse(await request.json());

    return NextResponse.json(await createCategory(actor, input), { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
