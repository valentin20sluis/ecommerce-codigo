import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api-error";
import { requireAuth } from "@/lib/auth";
import { ordersQuerySchema } from "@/modules/orders/schemas/order.schema";
import { toOrderListItemDto, type OrderListResponse } from "@/modules/orders/types";
import * as orderRepository from "@/server/repositories/order.repository";

// `middleware.ts` ya exige sesión en `/api/orders` (no está en `isPublicRoute`);
// `requireAuth()` es la segunda capa y, además, la fuente del `userId`.
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const query = ordersQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const orders = await orderRepository.listByUser(user.id, query);

    return NextResponse.json<OrderListResponse>({
      data: orders.map(toOrderListItemDto),
      meta: { limit: query.limit, truncated: orders.length === query.limit },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
