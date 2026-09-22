import type { CreateStockMovementInput } from "@/modules/inventory/schemas/inventory.schema";

/** Tipos que emite el servidor a partir de una orden, nunca el cliente. */
export type AutomaticMovementType = "sale" | "return";

export type OrderStockLine = { productId: string; qty: number };

/**
 * Signo de `qty_delta` por tipo (014 D1). La API recibe cantidades positivas o
 * un conteo físico; el signo se decide aquí y en ningún otro lugar:
 * `adjustment` puede sumar o restar según el conteo, `waste` siempre resta y
 * `restock` siempre suma.
 */
export function manualMovementDelta(input: CreateStockMovementInput): number {
  switch (input.type) {
    case "adjustment":
      return input.countedStock - input.expectedStock;
    case "waste":
      return -input.qty;
    case "restock":
      return input.qty;
  }
}

/** `restock` es el único que admite motivo vacío; el CHECK de la tabla exige el resto. */
export function manualMovementReason(input: CreateStockMovementInput): string | null {
  return input.type === "restock" ? (input.reason ?? null) : input.reason;
}

/** `sale` descuenta, `return` repone. Misma cantidad positiva, signo opuesto. */
export function automaticMovementDelta(type: AutomaticMovementType, qty: number): number {
  return type === "sale" ? -qty : qty;
}

/**
 * Un pedido con dos líneas del mismo producto rompería el índice único de
 * idempotencia (§Notas): se agrega por `productId` sumando `qty` antes de
 * escribir los movimientos. Conserva el orden de primera aparición.
 */
export function aggregateOrderQuantities(lines: OrderStockLine[]): OrderStockLine[] {
  const totals = new Map<string, number>();

  for (const line of lines) {
    totals.set(line.productId, (totals.get(line.productId) ?? 0) + line.qty);
  }

  return [...totals.entries()].map(([productId, qty]) => ({ productId, qty }));
}

/**
 * Líneas que todavía faltan por mover: las agregadas menos las que ya tienen
 * movimiento para esa referencia. Es el filtro de idempotencia de `sale`/`return`
 * (AC4, AC5) — una reentrega del webhook o una segunda cancelación lo dejan
 * vacío— y se calcula aparte de la BD para poder probarlo sin ella.
 */
export function pendingOrderLines(
  lines: OrderStockLine[],
  recordedProductIds: Iterable<string>,
): OrderStockLine[] {
  const already = new Set(recordedProductIds);

  return aggregateOrderQuantities(lines).filter((line) => !already.has(line.productId));
}
