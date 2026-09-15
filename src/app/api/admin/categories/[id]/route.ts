import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { NotFoundError, toErrorResponse } from "@/lib/api-error";
import { getCurrentUser } from "@/lib/auth";
import { updateCategorySchema } from "@/modules/categories/schemas/category.schema";
import * as categoryRepository from "@/server/repositories/category.repository";
import { deleteCategory, updateCategory } from "@/server/services/category.service";

type Context = { params: Promise<{ id: string }> };

async function resolveId(context: Context): Promise<string> {
  const { id } = await context.params;
  return z.uuid().parse(id);
}

// Sin autenticación ni requirePermission(): desviación deliberada y temporal
// documentada en docs/specs/002-categories-crud.md (D2, §11 y Enmienda 1 §12).
export async function GET(_request: NextRequest, context: Context) {
  try {
    const category = await categoryRepository.findById(await resolveId(context));
    if (!category) throw new NotFoundError("La categoría no existe.");

    return NextResponse.json(category);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const actor = await getCurrentUser();

    const id = await resolveId(context);
    const input = updateCategorySchema.parse(await request.json());

    return NextResponse.json(await updateCategory(actor, id, input));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const actor = await getCurrentUser();

    await deleteCategory(actor, await resolveId(context));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
