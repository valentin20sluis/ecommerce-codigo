import type {
  InventoryFilterValue,
  ManualMovementType,
  StockMovementTypeValue,
} from "@/modules/inventory/schemas/inventory.schema";

export type StockMovementView = {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
};

/** Un movimiento se nombra igual en el kardex y en el diálogo de ajuste. */
export const STOCK_MOVEMENT_VIEW: Record<StockMovementTypeValue, StockMovementView> = {
  initial: { label: "Inicial", variant: "outline" },
  sale: { label: "Venta", variant: "secondary" },
  return: { label: "Devolución", variant: "default" },
  adjustment: { label: "Ajuste por conteo", variant: "outline" },
  waste: { label: "Merma", variant: "destructive" },
  restock: { label: "Reposición", variant: "default" },
};

export const MANUAL_MOVEMENT_HINT: Record<ManualMovementType, string> = {
  adjustment: "Registra el conteo físico: el sistema calcula la diferencia.",
  waste: "Unidades que se pierden (rotura, robo, vencimiento). Restan del stock.",
  restock: "Unidades que entran sin venta previa. Suman al stock.",
};

export const INVENTORY_FILTER_LABEL: Record<InventoryFilterValue, string> = {
  all: "Todo el catálogo",
  low: "Stock bajo",
  negative: "Stock negativo",
};

export type StockLevel = "negative" | "low" | "ok";

/**
 * Semáforo del stock (AC7): un producto en negativo es sobreventa de 008 y sigue
 * siendo ajustable; el nivel bajo se mide contra el umbral propio del producto.
 */
export function stockLevel(stock: number, lowStockThreshold: number): StockLevel {
  if (stock < 0) return "negative";
  if (stock <= lowStockThreshold) return "low";
  return "ok";
}

export const STOCK_LEVEL_VARIANT: Record<StockLevel, StockMovementView["variant"]> = {
  negative: "destructive",
  low: "secondary",
  ok: "outline",
};
