import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  lt,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/server/db";
import type { Executor, ReadExecutor } from "@/server/db/pool";
import { categories, products, type NewProduct, type Product } from "@/server/db/schema";

export type ProductSort = "newest" | "price_asc" | "price_desc";

/** Cortes fijos en centavos, mismos que el mock aprobado (006 D2). */
export const PRICE_BANDS = ["lt100", "100to300", "300to700", "gt700"] as const;

export type PriceBand = (typeof PRICE_BANDS)[number];

function priceBandCondition(band: PriceBand): SQL {
  switch (band) {
    case "lt100":
      return lt(products.priceCents, 10000);
    case "100to300":
      return and(gte(products.priceCents, 10000), lt(products.priceCents, 30000))!;
    case "300to700":
      return and(gte(products.priceCents, 30000), lt(products.priceCents, 70000))!;
    case "gt700":
      return gte(products.priceCents, 70000);
  }
}

export type ListProductsParams = {
  q?: string;
  status: "all" | "active" | "inactive";
  categoryId?: string;
  /** Filtro público por slug de categoría, OR entre varias (006 T1); alternativa a `categoryId`. */
  categorySlugs?: string[];
  /** OR entre bandas, AND con el resto de filtros (006 D2). */
  priceBands?: PriceBand[];
  /** Solo productos con `compareAtPriceCents` no nulo (005 D5). */
  onSale?: boolean;
  /** Sin especificar, se conserva el orden histórico por `name` asc. */
  sort?: ProductSort;
  page: number;
  pageSize: number;
};

export type ProductValues = Pick<
  NewProduct,
  | "name"
  | "slug"
  | "sku"
  | "description"
  | "categoryId"
  | "priceCents"
  | "compareAtPriceCents"
  | "stock"
  | "lowStockThreshold"
  | "isActive"
  | "imageUrl"
>;

/** Alta y edición ya no comparten campos: el stock solo se fija al crear (014 T11). */
export type ProductUpdateValues = Omit<ProductValues, "stock">;

/** Fila del listado: nombre y slug de categoría se resuelven en el join, no en el cliente. */
export type ProductListRow = Product & { categoryName: string; categorySlug: string };

export async function findById(id: string, executor: ReadExecutor = db): Promise<Product | null> {
  const [row] = await executor.select().from(products).where(eq(products.id, id)).limit(1);
  return row ?? null;
}

export async function findBySlug(
  slug: string,
  executor: ReadExecutor = db,
): Promise<Product | null> {
  const [row] = await executor.select().from(products).where(eq(products.slug, slug)).limit(1);
  return row ?? null;
}

export async function findBySku(sku: string, executor: ReadExecutor = db): Promise<Product | null> {
  const [row] = await executor.select().from(products).where(eq(products.sku, sku)).limit(1);
  return row ?? null;
}

/** Detalle público (007 T1): mismo join que `listPaginated`, solo activos — nunca expone uno dado de baja. */
export async function findPublicBySlug(
  slug: string,
  executor: ReadExecutor = db,
): Promise<ProductListRow | null> {
  const [row] = await executor
    .select({ product: products, categoryName: categories.name, categorySlug: categories.slug })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.slug, slug), eq(products.isActive, true)))
    .limit(1);

  return row ? { ...row.product, categoryName: row.categoryName, categorySlug: row.categorySlug } : null;
}

export async function listPaginated(
  params: ListProductsParams,
  executor: ReadExecutor = db,
): Promise<{ data: ProductListRow[]; total: number }> {
  const conditions: SQL[] = [];

  const term = params.q?.trim();
  // Los btree de `name`/`sku` ordenan y deduplican; no aceleran un ILIKE con comodín inicial.
  if (term) {
    const pattern = `%${term}%`;
    const match = or(ilike(products.name, pattern), ilike(products.sku, pattern));
    if (match) conditions.push(match);
  }

  if (params.status !== "all") conditions.push(eq(products.isActive, params.status === "active"));
  if (params.categoryId) conditions.push(eq(products.categoryId, params.categoryId));
  if (params.categorySlugs?.length) conditions.push(inArray(categories.slug, params.categorySlugs));
  if (params.onSale) conditions.push(isNotNull(products.compareAtPriceCents));

  if (params.priceBands?.length) {
    const bandMatch = or(...params.priceBands.map(priceBandCondition));
    if (bandMatch) conditions.push(bandMatch);
  }

  const filter = conditions.length > 0 ? and(...conditions) : undefined;

  const orderBy =
    params.sort === "price_asc"
      ? asc(products.priceCents)
      : params.sort === "price_desc"
        ? desc(products.priceCents)
        : params.sort === "newest"
          ? desc(products.createdAt)
          : asc(products.name);

  const [{ total }] = await executor
    .select({ total: sql<number>`count(*)::int` })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(filter);

  const rows = await executor
    .select({ product: products, categoryName: categories.name, categorySlug: categories.slug })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(filter)
    .orderBy(orderBy)
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  return {
    data: rows.map((row) => ({
      ...row.product,
      categoryName: row.categoryName,
      categorySlug: row.categorySlug,
    })),
    total,
  };
}

