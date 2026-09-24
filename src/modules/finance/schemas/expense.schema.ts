import { z } from "zod";

import { parseAmountToCents } from "../utils.ts";
import { revenueFiltersSchema } from "./revenue.schema.ts";

/**
 * Duplicado a propósito de `EXPENSE_CATEGORIES` (`server/db/schema/expense-category.ts`):
 * este archivo lo importan componentes cliente y no puede depender de
 * `server/`. La sincronía la fija en compilación `expense.service.ts`.
 */
export const EXPENSE_CATEGORY_VALUES = [
  "advertising",
  "payroll",
  "rent",
  "software",
  "shipping",
  "payment_fees",
  "taxes_fees",
  "other",
] as const;

export type ExpenseCategoryValue = (typeof EXPENSE_CATEGORY_VALUES)[number];

/** Tope de cordura: por encima del rango `int4` de Postgres el INSERT daría un 500 opaco. */
export const MAX_EXPENSE_CENTS = 99_999_999;

/** Mismo tope de rango que el reporte de ingresos (016 I3). */
export const MAX_EXPENSE_RANGE_DAYS = 1826;

const categorySchema = z.enum(EXPENSE_CATEGORY_VALUES);
const descriptionSchema = z.string().trim().min(2, "Mínimo 2 caracteres.").max(200);
const amountCentsSchema = z.number().int().min(1).max(MAX_EXPENSE_CENTS);
const dateSchema = z.iso.date("Elige una fecha válida.");

function nonEmpty(value: object): boolean {
  return Object.keys(value).length > 0;
}

export const createExpenseSchema = z.object({
  category: categorySchema,
  description: descriptionSchema,
  amountCents: amountCentsSchema,
  incurredOn: dateSchema,
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = z
  .strictObject({
    category: categorySchema.optional(),
    description: descriptionSchema.optional(),
    amountCents: amountCentsSchema.optional(),
    incurredOn: dateSchema.optional(),
  })
  .refine(nonEmpty, "No hay nada que actualizar.");

export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

export const expensesQuerySchema = z
  .object({
    from: dateSchema,
    to: dateSchema,
    category: categorySchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .superRefine((values, ctx) => {
    if (values.to < values.from) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: "El fin del rango no puede ser anterior al inicio.",
      });
      return;
    }

    const spanDays = (Date.parse(values.to) - Date.parse(values.from)) / 86_400_000;
    if (spanDays > MAX_EXPENSE_RANGE_DAYS) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: `El rango no puede superar ${MAX_EXPENSE_RANGE_DAYS} días.`,
      });
    }
  });

export type ExpensesQuery = z.infer<typeof expensesQuerySchema>;

export const createRecurringExpenseSchema = z
  .object({
    category: categorySchema,
    description: descriptionSchema,
    amountCents: amountCentsSchema,
    dayOfMonth: z.number().int().min(1).max(31),
    startsOn: dateSchema,
    endsOn: dateSchema.nullish(),
  })
  .superRefine((values, ctx) => {
    if (values.endsOn && values.endsOn < values.startsOn) {
      ctx.addIssue({
        code: "custom",
        path: ["endsOn"],
        message: "La fecha de fin no puede ser anterior a la de inicio.",
      });
    }
  });

export type CreateRecurringExpenseInput = z.infer<typeof createRecurringExpenseSchema>;

/** Sin `startsOn` (017 D7): `strictObject` lo rechaza con 400 en vez de ignorarlo en silencio. */
export const updateRecurringExpenseSchema = z
  .strictObject({
    category: categorySchema.optional(),
    description: descriptionSchema.optional(),
    amountCents: amountCentsSchema.optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    endsOn: dateSchema.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(nonEmpty, "No hay nada que actualizar.");

export type UpdateRecurringExpenseInput = z.infer<typeof updateRecurringExpenseSchema>;

/** Filtros del listado tal como viajan en la URL: rango de Ingresos + categoría + página. */
export const expenseFiltersSchema = revenueFiltersSchema.extend({
  category: categorySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export type ExpenseFilters = z.infer<typeof expenseFiltersSchema>;

const AMOUNT_PATTERN = /^\d+([.,]\d{1,2})?$/;

const amountTextSchema = z.string().trim().regex(AMOUNT_PATTERN, "Usa un número con hasta dos decimales.");

function checkAmount(amount: string, ctx: z.RefinementCtx): void {
  const cents = parseAmountToCents(amount);

  if (Number.isFinite(cents) && (cents < 1 || cents > MAX_EXPENSE_CENTS)) {
    ctx.addIssue({
      code: "custom",
      path: ["amount"],
      message: `El monto debe estar entre 0.01 y ${(MAX_EXPENSE_CENTS / 100).toFixed(2)}.`,
    });
  }
}

/** El formulario captura el monto como texto ("1500,50"); la API recibe centavos. */
export const expenseFormSchema = z
  .object({
    category: categorySchema,
    description: descriptionSchema,
    amount: amountTextSchema,
    incurredOn: dateSchema,
  })
  .superRefine((values, ctx) => checkAmount(values.amount, ctx));

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

export function toCreateExpenseInput(values: ExpenseFormValues): CreateExpenseInput {
  return createExpenseSchema.parse({
    category: values.category,
    description: values.description,
    amountCents: parseAmountToCents(values.amount),
    incurredOn: values.incurredOn,
  });
}

export const recurringFormSchema = z
  .object({
    category: categorySchema,
    description: descriptionSchema,
    amount: amountTextSchema,
    dayOfMonth: z.string().trim().regex(/^\d{1,2}$/, "Un día entre 1 y 31."),
    startsOn: dateSchema,
    endsOn: z.union([z.literal(""), dateSchema]),
    isActive: z.boolean(),
  })
  .superRefine((values, ctx) => {
    checkAmount(values.amount, ctx);

    const day = Number.parseInt(values.dayOfMonth, 10);
    if (day < 1 || day > 31) {
      ctx.addIssue({ code: "custom", path: ["dayOfMonth"], message: "Un día entre 1 y 31." });
    }

    if (values.endsOn !== "" && values.endsOn < values.startsOn) {
      ctx.addIssue({
        code: "custom",
        path: ["endsOn"],
        message: "La fecha de fin no puede ser anterior a la de inicio.",
      });
    }
  });

export type RecurringFormValues = z.infer<typeof recurringFormSchema>;

export function toCreateRecurringInput(values: RecurringFormValues): CreateRecurringExpenseInput {
  return createRecurringExpenseSchema.parse({
    category: values.category,
    description: values.description,
    amountCents: parseAmountToCents(values.amount),
    dayOfMonth: Number.parseInt(values.dayOfMonth, 10),
    startsOn: values.startsOn,
    endsOn: values.endsOn === "" ? null : values.endsOn,
  });
}

export function toUpdateRecurringInput(values: RecurringFormValues): UpdateRecurringExpenseInput {
  return updateRecurringExpenseSchema.parse({
    category: values.category,
    description: values.description,
    amountCents: parseAmountToCents(values.amount),
    dayOfMonth: Number.parseInt(values.dayOfMonth, 10),
    endsOn: values.endsOn === "" ? null : values.endsOn,
    isActive: values.isActive,
  });
}
