import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhook, type WebhookEvent } from "@clerk/nextjs/webhooks";

import { toErrorResponse } from "@/lib/api-error";
import { syncUserDeleted, syncUserUpserted } from "@/server/services/user-sync.service";

async function dispatch(event: WebhookEvent): Promise<void> {
  switch (event.type) {
    case "user.created":
    case "user.updated":
      await syncUserUpserted(event.data);
      return;
    case "user.deleted":
      await syncUserDeleted(event.data);
      return;
    default:
      // Clerk puede enviar eventos a los que no estamos suscritos: 200 y seguir.
      return;
  }
}

export async function POST(request: NextRequest) {
  let event: WebhookEvent;

  try {
    event = await verifyWebhook(request);
  } catch (error) {
    console.error("[webhook:clerk] firma inválida", error);
    return NextResponse.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: "No se pudo verificar la firma del webhook.",
          details: null,
        },
      },
      { status: 400 },
    );
  }

  try {
    await dispatch(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
