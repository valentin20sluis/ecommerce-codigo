import { z } from "zod";

export const unitPriceQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type UnitPriceQuery = z.infer<typeof unitPriceQuerySchema>;

/** `costCents: null` es una entrada válida (015 D1/D3): borra el costo cargado. */
export const updateCostSchema = z.object({
  costCents: z.number().int().min(0).nullable(),
});

export type UpdateCostInput = z.infer<typeof updateCostSchema>;

/** El formulario no es la API: captura el costo como texto ("19.99"); "" = sin costo. */
export const costFormSchema = z.object({
  cost: z.union([
    z.literal(""),
    z.string().trim().regex(/^\d+([.,]\d{1,2})?$/, "Usa un número con hasta dos decimales."),
  ]),
});

export type CostFormValues = z.infer<typeof costFormSchema>;

/**
 * "19.99" → 1999, misma fórmula que `toCents` de `@/lib/utils`, reimplementada
 * aquí a propósito: `node --test` no resuelve imports de **valor** con alias
 * `@/` (solo los `import type`, que se eliminan al compilar), y este archivo
 * necesita cargar bajo el test runner nativo — mismo criterio de
 * `inventory.schema.ts`, que tampoco importa valores de otros módulos.
 */
function parseCostToCents(value: string): number {
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : Number.NaN;
}

/**
 * Traduce el formulario al contrato de la API con el mismo schema que usará el
 * Route Handler: un formulario válido no puede producir un body inválido,
 * mismo criterio que `toStockMovementInput` (014).
 */
export function toUpdateCostInput(values: CostFormValues): UpdateCostInput {
  if (values.cost === "") return updateCostSchema.parse({ costCents: null });
  return updateCostSchema.parse({ costCents: parseCostToCents(values.cost) });
}
