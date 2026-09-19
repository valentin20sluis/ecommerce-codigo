import { z } from "zod";

/**
 * Los tres rangos del dashboard (013 D2). Sin calendario libre: una ventana
 * cerrada mantiene las agregaciones acotadas y el selector en 3 botones.
 */
export const DASHBOARD_RANGES = [7, 30, 90] as const;

export type DashboardRange = (typeof DASHBOARD_RANGES)[number];

export const DEFAULT_DASHBOARD_RANGE: DashboardRange = 7;

/** El `pipe` es obligatorio: `range` llega como string en la query y el literal no coacciona. */
export const metricsQuerySchema = z.object({
  range: z.coerce
    .number()
    .int()
    .pipe(z.literal(DASHBOARD_RANGES))
    .default(DEFAULT_DASHBOARD_RANGE),
});

export type MetricsQuery = z.infer<typeof metricsQuerySchema>;
