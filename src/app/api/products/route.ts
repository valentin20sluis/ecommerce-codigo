import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api-error";
import { publicProductsQuerySchema } from "@/modules/products/schemas/product.schema";
import * as productRepository from "@/server/repositories/product.repository";

// Pública por diseño (005): solo GET, siempre `status: "active"`, nunca expone
// productos inactivos. No es la misma exención temporal que /api/admin/products (003 D1).
export async function GET(request: NextRequest) {
  try {
    const query = publicProductsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const [{ data, total }, facets] = await Promise.all([
      productRepository.listPaginated({
        status: "active",
        q: query.q,
        categorySlugs: query.categories,
        priceBands: query.priceBands,
        sort: query.sort,
        onSale: query.onSale,
        page: query.page,
        pageSize: query.pageSize,
      }),
      productRepository.getFacetCounts(),
    ]);

    return NextResponse.json({
      data,
      meta: { page: query.page, pageSize: query.pageSize, total },
      facets,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
