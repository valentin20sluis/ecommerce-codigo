import { z } from "zod";

/**
 * Duplicado a propósito, mismo criterio que `ORDER_STATUS_VALUES` en
 * `admin-order.schema.ts`: este archivo lo importa un componente cliente, así
 * que no puede depender de `server/db/schema`. La fuente de verdad del enum de
 * Postgres sigue siendo `STOCK_MOVEMENT_TYPES` en
 * `src/server/db/schema/stock-movement.ts`.
 */
export const STOCK_MOVEMENT_TYPE_VALUES = [
  "initial",
  "sale",
  "return",
  "adjustment",
  "waste",
  "restock",
] as const;

export type StockMovementTypeValue = (typeof STOCK_MOVEMENT_TYPE_VALUES)[number];

/** Los tres tipos que un admin puede registrar a mano; el resto los emite el servidor. */
export const MANUAL_MOVEMENT_TYPES = ["adjustment", "waste", "restock"] as const;

export type ManualMovementType = (typeof MANUAL_MOVEMENT_TYPES)[number];

export const INVENTORY_FILTER_VALUES = ["all", "low", "negative"] as const;

export type InventoryFilterValue = (typeof INVENTORY_FILTER_VALUES)[number];

export const inventoryQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  filter: z.enum(INVENTORY_FILTER_VALUES).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type InventoryQuery = z.infer<typeof inventoryQuerySchema>;

export const movementsQuerySchema = z.object({
  type: z.enum(STOCK_MOVEMENT_TYPE_VALUES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type MovementsQuery = z.infer<typeof movementsQuerySchema>;

const REASON_MIN_LENGTH = 3;

const REASON_MESSAGE = `Explica el motivo (mínimo ${REASON_MIN_LENGTH} caracteres).`;

/** Tope de cordura: nadie mueve un millón de unidades en un solo movimiento. */
const MAX_UNITS = 1_000_000;

const REASON_MAX_LENGTH = 300;

const reasonSchema = z
  .string()
  .trim()
  .min(REASON_MIN_LENGTH, REASON_MESSAGE)
  .max(REASON_MAX_LENGTH);

const qtySchema = z
  .number()
  .int()
  .positive("La cantidad debe ser un entero mayor que cero.")
  .max(MAX_UNITS, "La cantidad supera el máximo permitido.");

/**
 * La API nunca recibe signos (D1): el cliente manda el tipo y una cantidad
 * positiva —o el conteo físico— y el servicio decide el signo de `qty_delta`.
 */
export const createStockMovementSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("adjustment"),
    /** Conteo físico: el stock que el admin acaba de contar en estantería. */
    countedStock: z.number().int().min(0).max(MAX_UNITS),
    /** Stock que el admin tenía a la vista; si ya no coincide, la API responde 409 (AC2). */
    expectedStock: z.number().int().min(-MAX_UNITS).max(MAX_UNITS),
    reason: reasonSchema,
  }),
  z.object({
    type: z.literal("waste"),
    qty: qtySchema,
    reason: reasonSchema,
  }),
  z.object({
    type: z.literal("restock"),
    qty: qtySchema,
    reason: reasonSchema.optional(),
  }),
]);

export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;

/**
 * El formulario no es la API: captura las cantidades como texto del input. La
 * conversión al contrato la hace `toStockMovementInput`, mismo criterio que
 * `productFormSchema` (003).
 */
export const stockAdjustFormSchema = z
  .object({
    type: z.enum(MANUAL_MOVEMENT_TYPES),
    qty: z.string().trim(),
    countedStock: z.string().trim(),
    reason: z.string().trim().max(REASON_MAX_LENGTH, "El motivo es demasiado largo."),
  })
  .superRefine((values, ctx) => {
    const INTEGER = /^\d+$/;

    if (values.type === "adjustment") {
      const counted = Number.parseInt(values.countedStock, 10);

      if (!INTEGER.test(values.countedStock) || counted > MAX_UNITS) {
        ctx.addIssue({
          code: "custom",
          path: ["countedStock"],
          message: `Un entero entre 0 y ${MAX_UNITS}.`,
        });
      }
    } else {
      const qty = Number.parseInt(values.qty, 10);

      if (!INTEGER.test(values.qty) || qty === 0 || qty > MAX_UNITS) {
        ctx.addIssue({
          code: "custom",
          path: ["qty"],
          message: `Un entero entre 1 y ${MAX_UNITS}.`,
        });
      }
    }

    // `restock` es el único que admite motivo vacío (AC3), pero si el admin
    // escribe algo le exige el mismo mínimo: un motivo de 1–2 caracteres saldría
    // del formulario como válido y moriría luego en el `parse` del contrato.
    const reasonRequired = values.type !== "restock";

    if (
      (reasonRequired || values.reason.length > 0) &&
      values.reason.length < REASON_MIN_LENGTH
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: REASON_MESSAGE,
      });
    }
  });

export type StockAdjustFormValues = z.infer<typeof stockAdjustFormSchema>;

/**
 * Traduce el formulario al contrato de la API y lo valida con el mismo schema
 * que usará el Route Handler: un formulario válido no puede producir un body
 * inválido. `expectedStock` sale del listado, nunca de un campo editable.
 */
export function toStockMovementInput(
  values: StockAdjustFormValues,
  expectedStock: number,
): CreateStockMovementInput {
  if (values.type === "adjustment") {
    return createStockMovementSchema.parse({
      type: "adjustment",
      countedStock: Number.parseInt(values.countedStock, 10),
      expectedStock,
      reason: values.reason,
    });
  }

  return createStockMovementSchema.parse({
    type: values.type,
    qty: Number.parseInt(values.qty, 10),
    reason: values.reason.length > 0 ? values.reason : undefined,
  });
}
