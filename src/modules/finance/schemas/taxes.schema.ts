import { z } from "zod";

// Imports relativos con `.ts`: el schema corre bajo `node --test` (018 D11).
import { MAX_RATE_BPS } from "../taxes.ts";
import { parseAmountToCents } from "../utils.ts";

/**
 * Body de `PATCH /api/admin/finance/taxes/settings`. Acotado 0–10000 (018 D11):
 * sin tope, un valor absurdo llegaba al `CHECK` de Postgres como un 500.
 * `strictObject` rechaza campos extra con 400 en vez de ignorarlos.
 */
export const updateTaxSettingsSchema = z.strictObject({
  incomeTaxRateBps: z.number().int().min(0).max(MAX_RATE_BPS),
});

export type UpdateTaxSettingsInput = z.infer<typeof updateTaxSettingsSchema>;

/** El formulario captura un porcentaje como texto ("29.5"); la API recibe basis points. */
export const incomeTaxRateFormSchema = z
  .object({
    rate: z
      .string()
      .trim()
      .regex(/^\d{1,3}([.,]\d{1,2})?$/, "Usa un porcentaje con hasta dos decimales."),
  })
  .superRefine((values, ctx) => {
    if (parseAmountToCents(values.rate) > MAX_RATE_BPS) {
      ctx.addIssue({ code: "custom", path: ["rate"], message: "La tasa no puede superar 100 %." });
    }
  });

export type IncomeTaxRateFormValues = z.infer<typeof incomeTaxRateFormSchema>;

/**
 * "29.5" → 2950: porcentaje × 100, la misma cuenta que pesos → centavos. Pasa
 * por el schema de la API para que un formulario válido no produzca un body inválido.
 */
export function toUpdateTaxSettingsInput(values: IncomeTaxRateFormValues): UpdateTaxSettingsInput {
  return updateTaxSettingsSchema.parse({ incomeTaxRateBps: parseAmountToCents(values.rate) });
}

/** 2950 → "29.5" para precargar el formulario. */
export function formatRateBpsAsPercent(rateBps: number): string {
  return String(rateBps / 100);
}
