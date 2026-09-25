import { z } from "zod";

// Import relativo con `.ts`: el schema corre bajo `node --test` (018 D11).
import { currentUtcMonth } from "../profit.ts";

/** `YYYY-MM` desde 2000, mes 01–12 con dos dígitos (020 D5). */
const MONTH_PATTERN = /^20\d{2}-(0[1-9]|1[0-2])$/;

/**
 * Entrada de `GET /api/admin/finance/profit` (020 D5). La comparación de
 * `YYYY-MM` como texto es cronológica; el mes actual se evalúa en cada parse
 * para no congelarlo al cargar el módulo.
 */
export const profitQuerySchema = z.object({
  month: z
    .string()
    .regex(MONTH_PATTERN, "El mes debe tener el formato AAAA-MM.")
    .refine((month) => month <= currentUtcMonth(new Date()), {
      message: "El mes no puede ser posterior al mes actual.",
    }),
});

export type ProfitQuery = z.infer<typeof profitQuerySchema>;
