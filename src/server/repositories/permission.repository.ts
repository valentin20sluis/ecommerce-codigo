import { asc, inArray } from "drizzle-orm";

import { db } from "@/server/db";
import type { ReadExecutor } from "@/server/db/pool";
import { permissions, type Permission } from "@/server/db/schema";

export function findAll(executor: ReadExecutor = db): Promise<Permission[]> {
  return executor
    .select()
    .from(permissions)
    .orderBy(asc(permissions.resource), asc(permissions.action));
}

export function findByIds(ids: string[], executor: ReadExecutor = db): Promise<Permission[]> {
  if (ids.length === 0) return Promise.resolve([]);

  return executor.select().from(permissions).where(inArray(permissions.id, ids));
}

export function findByCodes(codes: string[], executor: ReadExecutor = db): Promise<Permission[]> {
  if (codes.length === 0) return Promise.resolve([]);

  return executor.select().from(permissions).where(inArray(permissions.code, codes));
}
