import { ConflictError, NotFoundError } from "@/lib/api-error";
import { diffChanges, logAudit } from "@/lib/audit";
import type {
  CreateProductInput,
  UpdateProductInput,
} from "@/modules/products/schemas/product.schema";
import { dbTx, type Executor } from "@/server/db/pool";
import type { Product, User } from "@/server/db/schema";
import * as categoryRepository from "@/server/repositories/category.repository";
import * as productRepository from "@/server/repositories/product.repository";
import { recordInitialMovement } from "@/server/services/inventory.service";

const PRODUCT_ENTITY = "product";

const UNIQUE_VIOLATION = "23505";

const SKU_CONSTRAINT = "products_sku_unique";

type UniqueTarget = "slug" | "sku";

/**
 * Drizzle envuelve el error del driver, así que el `23505` vive en la cadena de
 * `cause`. Aquí además hace falta el `constraint`: con dos índices únicos, decir
 * "slug duplicado" cuando el duplicado era el SKU es un mensaje falso (AC7).
 */
function uniqueViolationTarget(error: unknown): UniqueTarget | null {
  for (let current = error, depth = 0; current != null && depth < 4; depth++) {
    if (typeof current === "object" && "code" in current) {
      const candidate = current as { code?: unknown; constraint?: unknown };

      if (candidate.code === UNIQUE_VIOLATION) {
        return candidate.constraint === SKU_CONSTRAINT ? "sku" : "slug";
      }
    }

    current = (current as { cause?: unknown }).cause;
  }

  return null;
}

function slugConflict(slug: string): ConflictError {
  return new ConflictError(`Ya existe un producto con el slug "${slug}".`);
}

function skuConflict(sku: string): ConflictError {
  return new ConflictError(`Ya existe un producto con el SKU "${sku}".`);
}

function uniqueConflict(
  target: UniqueTarget,
  slug: string | undefined,
  sku: string | null | undefined,
): ConflictError {
  if (target === "sku" && sku) return skuConflict(sku);
  if (target === "slug" && slug) return slugConflict(slug);

  return new ConflictError("Ya existe un producto con ese slug o SKU.");
}

async function requireProduct(tx: Executor, id: string): Promise<Product> {
  const product = await productRepository.findById(id, tx);
  if (!product) throw new NotFoundError("El producto no existe.");

  return product;
}

/** La FK ON DELETE RESTRICT daría un 23503 opaco; el guard lo vuelve un 404 legible (AC12). */
async function requireCategoryExists(tx: Executor, categoryId: string): Promise<void> {
  const category = await categoryRepository.findById(categoryId, tx);
  if (!category) throw new NotFoundError("La categoría seleccionada no existe.");
}

async function assertSlugIsFree(tx: Executor, slug: string): Promise<void> {
  const existing = await productRepository.findBySlug(slug, tx);
  if (existing) throw slugConflict(slug);
}

async function assertSkuIsFree(tx: Executor, sku: string): Promise<void> {
  const existing = await productRepository.findBySku(sku, tx);
  if (existing) throw skuConflict(sku);
}

function auditableFields(product: Product): Record<string, unknown> {
  return {
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    description: product.description,
    categoryId: product.categoryId,
    priceCents: product.priceCents,
    compareAtPriceCents: product.compareAtPriceCents,
    stock: product.stock,
    lowStockThreshold: product.lowStockThreshold,
    isActive: product.isActive,
    imageUrl: product.imageUrl,
  };
}

/**
 * `actor_id` nulo ya significa "el usuario fue borrado" por el `onDelete: set null`
 * de la FK; la marca distingue ese caso del de una mutación sin sesión (D1).
 */
function actorMetadata(actor: User | null): Record<string, unknown> | null {
  return actor ? null : { anonymousActor: true };
}

