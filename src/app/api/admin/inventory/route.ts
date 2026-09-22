import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { inventoryQuerySchema } from "@/modules/inventory/schemas/inventory.schema";
import {
  toInventoryRowDto,
  type InventoryListResponse,
} from "@/modules/inventory/types/inventory";
import * as productRepository from "@/server/repositories/product.repository";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.INVENTORY_READ);

    const query = inventoryQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const { data, total } = await productRepository.listInventory(query);

    return NextResponse.json<InventoryListResponse>({
      data: data.map(toInventoryRowDto),
      meta: { page: query.page, pageSize: query.pageSize, total },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
