import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api-error";
import { requireAuth } from "@/lib/auth";
import { paymentMethodIdParamSchema } from "@/modules/payment-methods/schemas/payment-method.schema";
import type { DeletePaymentMethodResponse } from "@/modules/payment-methods/types";
import * as savedCardService from "@/server/services/saved-card.service";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const user = await requireAuth();

    // Un `id` no-uuid es 400 antes de tocar la BD; una tarjeta ajena, 404 dentro
    // del servicio. Nunca 403: no se filtra que la fila existe.
    const { id } = paymentMethodIdParamSchema.parse(await context.params);

    await savedCardService.removeCard(user, id);

    return NextResponse.json<DeletePaymentMethodResponse>({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
