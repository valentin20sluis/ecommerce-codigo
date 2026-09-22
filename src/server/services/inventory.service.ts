import { BadRequestError, ConflictError, NotFoundError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import type { CreateStockMovementInput } from "@/modules/inventory/schemas/inventory.schema";
import { dbTx, type Executor } from "@/server/db/pool";
import type { StockMovement, User } from "@/server/db/schema";
import * as productRepository from "@/server/repositories/product.repository";
import * as stockMovementRepository from "@/server/repositories/stock-movement.repository";

import {
  automaticMovementDelta,
  manualMovementDelta,
  manualMovementReason,
  pendingOrderLines,
  type AutomaticMovementType,
  type OrderStockLine,
} from "./inventory.math";

const PRODUCT_ENTITY = "product";

/** `reference_type` de los movimientos que nacen de una orden. */
const ORDER_REFERENCE = "order";

export type OrderMovementParams = {
  orderId: string;
  lines: OrderStockLine[];
  /** Nulo en el webhook de Stripe: el movimiento es automático, no lo pidió nadie. */
  actorId: string | null;
};

/**
 * Ajuste manual del panel (014 T7). Stock y kardex se mueven en la misma
 * transacción que la bitácora: si algo falla, no queda ni el movimiento ni el
 * log (AC11). El stock nunca se lee-modifica-escribe — `adjustment` va con
 * bloqueo optimista y `waste`/`restock` con suma atómica (D3).
 */
export async function adjustStock(
  actor: User,
  productId: string,
  input: CreateStockMovementInput,
): Promise<StockMovement> {
  return dbTx.transaction(async (tx) => {
    const product = await productRepository.findById(productId, tx);
    if (!product) throw new NotFoundError("El producto no existe.");

    const qtyDelta = manualMovementDelta(input);

    // El CHECK `qty_delta <> 0` rechazaría el INSERT con un error opaco.
    if (qtyDelta === 0) {
      throw new BadRequestError("El conteo coincide con el stock actual: no hay nada que ajustar.");
    }

    const updated =
      input.type === "adjustment"
        ? await productRepository.setStockIfUnchanged(
            tx,
            productId,
            input.expectedStock,
            input.countedStock,
          )
        : await productRepository.applyStockDelta(tx, productId, qtyDelta);

    // Sin fila: el stock cambió entre la lectura del admin y el UPDATE (AC2).
    if (!updated) {
      throw new ConflictError(
        "El stock cambió mientras registrabas el movimiento. Vuelve a cargar el inventario.",
      );
    }

    const movement = await stockMovementRepository.insert(tx, {
      productId,
      type: input.type,
      qtyDelta,
      stockAfter: updated.stock,
      reason: manualMovementReason(input),
      referenceType: null,
      referenceId: null,
      actorId: actor.id,
    });

    // El stock previo se deriva del UPDATE, no de la lectura de arriba: en
    // `waste`/`restock` esa lectura no bloquea la fila y pudo quedar obsoleta.
    const stockBefore = updated.stock - qtyDelta;

    await logAudit(tx, {
      actorId: actor.id,
      action: "inventory.adjusted",
      entityType: PRODUCT_ENTITY,
      entityId: productId,
      changes: { before: { stock: stockBefore }, after: { stock: updated.stock } },
      metadata: {
        movementId: movement.id,
        type: movement.type,
        qtyDelta,
        reason: movement.reason,
      },
      severity: input.type === "waste" ? "warning" : "info",
    });

    return movement;
  });
}

/**
 * Movimientos automáticos de una orden, idempotentes por `reference`: lo ya
 * escrito para ese par orden/tipo se omite, así que una reentrega del webhook o
 * una segunda cancelación no vuelven a mover el stock (AC4, AC5). El índice
 * único de la tabla es el candado final.
 */
async function recordOrderMovements(
  executor: Executor,
  type: AutomaticMovementType,
  params: OrderMovementParams,
): Promise<StockMovement[]> {
  const recorded = await stockMovementRepository.findByReference(
    executor,
    ORDER_REFERENCE,
    params.orderId,
    type,
  );

  const pending = pendingOrderLines(
    params.lines,
    recorded.map((movement) => movement.productId),
  );

  const movements: StockMovement[] = [];

  for (const line of pending) {
    const qtyDelta = automaticMovementDelta(type, line.qty);
    const updated = await productRepository.applyStockDelta(executor, line.productId, qtyDelta);

    // El producto se borró después de la compra: no hay stock que mover ni kardex donde anotarlo.
    if (!updated) {
      console.warn(`[inventory] ${type} de ${params.orderId}: producto ${line.productId} ausente`);
      continue;
    }

    movements.push(
      await stockMovementRepository.insert(executor, {
        productId: line.productId,
        type,
        qtyDelta,
        stockAfter: updated.stock,
        reason: null,
        referenceType: ORDER_REFERENCE,
        referenceId: params.orderId,
        actorId: params.actorId,
      }),
    );
  }

  return movements;
}

/** Descuento post-cobro (008, ahora con kardex): se resta sin clamp a propósito. */
export function recordSaleMovements(
  executor: Executor,
  params: OrderMovementParams,
): Promise<StockMovement[]> {
  return recordOrderMovements(executor, "sale", params);
}

/** Reposición por cancelación de un pedido ya cobrado (014 D6/T10). */
export function recordReturnMovements(
  executor: Executor,
  params: OrderMovementParams,
): Promise<StockMovement[]> {
  return recordOrderMovements(executor, "return", params);
}

/**
 * Alta de producto con stock inicial (T11): el kardex arranca con la misma foto
 * que el backfill de la migración, para que `sum(qty_delta)` cuadre desde el
 * primer día (AC6). Con stock 0 no hay movimiento: el CHECK exige `qty_delta <> 0`.
 */
export async function recordInitialMovement(
  executor: Executor,
  productId: string,
  stock: number,
  actorId: string | null,
): Promise<StockMovement | null> {
  if (stock === 0) return null;

  return stockMovementRepository.insert(executor, {
    productId,
    type: "initial",
    qtyDelta: stock,
    stockAfter: stock,
    reason: null,
    referenceType: null,
    referenceId: null,
    actorId,
  });
}
