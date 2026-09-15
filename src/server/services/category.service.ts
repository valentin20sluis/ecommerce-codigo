import { ConflictError, NotFoundError } from "@/lib/api-error";
import { diffChanges, logAudit } from "@/lib/audit";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@/modules/categories/schemas/category.schema";
import { dbTx, type Executor } from "@/server/db/pool";
import type { Category, User } from "@/server/db/schema";
import * as categoryRepository from "@/server/repositories/category.repository";

const CATEGORY_ENTITY = "category";

const UNIQUE_VIOLATION = "23505";

/**
 * El pre-chequeo de slug no sobrevive a dos altas concurrentes: sin esto la
 * segunda revienta contra el índice único y sale como 500 (D4). Drizzle envuelve
 * el error del driver en `DrizzleQueryError`, así que el `23505` real vive en la
 * cadena de `cause`, no en el nivel superior.
 */
function isUniqueViolation(error: unknown): boolean {
  for (let current = error, depth = 0; current != null && depth < 4; depth++) {
    if (
      typeof current === "object" &&
      "code" in current &&
      (current as { code?: unknown }).code === UNIQUE_VIOLATION
    ) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

function slugConflict(slug: string): ConflictError {
  return new ConflictError(`Ya existe una categoría con el slug "${slug}".`);
}

async function requireCategory(tx: Executor, id: string): Promise<Category> {
  const category = await categoryRepository.findById(id, tx);
  if (!category) throw new NotFoundError("La categoría no existe.");

  return category;
}

async function assertSlugIsFree(tx: Executor, slug: string): Promise<void> {
  const existing = await categoryRepository.findBySlug(slug, tx);
  if (existing) throw slugConflict(slug);
}

function auditableFields(category: Category): Record<string, unknown> {
  return {
    name: category.name,
    slug: category.slug,
    description: category.description,
    isActive: category.isActive,
  };
}

/**
 * `actor_id` nulo ya significa "el usuario fue borrado" por el `onDelete: set null`
 * de la FK; la marca distingue ese caso del de una mutación sin sesión (D17).
 */
function actorMetadata(actor: User | null): Record<string, unknown> | null {
  return actor ? null : { anonymousActor: true };
}

export async function createCategory(
  actor: User | null,
  input: CreateCategoryInput,
): Promise<Category> {
  try {
    return await dbTx.transaction(async (tx) => {
      await assertSlugIsFree(tx, input.slug);

      const category = await categoryRepository.create(tx, {
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        isActive: input.isActive,
      });

      await logAudit(tx, {
        actorId: actor?.id ?? null,
        action: "category.created",
        entityType: CATEGORY_ENTITY,
        entityId: category.id,
        changes: { before: null, after: auditableFields(category) },
        metadata: actorMetadata(actor),
      });

      return category;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw slugConflict(input.slug);
    throw error;
  }
}

export async function updateCategory(
  actor: User | null,
  id: string,
  input: UpdateCategoryInput,
): Promise<Category> {
  try {
    return await dbTx.transaction(async (tx) => {
      const current = await requireCategory(tx, id);

      if (input.slug !== undefined && input.slug !== current.slug) {
        await assertSlugIsFree(tx, input.slug);
      }

      const updated = await categoryRepository.update(tx, id, {
        name: input.name ?? current.name,
        slug: input.slug ?? current.slug,
        description: input.description === undefined ? current.description : input.description,
        isActive: input.isActive ?? current.isActive,
      });

      if (!updated) throw new NotFoundError("La categoría no existe.");

      const changes = diffChanges(auditableFields(current), auditableFields(updated));

      if (changes) {
        await logAudit(tx, {
          actorId: actor?.id ?? null,
          action: "category.updated",
          entityType: CATEGORY_ENTITY,
          entityId: updated.id,
          changes,
          metadata: actorMetadata(actor),
        });
      }

      return updated;
    });
  } catch (error) {
    if (input.slug !== undefined && isUniqueViolation(error)) throw slugConflict(input.slug);
    throw error;
  }
}

export async function deleteCategory(actor: User | null, id: string): Promise<void> {
  await dbTx.transaction(async (tx) => {
    const category = await requireCategory(tx, id);

    // Sin este guard la FK ON DELETE RESTRICT revienta con 23503 y sale como 500 (003 T7).
    const productCount = await categoryRepository.countByCategoryId(id, tx);
    if (productCount > 0) {
      throw new ConflictError(
        `No se puede eliminar «${category.name}»: tiene ${productCount} producto(s) asociado(s). ` +
          "Reasígnalos o elimínalos primero.",
      );
    }

    await categoryRepository.remove(tx, id);

    await logAudit(tx, {
      actorId: actor?.id ?? null,
      action: "category.deleted",
      entityType: CATEGORY_ENTITY,
      entityId: category.id,
      changes: { before: auditableFields(category), after: null },
      metadata: actorMetadata(actor),
      severity: "warning",
    });
  });
}
