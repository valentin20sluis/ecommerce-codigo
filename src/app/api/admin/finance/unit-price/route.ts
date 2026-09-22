import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { unitPriceQuerySchema } from "@/modules/finance/schemas/unit-price.schema";
import { toUnitPriceRowDto, type UnitPriceListResponse } from "@/modules/finance/types/finance";
import * as productRepository from "@/server/repositories/product.repository";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.FINANCE_READ);

    const query = unitPriceQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const { data, total } = await productRepository.listUnitPrices(query);

    return NextResponse.json<UnitPriceListResponse>({
      data: data.map(toUnitPriceRowDto),
      meta: { page: query.page, pageSize: query.pageSize, total },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