export async function createProduct(
  actor: User | null,
  input: CreateProductInput,
): Promise<Product> {
  try {
    return await dbTx.transaction(async (tx) => {
      await requireCategoryExists(tx, input.categoryId);
      await assertSlugIsFree(tx, input.slug);
      if (input.sku) await assertSkuIsFree(tx, input.sku);

      const product = await productRepository.create(tx, {
        name: input.name,
        slug: input.slug,
        sku: input.sku ?? null,
        description: input.description ?? null,
        categoryId: input.categoryId,
        priceCents: input.priceCents,
        compareAtPriceCents: input.compareAtPriceCents ?? null,
        stock: input.stock,
        lowStockThreshold: input.lowStockThreshold,
        isActive: input.isActive,
        imageUrl: input.imageUrl ?? null,
      });

      // El kardex arranca con el stock de alta (014 T11): sin este `initial`,
      // `sum(qty_delta)` no cuadraría con `products.stock` (AC6).
      await recordInitialMovement(tx, product.id, product.stock, actor?.id ?? null);

      await logAudit(tx, {
        actorId: actor?.id ?? null,
        action: "product.created",
        entityType: PRODUCT_ENTITY,
        entityId: product.id,
        changes: { before: null, after: auditableFields(product) },
        metadata: actorMetadata(actor),
      });

      return product;
    });
  } catch (error) {
    const target = uniqueViolationTarget(error);
    if (target) throw uniqueConflict(target, input.slug, input.sku);
    throw error;
  }
}

export async function updateProduct(
  actor: User | null,
  id: string,
  input: UpdateProductInput,
): Promise<Product> {
  try {
    return await dbTx.transaction(async (tx) => {
      const current = await requireProduct(tx, id);

      if (input.categoryId !== undefined && input.categoryId !== current.categoryId) {
        await requireCategoryExists(tx, input.categoryId);
      }

      if (input.slug !== undefined && input.slug !== current.slug) {
        await assertSlugIsFree(tx, input.slug);
      }

      if (input.sku !== undefined && input.sku !== null && input.sku !== current.sku) {
        await assertSkuIsFree(tx, input.sku);
      }

      const updated = await productRepository.update(tx, id, {
        name: input.name ?? current.name,
        slug: input.slug ?? current.slug,
        sku: input.sku === undefined ? current.sku : (input.sku ?? null),
        description: input.description === undefined ? current.description : input.description,
        categoryId: input.categoryId ?? current.categoryId,
        priceCents: input.priceCents ?? current.priceCents,
        compareAtPriceCents:
          input.compareAtPriceCents === undefined
            ? current.compareAtPriceCents
            : (input.compareAtPriceCents ?? null),
        // `stock` no viaja aquí: lo mueve solo el módulo de inventario (AC9).
        lowStockThreshold: input.lowStockThreshold ?? current.lowStockThreshold,
        isActive: input.isActive ?? current.isActive,
        imageUrl: input.imageUrl === undefined ? current.imageUrl : (input.imageUrl ?? null),
      });

      if (!updated) throw new NotFoundError("El producto no existe.");

      const changes = diffChanges(auditableFields(current), auditableFields(updated));

      if (changes) {
        await logAudit(tx, {
          actorId: actor?.id ?? null,
          action: "product.updated",
          entityType: PRODUCT_ENTITY,
          entityId: updated.id,
          changes,
          metadata: actorMetadata(actor),
        });
      }

      return updated;
    });
  } catch (error) {
    const target = uniqueViolationTarget(error);
    if (target) throw uniqueConflict(target, input.slug, input.sku);
    throw error;
  }
}

export async function deleteProduct(actor: User | null, id: string): Promise<void> {
  await dbTx.transaction(async (tx) => {
    const product = await requireProduct(tx, id);

    await productRepository.remove(tx, id);

    await logAudit(tx, {
      actorId: actor?.id ?? null,
      action: "product.deleted",
      entityType: PRODUCT_ENTITY,
      entityId: product.id,
      changes: { before: auditableFields(product), after: null },
      metadata: actorMetadata(actor),
      severity: "warning",
    });
  });
}
