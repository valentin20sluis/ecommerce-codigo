import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { adminOrdersQuerySchema } from "@/modules/orders/schemas/admin-order.schema";
import {
  toAdminOrderListItem,
  type AdminOrderListResponse,
} from "@/modules/orders/types/admin-order";
import * as orderRepository from "@/server/repositories/order.repository";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.ORDERS_READ);

    const query = adminOrdersQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const { data, total } = await orderRepository.listPaginated(query);

    return NextResponse.json<AdminOrderListResponse>({
      data: data.map(toAdminOrderListItem),
      meta: { page: query.page, pageSize: query.pageSize, total },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
