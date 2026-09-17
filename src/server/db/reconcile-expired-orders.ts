import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

import { getStripe } from "@/lib/stripe";
import { closePool } from "@/server/db/pool";
import * as orderRepository from "@/server/repositories/order.repository";
import * as fulfillmentService from "@/server/services/order-fulfillment.service";

/**
 * Backfill de las órdenes que se quedaron en `pending_payment` porque su sesión
 * de Stripe expiró antes de que el webhook estuviera suscrito al evento (011 T9).
 *
 * No hardcodea ids: pregunta a Stripe por cada sesión pendiente y solo actúa
 * sobre las que Stripe confirma `expired`. Es idempotente por el guard de
 * `markExpired`, así que una segunda ejecución no modifica ni audita nada.
 */
const BATCH_LIMIT = 200;

type Summary = {
  scanned: number;
  expired: number;
  skipped: number;
  failed: number;
};

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está definida. Configúrala en .env.local.");
  }

  const stripe = getStripe();
  const candidates = await orderRepository.listPendingWithSession(BATCH_LIMIT);
  const summary: Summary = { scanned: candidates.length, expired: 0, skipped: 0, failed: 0 };

  console.log(`Órdenes pendientes con sesión de Stripe: ${candidates.length}`);

  for (const order of candidates) {
    // `listPendingWithSession` ya filtra por NOT NULL; el guard es para el tipo.
    const sessionId = order.stripeCheckoutSessionId;
    if (!sessionId) continue;

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.status !== "expired") {
        summary.skipped += 1;
        console.log(`· ${order.id} — sesión ${sessionId} en estado "${session.status}": sin cambios`);
        continue;
      }

      const changed = await fulfillmentService.expireOrder(session, "backfill");

      if (changed) {
        summary.expired += 1;
        console.log(`✓ ${order.id} — marcada expired (sesión ${sessionId})`);
      } else {
        summary.skipped += 1;
        console.log(`· ${order.id} — ya no estaba pendiente: sin cambios`);
      }
    } catch (error) {
      // Una sesión borrada o un error de red no debe abortar el resto del lote.
      summary.failed += 1;
      console.error(`No se pudo reconciliar ${order.id} (sesión ${sessionId}):`, error);
    }
  }

  console.log(`Revisadas: ${summary.scanned}`);
  console.log(`Marcadas expired: ${summary.expired}`);
  console.log(`Sin cambios: ${summary.skipped}`);
  console.log(`Fallidas: ${summary.failed}`);

  if (summary.failed > 0) {
    process.exitCode = 1;
    console.error("Reconciliación terminada con errores.");
    return;
  }

  console.log("Reconciliación completada.");
}

main()
  .catch((error) => {
    console.error("Reconciliación fallida:", error);
    process.exitCode = 1;
  })
  .finally(closePool);
