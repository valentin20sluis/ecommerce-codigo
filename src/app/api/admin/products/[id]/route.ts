import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { NotFoundError, toErrorResponse } from "@/lib/api-error";
import { getCurrentUser } from "@/lib/auth";
import { updateProductSchema } from "@/modules/products/schemas/product.schema";
import * as productRepository from "@/server/repositories/product.repository";
import { deleteProduct, updateProduct } from "@/server/services/product.service";

type Context = { params: Promise<{ id: string }> };

async function resolveId(context: Context): Promise<string> {
  const { id } = await context.params;
  return z.uuid().parse(id);
}

// Sin autenticación ni requirePermission(): desviación deliberada y temporal
// documentada en docs/specs/003-products-crud.md (D1) y su plan de cierre.
export async function GET(_request: NextRequest, context: Context) {
  try {
    const product = await productRepository.findById(await resolveId(context));
    if (!product) throw new NotFoundError("El producto no existe.");

    return NextResponse.json(product);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const actor = await getCurrentUser();

    const id = await resolveId(context);
    const input = updateProductSchema.parse(await request.json());

    return NextResponse.json(await updateProduct(actor, id, input));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const actor = await getCurrentUser();

    await deleteProduct(actor, await resolveId(context));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
