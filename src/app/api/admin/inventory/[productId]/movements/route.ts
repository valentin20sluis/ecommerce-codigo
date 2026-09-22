import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { NotFoundError, toErrorResponse } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import {
  createStockMovementSchema,
  movementsQuerySchema,
} from "@/modules/inventory/schemas/inventory.schema";
import {
  toCreatedStockMovementDto,
  toStockMovementDto,
  type StockMovementDto,
  type StockMovementListResponse,
} from "@/modules/inventory/types/inventory";
import * as productRepository from "@/server/repositories/product.repository";
import * as stockMovementRepository from "@/server/repositories/stock-movement.repository";
import { adjustStock } from "@/server/services/inventory.service";

type Context = { params: Promise<{ productId: string }> };

async function resolveProductId(context: Context): Promise<string> {
  const { productId } = await context.params;
  return z.uuid().parse(productId);
}

export async function GET(request: NextRequest, context: Context) {
  try {
    await requirePermission(PERMISSIONS.INVENTORY_READ);

    const productId = await resolveProductId(context);
    const query = movementsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    // Un kardex vacío de un producto inexistente sería un 200 engañoso.
    const product = await productRepository.findById(productId);
    if (!product) throw new NotFoundError("El producto no existe.");

    const { data, total } = await stockMovementRepository.listByProduct(productId, query);

    return NextResponse.json<StockMovementListResponse>({
      data: data.map(toStockMovementDto),
      meta: { page: query.page, pageSize: query.pageSize, total },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission(PERMISSIONS.INVENTORY_ADJUST);

    const productId = await resolveProductId(context);
    const input = createStockMovementSchema.parse(await request.json());

    const movement = await adjustStock(actor, productId, input);

    return NextResponse.json<StockMovementDto>(
      toCreatedStockMovementDto(movement, actor.email),
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
