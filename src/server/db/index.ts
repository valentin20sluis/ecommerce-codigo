import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import * as schema from "./schema";

type Database = NeonHttpDatabase<typeof schema>;

let instance: Database | null = null;

function getDb(): Database {
  if (!instance) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL no está definida.");
    }

    instance = drizzle(neon(connectionString), { schema });
  }

  return instance;
}

/**
 * Cliente de lectura (HTTP, sin transacciones). La conexión se resuelve en el
 * primer uso: `next build` evalúa este módulo y no debe exigir una URL válida
 * en tiempo de compilación. Para escrituras auditadas, usa `dbTx` de `./pool`.
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, property, receiver) {
    const database = getDb();
    const value = Reflect.get(database, property, receiver);

    return typeof value === "function" ? value.bind(database) : value;
  },
});
