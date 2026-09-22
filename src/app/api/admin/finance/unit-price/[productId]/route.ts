import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { updateCostSchema } from "@/modules/finance/schemas/unit-price.schema";
import { toUnitPriceRowDto, type UnitPriceRowDto } from "@/modules/finance/types/finance";
import { updateProductCost } from "@/server/services/finance.service";

type Context = { params: Promise<{ productId: string }> };

async function resolveProductId(context: Context): Promise<string> {
  const { productId } = await context.params;
  return z.uuid().parse(productId);
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission(PERMISSIONS.FINANCE_MANAGE_COSTS);

    const productId = await resolveProductId(context);
    const input = updateCostSchema.parse(await request.json());

    const updated = await updateProductCost(actor, productId, input.costCents);

    return NextResponse.json<UnitPriceRowDto>(
      toUnitPriceRowDto({
        id: updated.id,
        name: updated.name,
        sku: updated.sku,
        priceCents: updated.priceCents,
        costCents: updated.costCents,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
