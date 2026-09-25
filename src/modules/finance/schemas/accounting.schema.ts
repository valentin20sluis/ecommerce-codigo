import { z } from "zod";

// Import relativo con `.ts`: el schema corre bajo `node --test` (018 D11).
import { profitQuerySchema } from "./profit.schema.ts";

/**
 * Entrada de `GET /api/admin/finance/accounting` (021 D8): el mes de 020 más la
 * página. El tamaño de página no se acepta: es fijo en servidor (D6).
 */
export const accountingQuerySchema = profitQuerySchema.extend({
  page: z.coerce.number().int().min(1).default(1),
});

export type AccountingQuery = z.infer<typeof accountingQuerySchema>;
