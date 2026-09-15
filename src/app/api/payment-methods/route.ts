import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/api-error";
import { requireAuth } from "@/lib/auth";
import {
  toPaymentMethodDto,
  type PaymentMethodListResponse,
} from "@/modules/payment-methods/types";
import * as paymentMethodRepository from "@/server/repositories/payment-method.repository";

/** Sin entrada que validar: el `userId` sale de la sesión, no de la query (AC10). */
export async function GET() {
  try {
    const user = await requireAuth();

    const cards = await paymentMethodRepository.listByUser(user.id);

    return NextResponse.json<PaymentMethodListResponse>({
      data: cards.map(toPaymentMethodDto),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
