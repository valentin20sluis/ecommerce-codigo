import { z } from "zod";

export const CATEGORY_STATUS_FILTERS = ["all", "active", "inactive"] as const;

export type CategoryStatusFilter = (typeof CATEGORY_STATUS_FILTERS)[number];

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(SLUG_PATTERN, "Usa minúsculas, números y guiones simples."),
  description: z.string().max(280).nullish(),
  isActive: z.boolean().default(true),
});

// Edición parcial: cualquier campo, incluido el slug (D5).
export const updateCategorySchema = createCategorySchema.partial().extend({
  // `.partial()` no anula el `.default(true)`: sin esto, un PATCH que omite
  // `isActive` reactivaría la categoría en silencio (AC8, AC9).
  isActive: z.boolean().optional(),
});

export const categoriesQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(CATEGORY_STATUS_FILTERS).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CategoriesQuery = z.infer<typeof categoriesQuerySchema>;

/** `isActive` tiene default: lo que el formulario maneja es la entrada, no la salida. */
export type CategoryFormValues = z.input<typeof createCategorySchema>;

/** Query pública (005): sin `status` — el handler fuerza `active`. */
export const publicCategoriesQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PublicCategoriesQuery = z.infer<typeof publicCategoriesQuerySchema>;
