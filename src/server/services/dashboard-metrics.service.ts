import { LOW_STOCK_LIMIT, TOP_PRODUCTS_LIMIT } from "@/modules/dashboard/constants";
import type { DashboardRange } from "@/modules/dashboard/schemas/metrics.schema";
import type { DashboardMetricsDto } from "@/modules/dashboard/types/metrics";
import type { DailySalesPoint } from "@/server/repositories/order.repository";
import * as orderRepository from "@/server/repositories/order.repository";
import * as productRepository from "@/server/repositories/product.repository";

/** `YYYY-MM-DD` en UTC, la misma clave que devuelve `getDailySales` (D3). */
function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Ventana del rango (D2): desde el inicio del día UTC de hace `range - 1` días
 * hasta ahora, así que `range = 7` incluye hoy y los 6 días anteriores completos.
 */
function resolveWindow(range: DashboardRange): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  from.setUTCDate(from.getUTCDate() - (range - 1));

  return { from, to };
}

/**
 * Zero-fill en el service y no en SQL (D4): un `generate_series` por consulta
 * costaría un join extra para algo que aquí es un recorrido de `range` enteros.
 */
function fillMissingDays(
  range: DashboardRange,
  from: Date,
  rows: DailySalesPoint[],
): DailySalesPoint[] {
  const byDate = new Map(rows.map((row) => [row.date, row.salesCents]));

  return Array.from({ length: range }, (_, offset) => {
    const day = new Date(from);
    day.setUTCDate(from.getUTCDate() + offset);

    const date = toDayKey(day);
    return { date, salesCents: byDate.get(date) ?? 0 };
  });
}

/**
 * Los 5 bloques en 4 consultas agregadas fijas y en paralelo: ninguna lectura
 * por fila (013, riesgo N+1). `lowStock` ignora la ventana a propósito (D5).
 */
export async function getDashboardMetrics(range: DashboardRange): Promise<DashboardMetricsDto> {
  const { from, to } = resolveWindow(range);

  const [summary, dailySales, topProducts, lowStock] = await Promise.all([
    orderRepository.getSalesSummary(from, to),
    orderRepository.getDailySales(from, to),
    orderRepository.getTopProducts(from, to, TOP_PRODUCTS_LIMIT),
    // El umbral lo pone cada producto (014 D7), no el dashboard.
    productRepository.listLowStock(LOW_STOCK_LIMIT),
  ]);

  return {
    range,
    salesCents: summary.salesCents,
    ordersCount: summary.ordersCount,
    dailySales: fillMissingDays(range, from, dailySales),
    topProducts,
    lowStock,
  };
}