export type FacetCounts = {
  /** categorySlug -> cantidad de productos activos, sin aplicar ningún filtro (006 T6). */
  categories: Record<string, number>;
  priceBands: Record<PriceBand, number>;
};

/**
 * Conteos estáticos por categoría/banda de precio, calcados de `catCheck`/`priceCheck`
 * del mock aprobado: cuentan sobre el catálogo activo completo, sin aplicar los demás
 * filtros activos (006 T6) — evita recalcular una combinatoria de conteos por cada
 * cambio de filtro.
 */
export async function getFacetCounts(executor: ReadExecutor = db): Promise<FacetCounts> {
  const categoryRows = await executor
    .select({ slug: categories.slug, count: sql<number>`count(*)::int` })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.isActive, true))
    .groupBy(categories.slug);

  const [bandRow] = await executor
    .select({
      lt100: sql<number>`count(*) filter (where ${products.priceCents} < 10000)::int`,
      cents100to300: sql<number>`count(*) filter (where ${products.priceCents} >= 10000 and ${products.priceCents} < 30000)::int`,
      cents300to700: sql<number>`count(*) filter (where ${products.priceCents} >= 30000 and ${products.priceCents} < 70000)::int`,
      gt700: sql<number>`count(*) filter (where ${products.priceCents} >= 70000)::int`,
    })
    .from(products)
    .where(eq(products.isActive, true));

  return {
    categories: Object.fromEntries(categoryRows.map((row) => [row.slug, row.count])),
    priceBands: {
      lt100: bandRow?.lt100 ?? 0,
      "100to300": bandRow?.cents100to300 ?? 0,
      "300to700": bandRow?.cents300to700 ?? 0,
      gt700: bandRow?.gt700 ?? 0,
    },
  };
}

export async function create(executor: Executor, values: ProductValues): Promise<Product> {
  const [row] = await executor.insert(products).values(values).returning();
  return row;
}

export async function update(
  executor: Executor,
  id: string,
  values: ProductUpdateValues,
): Promise<Product | null> {
  const [row] = await executor
    .update(products)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning();

  return row ?? null;
}

export async function remove(executor: Executor, id: string): Promise<void> {
  await executor.delete(products).where(eq(products.id, id));
}

export type LowStockProduct = Pick<
  Product,
  "id" | "name" | "slug" | "stock" | "lowStockThreshold"
>;

/**
 * Alerta de inventario del dashboard (013 D7, umbral por producto en 014): solo
 * activos, porque un producto dado de baja no se vende y no es alerta. Orden por
 * stock asc para que lo más urgente quede arriba; el límite lo fija el llamador.
 */
export async function listLowStock(
  limit: number,
  executor: ReadExecutor = db,
): Promise<LowStockProduct[]> {
  return executor
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      stock: products.stock,
      lowStockThreshold: products.lowStockThreshold,
    })
    .from(products)
    .where(and(eq(products.isActive, true), lte(products.stock, products.lowStockThreshold)))
    .orderBy(asc(products.stock))
    .limit(limit);
}

/**
 * Suma atómica del delta (014 D3): `stock = stock + delta` en el propio UPDATE,
 * sin leer-modificar-escribir, y el `RETURNING` entrega el `stock_after` que
 * persiste el kardex. Se aplica **sin clamp** a propósito (008): una sobreventa
 * queda visible como stock negativo en vez de perderse en silencio.
 */
