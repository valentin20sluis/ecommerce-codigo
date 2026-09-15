import { Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";

import { db } from "./index";
import * as schema from "./schema";

type Schema = typeof schema;

// El driver neon-http no soporta transacciones; este cliente WebSocket existe
// solo para las mutaciones que deben escribir su audit_log en la misma tx.
const globalForPool = globalThis as unknown as { neonPool?: Pool };

const pool =
  globalForPool.neonPool ?? new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") {
  globalForPool.neonPool = pool;
}

export const dbTx: NeonDatabase<Schema> = drizzle(pool, { schema });

export type Transaction = Parameters<Parameters<typeof dbTx.transaction>[0]>[0];

/** Puede escribir: cliente transaccional o una transacción abierta. */
export type Executor = NeonDatabase<Schema> | Transaction;

/** Solo lectura: añade el cliente HTTP, que no puede abrir transacciones. */
export type ReadExecutor = typeof db | Executor;

/** Solo para scripts (seed, migraciones): un proceso de Node no termina con el pool abierto. */
export function closePool(): Promise<void> {
  return pool.end();
}
