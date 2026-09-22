import { ConflictError, NotFoundError } from "@/lib/api-error";
import { diffChanges, logAudit } from "@/lib/audit";
import {
  CANCELABLE_STATUSES,
  ORDER_FULFILLMENT_NEXT,
  ORDER_STATUS_VIEW,
} from "@/modules/orders/constants";
import { dbTx } from "@/server/db/pool";
import type { Order, OrderStatus, User } from "@/server/db/schema";
import * as orderRepository from "@/server/repositories/order.repository";
import { recordReturnMovements } from "@/server/services/inventory.service";

const ORDER_ENTITY = "order";

function transitionConflict(current: OrderStatus, allowed: OrderStatus | undefined): ConflictError {
  const from = ORDER_STATUS_VIEW[current].label;

  if (!allowed) {
    return new ConflictError(`Un pedido «${from}» ya no admite cambios de estado.`);
  }

  return new ConflictError(
    `Un pedido «${from}» solo puede avanzar a «${ORDER_STATUS_VIEW[allowed].label}».`,
  );
}

/**
 * Avanza un único paso del fulfillment. La transición se valida contra el estado
 * leído en la transacción (012 D3) y el `UPDATE` repite ese estado en su `WHERE`
 * (D4), de modo que la auditoría solo se escribe si la fila cambió de verdad.
 */
export async function advanceOrderStatus(
  actor: User,
  id: string,
  next: OrderStatus,
): Promise<Order> {
  return dbTx.transaction(async (tx) => {
    const current = await orderRepository.findByIdWithItems(id, tx);
    if (!current) throw new NotFoundError("El pedido no existe.");

    const allowed = ORDER_FULFILLMENT_NEXT[current.status];
    if (!allowed || allowed !== next) throw transitionConflict(current.status, allowed);

    const updated = await orderRepository.updateStatus(tx, id, current.status, next);

    // Sin fila: otro admin avanzó el mismo pedido entre la lectura y el UPDATE.
    if (!updated) {
      throw new ConflictError("El pedido cambió de estado mientras se procesaba la solicitud.");
    }

    await logAudit(tx, {
      actorId: actor.id,
      action: "order.status_changed",
      entityType: ORDER_ENTITY,
      entityId: updated.id,
      changes: diffChanges({ status: current.status }, { status: updated.status }),
    });

    return updated;
  });
}

/**
 * Cancelación de un pedido ya cobrado (014 D6). Repone el stock con un `return`
 * por línea en la misma transacción que el cambio de estado y la bitácora;
 * repetirla no repone dos veces: el estado de origen viaja en el `WHERE` del
 * UPDATE y los movimientos llevan el candado de idempotencia por orden (AC5).
 *
 * No toca Stripe: el reembolso queda fuera del alcance de 014.
 */
export async function cancelOrder(actor: User, id: string): Promise<Order> {
  return dbTx.transaction(async (tx) => {
    const current = await orderRepository.findByIdWithItems(id, tx);
    if (!current) throw new NotFoundError("El pedido no existe.");

    if (!CANCELABLE_STATUSES.includes(current.status)) {
      throw new ConflictError(
        `Un pedido «${ORDER_STATUS_VIEW[current.status].label}» ya no se puede cancelar.`,
      );
    }

    const updated = await orderRepository.updateStatus(tx, id, current.status, "canceled");

    if (!updated) {
      throw new ConflictError("El pedido cambió de estado mientras se procesaba la solicitud.");
    }

    const movements = await recordReturnMovements(tx, {
      orderId: updated.id,
      lines: current.items.map((item) => ({ productId: item.productId, qty: item.qty })),
      actorId: actor.id,
    });

    await logAudit(tx, {
      actorId: actor.id,
      action: "order.canceled",
      entityType: ORDER_ENTITY,
      entityId: updated.id,
      changes: diffChanges({ status: current.status }, { status: updated.status }),
      metadata: { restockedLines: movements.length },
      severity: "warning",
    });

    return updated;
  });
}

/**
 * Único punto de entrada del `PATCH` de estado: la cancelación no es un paso más
 * del fulfillment, así que se resuelve por su propio camino en vez de colarse en
 * `ORDER_FULFILLMENT_NEXT`.
 */
export function changeOrderStatus(actor: User, id: string, next: OrderStatus): Promise<Order> {
  return next === "canceled" ? cancelOrder(actor, id) : advanceOrderStatus(actor, id, next);
}