export async function applyStockDelta(
  executor: Executor,
  id: string,
  delta: number,
): Promise<Product | null> {
  const [row] = await executor
    .update(products)
    .set({ stock: sql`${products.stock} + ${delta}`, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning();

  return row ?? null;
}

/**
 * Bloqueo optimista del conteo físico (014 D3): el stock esperado viaja en el
 * `WHERE`, así que si otro movimiento entró entre la lectura del admin y el
 * guardado no hay fila y el servicio responde 409 sin escribir movimiento (AC2).
 */
export async function setStockIfUnchanged(
  executor: Executor,
  id: string,
  expected: number,
  next: number,
): Promise<Product | null> {
  const [row] = await executor
    .update(products)
    .set({ stock: next, updatedAt: new Date() })
    .where(and(eq(products.id, id), eq(products.stock, expected)))
    .returning();

  return row ?? null;
}

export const INVENTORY_FILTERS = ["all", "low", "negative"] as const;

export type InventoryFilter = (typeof INVENTORY_FILTERS)[number];

export type ListInventoryParams = {
  q?: string;
  filter: InventoryFilter;
  page: number;
  pageSize: number;
};

/** Fila del listado de inventario: sin precios ni descripción, con la categoría del join. */
export type InventoryRow = Pick<
  Product,
  "id" | "name" | "slug" | "sku" | "stock" | "lowStockThreshold" | "isActive" | "updatedAt"
> & { categoryName: string };

function inventoryFilterCondition(filter: InventoryFilter): SQL | undefined {
  switch (filter) {
    case "low":
      return lte(products.stock, products.lowStockThreshold);
    case "negative":
      return lt(products.stock, 0);
    case "all":
      return undefined;
  }
}

/**
 * Listado del módulo (014). Una consulta por página más el `count(*)`: no
 * resuelve el último movimiento fila por fila, que sería el N+1 de §Notas.
 */
export async function listInventory(
  params: ListInventoryParams,
  executor: ReadExecutor = db,
): Promise<{ data: InventoryRow[]; total: number }> {
  const conditions: SQL[] = [];

  const term = params.q?.trim();
  if (term) {
    const pattern = `%${term}%`;
    const match = or(ilike(products.name, pattern), ilike(products.sku, pattern));
    if (match) conditions.push(match);
  }

  const filterCondition = inventoryFilterCondition(params.filter);
  if (filterCondition) conditions.push(filterCondition);

  const filter = conditions.length > 0 ? and(...conditions) : undefined;

  const columns = {
    id: products.id,
    name: products.name,
    slug: products.slug,
    sku: products.sku,
    stock: products.stock,
    lowStockThreshold: products.lowStockThreshold,
    isActive: products.isActive,
    updatedAt: products.updatedAt,
    categoryName: categories.name,
  };

  const [{ total }] = await executor
    .select({ total: sql<number>`count(*)::int` })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(filter);

  const data = await executor
    .select(columns)
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(filter)
    // Lo más urgente arriba: primero los negativos, luego el stock más bajo.
    .orderBy(asc(products.stock), asc(products.name))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  return { data, total };
}

export type UnitPriceParams = {
  q?: string;
  page: number;
  pageSize: number;
};

/** Fila del listado de Finanzas: solo lo necesario para precio, costo y margen. */
export type UnitPriceRow = Pick<Product, "id" | "name" | "sku" | "priceCents" | "costCents">;

/**
 * Listado del módulo de Finanzas (015). Sin join de categoría: el reporte de
 * margen no la necesita. Una consulta por página más el `count(*)`.
 */
export async function listUnitPrices(
  params: UnitPriceParams,
  executor: ReadExecutor = db,
): Promise<{ data: UnitPriceRow[]; total: number }> {
  const conditions: SQL[] = [];

  const term = params.q?.trim();
  if (term) {
    const pattern = `%${term}%`;
    const match = or(ilike(products.name, pattern), ilike(products.sku, pattern));
    if (match) conditions.push(match);
  }

  const filter = conditions.length > 0 ? and(...conditions) : undefined;

  const columns = {
    id: products.id,
    name: products.name,
    sku: products.sku,
    priceCents: products.priceCents,
    costCents: products.costCents,
  };

  const [{ total }] = await executor
    .select({ total: sql<number>`count(*)::int` })
    .from(products)
    .where(filter);

  const data = await executor
    .select(columns)
    .from(products)
    .where(filter)
    .orderBy(asc(products.name))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  return { data, total };
}

/** Edición de costo (015 D3): `costCents: null` borra un costo cargado por error. */
export async function updateCost(
  executor: Executor,
  id: string,
  costCents: number | null,
): Promise<Product | null> {
  const [row] = await executor
    .update(products)
    .set({ costCents, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning();

  return row ?? null;
}
