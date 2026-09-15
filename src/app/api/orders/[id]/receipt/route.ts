import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/api-error";
import { requireAuth } from "@/lib/auth";
import type { OrderReceiptResponse } from "@/modules/orders/types";
import { getReceiptUrl } from "@/server/services/order-receipt.service";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    const user = await requireAuth();

    const { id } = await context.params;
    const orderId = z.uuid().parse(id);

    return NextResponse.json<OrderReceiptResponse>({
      url: await getReceiptUrl(orderId, user.id),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
