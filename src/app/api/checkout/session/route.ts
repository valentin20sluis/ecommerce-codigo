import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api-error";
import { requireAuth } from "@/lib/auth";
import { createCheckoutSessionSchema } from "@/modules/checkout/schemas/checkout.schema";
import type { CheckoutSessionResponse } from "@/modules/checkout/types";
import * as checkoutService from "@/server/services/checkout.service";

// Sin checkout de invitado (008 D2): `middleware.ts` ya exige sesión en
// `/api/checkout`, y `requireAuth()` es la segunda capa dentro del handler.
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { items } = createCheckoutSessionSchema.parse(await request.json());

    const { checkoutUrl } = await checkoutService.createCheckoutSession(user, items);

    return NextResponse.json<CheckoutSessionResponse>({ url: checkoutUrl });
  } catch (error) {
    return toErrorResponse(error);
  }
}
