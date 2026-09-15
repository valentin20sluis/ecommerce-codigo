import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

import { createClerkClient, type User as ClerkUser } from "@clerk/backend";

import { closePool } from "@/server/db/pool";
import {
  applyUserUpsert,
  toUserProjection,
  type ClerkIdentity,
} from "@/server/services/user-sync.service";

/** Máximo que acepta `GET /v1/users` por página. */
const PAGE_SIZE = 100;

type Summary = {
  fetched: number;
  created: number;
  updated: number;
  failed: number;
};

/** Adaptador camelCase del Backend API a la identidad normalizada del servicio. */
function toIdentity(user: ClerkUser): ClerkIdentity {
  return {
    clerkId: user.id,
    emails: user.emailAddresses.map((email) => ({ id: email.id, address: email.emailAddress })),
    primaryEmailId: user.primaryEmailAddressId,
    firstName: user.firstName,
    lastName: user.lastName,
    imageUrl: user.imageUrl,
  };
}

async function syncPage(page: ClerkUser[], summary: Summary): Promise<void> {
  for (const clerkUser of page) {
    try {
      const projection = toUserProjection(toIdentity(clerkUser));
      const { created } = await applyUserUpsert(projection, "clerk_backfill");
      if (created) summary.created += 1;
      else summary.updated += 1;
    } catch (error) {
      // Un usuario con email en conflicto no debe abortar el backfill completo:
      // se reporta, se cuenta y el proceso termina con código distinto de cero.
      summary.failed += 1;
      console.error(`No se pudo sincronizar ${clerkUser.id}:`, error);
    }
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está definida. Configúrala en .env.local.");
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY no está definida. Configúrala en .env.local.");
  }

  const clerk = createClerkClient({ secretKey });
  const summary: Summary = { fetched: 0, created: 0, updated: 0, failed: 0 };

  let offset = 0;
  let totalCount = 0;

  do {
    const { data, totalCount: total } = await clerk.users.getUserList({
      limit: PAGE_SIZE,
      offset,
    });

    totalCount = total;
    summary.fetched += data.length;
    offset += data.length;

    if (data.length === 0) break;

    await syncPage(data, summary);
  } while (offset < totalCount);

  console.log(`Usuarios en Clerk: ${totalCount}`);
  console.log(`Leídos: ${summary.fetched}`);
  console.log(`Creados: ${summary.created}`);
  console.log(`Actualizados: ${summary.updated}`);
  console.log(`Fallidos: ${summary.failed}`);

  if (summary.failed > 0) {
    process.exitCode = 1;
    console.error("Backfill terminado con errores.");
    return;
  }

  console.log("Backfill completado.");
}

main()
  .catch((error) => {
    console.error("Backfill fallido:", error);
    process.exitCode = 1;
  })
  .finally(closePool);
