import { NotFoundError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { dbTx } from "@/server/db/pool";
import type { Product, User } from "@/server/db/schema";
import * as productRepository from "@/server/repositories/product.repository";

const PRODUCT_ENTITY = "product";

/**
 * Edición de costo (015 D3/D6): transacción propia con su propia auditoría,
 * separada de `product.service.ts` porque el costo es un dato de Finanzas, no
 * de catálogo. `costCents: null` es una edición válida: borra un costo
 * cargado por error en vez de dejarlo en `0` (que se leería como margen 100%).
 */
export async function updateProductCost(
  actor: User,
  productId: string,
  costCents: number | null,
): Promise<Product> {
  return dbTx.transaction(async (tx) => {
    const product = await productRepository.findById(productId, tx);
    if (!product) throw new NotFoundError("El producto no existe.");

    const updated = await productRepository.updateCost(tx, productId, costCents);
    if (!updated) throw new NotFoundError("El producto no existe.");

    await logAudit(tx, {
      actorId: actor.id,
      action: "finance.cost_updated",
      entityType: PRODUCT_ENTITY,
      entityId: productId,
      changes: {
        before: { costCents: product.costCents },
        after: { costCents: updated.costCents },
      },
    });

    return updated;
  });
}
