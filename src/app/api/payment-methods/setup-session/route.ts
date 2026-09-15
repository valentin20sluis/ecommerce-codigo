import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api-error";
import { requireAuth } from "@/lib/auth";
import { createSetupSessionSchema } from "@/modules/payment-methods/schemas/payment-method.schema";
import type { SetupSessionResponse } from "@/modules/payment-methods/types";
import * as savedCardService from "@/server/services/saved-card.service";

/**
 * `middleware.ts` ya exige sesión en `/api/payment-methods` (no está en
 * `isPublicRoute`); `requireAuth()` es la segunda capa y, además, la única
 * fuente del `userId`: nunca llega por body ni por query.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Body vacío y `.strict()`: un `{}` ausente vale igual que uno explícito,
    // pero cualquier campo de más se rechaza con 400.
    createSetupSessionSchema.parse(await request.json().catch(() => ({})));

    return NextResponse.json<SetupSessionResponse>({
      url: await savedCardService.createSetupSession(user),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
