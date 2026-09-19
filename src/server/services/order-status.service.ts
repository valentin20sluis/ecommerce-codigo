import { ConflictError, NotFoundError } from "@/lib/api-error";
import { diffChanges, logAudit } from "@/lib/audit";
import { ORDER_FULFILLMENT_NEXT, ORDER_STATUS_VIEW } from "@/modules/orders/constants";
import { dbTx } from "@/server/db/pool";
import type { Order, OrderStatus, User } from "@/server/db/schema";
import * as orderRepository from "@/server/repositories/order.repository";

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
