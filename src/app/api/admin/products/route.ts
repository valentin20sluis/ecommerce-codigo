import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api-error";
import { getCurrentUser } from "@/lib/auth";
import {
  createProductSchema,
  productsQuerySchema,
} from "@/modules/products/schemas/product.schema";
import * as productRepository from "@/server/repositories/product.repository";
import { createProduct } from "@/server/services/product.service";

// Sin autenticación ni requirePermission(): desviación deliberada y temporal
// documentada en docs/specs/003-products-crud.md (D1) y su plan de cierre.
export async function GET(request: NextRequest) {
  try {
    const query = productsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const { data, total } = await productRepository.listPaginated(query);

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
    const input = createProductSchema.parse(await request.json());

    return NextResponse.json(await createProduct(actor, input), { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
