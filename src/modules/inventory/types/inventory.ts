import type { StockMovement } from "@/server/db/schema";
import type { InventoryRow } from "@/server/repositories/product.repository";
import type { StockMovementRow } from "@/server/repositories/stock-movement.repository";
import type { Paginated, Serialized } from "@/types/api";

export type InventoryRowDto = Serialized<InventoryRow>;

export type InventoryListResponse = Paginated<InventoryRowDto>;

/** Fila del kardex tal como cruza al cliente; `actorEmail` llega del join (014 T4). */
export type StockMovementDto = Serialized<StockMovementRow>;

export type StockMovementListResponse = Paginated<StockMovementDto>;

export function toInventoryRowDto(row: InventoryRow): InventoryRowDto {
  return { ...row, updatedAt: row.updatedAt.toISOString() };
}

export function toStockMovementDto(row: StockMovementRow): StockMovementDto {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

/**
 * El POST devuelve el movimiento recién escrito sin repetir el join del kardex:
 * el actor es quien hizo la petición, así que el handler ya tiene su email.
 */
export function toCreatedStockMovementDto(
  movement: StockMovement,
  actorEmail: string | null,
): StockMovementDto {
  return toStockMovementDto({ ...movement, actorEmail });
}
