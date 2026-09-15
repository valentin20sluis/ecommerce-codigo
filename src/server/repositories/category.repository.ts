import { and, asc, eq, ilike, sql, type SQL } from "drizzle-orm";

import { db } from "@/server/db";
import type { Executor, ReadExecutor } from "@/server/db/pool";
import { categories, products, type Category, type NewCategory } from "@/server/db/schema";

export type ListCategoriesParams = {
  q?: string;
  status: "all" | "active" | "inactive";
  page: number;
  pageSize: number;
};

export type CategoryValues = Pick<NewCategory, "name" | "slug" | "description" | "isActive">;

export async function findById(
  id: string,
  executor: ReadExecutor = db,
): Promise<Category | null> {
  const [row] = await executor.select().from(categories).where(eq(categories.id, id)).limit(1);
  return row ?? null;
}

export async function findBySlug(
  slug: string,
  executor: ReadExecutor = db,
): Promise<Category | null> {
  const [row] = await executor.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  return row ?? null;
}

export async function listPaginated(
  params: ListCategoriesParams,
  executor: ReadExecutor = db,
): Promise<{ data: Category[]; total: number }> {
  const conditions: SQL[] = [];

  const term = params.q?.trim();
  // El btree de `name` ordena, no acelera este ILIKE con comodín inicial.
  if (term) conditions.push(ilike(categories.name, `%${term}%`));
  if (params.status !== "all") conditions.push(eq(categories.isActive, params.status === "active"));

  const filter = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await executor
    .select({ total: sql<number>`count(*)::int` })
    .from(categories)
    .where(filter);

  const data = await executor
    .select()
    .from(categories)
    .where(filter)
    .orderBy(asc(categories.name))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  return { data, total };
}

/** Sostiene el guard de borrado: `products.category_id` es FK ON DELETE RESTRICT. */
export async function countByCategoryId(
  id: string,
  executor: ReadExecutor = db,
): Promise<number> {
  const [{ total }] = await executor
    .select({ total: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.categoryId, id));

  return total;
}

export async function create(executor: Executor, values: CategoryValues): Promise<Category> {
  const [row] = await executor.insert(categories).values(values).returning();
  return row;
}

export async function update(
  executor: Executor,
  id: string,
  values: CategoryValues,
): Promise<Category | null> {
  const [row] = await executor
    .update(categories)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(categories.id, id))
    .returning();

  return row ?? null;
}

export async function remove(executor: Executor, id: string): Promise<void> {
  await executor.delete(categories).where(eq(categories.id, id));
}
