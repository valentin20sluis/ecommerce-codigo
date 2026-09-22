import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { updateOrderStatusSchema } from "@/modules/orders/schemas/admin-order.schema";
import { toAdminOrderDto, type AdminOrderDto } from "@/modules/orders/types/admin-order";
import { changeOrderStatus } from "@/server/services/order-status.service";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission(PERMISSIONS.ORDERS_UPDATE_STATUS);

    const { id } = await context.params;
    const orderId = z.uuid().parse(id);
    const input = updateOrderStatusSchema.parse(await request.json());

    const order = await changeOrderStatus(actor, orderId, input.status);

    return NextResponse.json<AdminOrderDto>(toAdminOrderDto(order));
  } catch (error) {
    return toErrorResponse(error);
  }
}
