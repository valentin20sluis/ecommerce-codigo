import type { DashboardRange } from "@/modules/dashboard/schemas/metrics.schema";
import type { DailySalesPoint, TopProductRow } from "@/server/repositories/order.repository";
import type { LowStockProduct } from "@/server/repositories/product.repository";

export type { DailySalesPoint, LowStockProduct, TopProductRow };

/**
 * Los 5 bloques del dashboard en una sola respuesta (013 D5). `lowStock` viaja
 * aquí aunque ignore `range`: evita un segundo request para un solo listado.
 */
export type DashboardMetricsDto = {
  range: DashboardRange;
  salesCents: number;
  ordersCount: number;
  /** Siempre `range` puntos: los días sin ventas llegan en 0 (D4). */
  dailySales: DailySalesPoint[];
  topProducts: TopProductRow[];
  lowStock: LowStockProduct[];
};
