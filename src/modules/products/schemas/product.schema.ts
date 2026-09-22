import { z } from "zod";

export const PRODUCT_STATUS_FILTERS = ["all", "active", "inactive"] as const;

export type ProductStatusFilter = (typeof PRODUCT_STATUS_FILTERS)[number];

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SKU_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,31}$/;
/** Ruta local servida desde `public/` (005 D2): sin storage, evita depender de un host externo. */
const RELATIVE_IMAGE_PATTERN = /^\/[^\s]+$/;

const imageUrlSchema = z.union([z.url(), z.string().regex(RELATIVE_IMAGE_PATTERN)]);

/** El índice único ve `""` como un valor más: dos productos sin SKU chocarían (D2, §Notas). */
const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const createProductSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(SLUG_PATTERN, "Usa minúsculas, números y guiones simples."),
  sku: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .regex(SKU_PATTERN, "Mayúsculas, números y guiones: entre 2 y 32 caracteres.")
      .optional(),
  ),
  description: z.string().max(2000).nullish(),
  categoryId: z.uuid(),
  priceCents: z.number().int().min(0),
  compareAtPriceCents: z.number().int().min(0).nullish(),
  stock: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  isActive: z.boolean().default(true),
  imageUrl: z.preprocess(emptyToUndefined, imageUrlSchema.nullish()),
});

export const updateProductSchema = createProductSchema
  .partial()
  .omit({ stock: true })
  .extend({
    // `.partial()` no anula el `.default(true)`: sin esto un PATCH que omite
    // `isActive` reactivaría el producto en silencio (verificado en 002 T21).
    isActive: z.boolean().optional(),
    // 014 AC9: el stock solo se mueve por `stock_movements`. Un PATCH que lo
    // traiga se rechaza con 400 en vez de ignorarlo en silencio.
    stock: z
      .never({ error: "El stock solo cambia desde el módulo de inventario." })
      .optional(),
  });

export const productsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(PRODUCT_STATUS_FILTERS).default("all"),
  categoryId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * El formulario no es la API: captura el precio en unidades ("1299.90") y el
 * stock como texto del input. La conversión a centavos enteros vive en T19.
 */
export const productFormSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(SLUG_PATTERN, "Usa minúsculas, números y guiones simples."),
  sku: z.union([
    z.literal(""),
    z
      .string()
      .trim()
      .regex(SKU_PATTERN, "Mayúsculas, números y guiones: entre 2 y 32 caracteres."),
  ]),
  description: z.string().max(2000),
  categoryId: z.uuid("Selecciona una categoría."),
  price: z.string().trim().regex(/^\d+([.,]\d{1,2})?$/, "Usa un número con hasta dos decimales."),
  compareAtPrice: z.union([
    z.literal(""),
    z.string().trim().regex(/^\d+([.,]\d{1,2})?$/, "Usa un número con hasta dos decimales."),
  ]),
  stock: z.string().trim().regex(/^\d+$/, "Un entero mayor o igual a cero."),
  lowStockThreshold: z.string().trim().regex(/^\d+$/, "Un entero mayor o igual a cero."),
  isActive: z.boolean(),
  imageUrl: z.union([z.literal(""), imageUrlSchema]),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductsQuery = z.infer<typeof productsQuerySchema>;

export const PRODUCT_SORT_OPTIONS = ["newest", "price_asc", "price_desc"] as const;

export type ProductSortOption = (typeof PRODUCT_SORT_OPTIONS)[number];

/** Cortes fijos en centavos (006 D2); duplicado a propósito en el repositorio, mismo patrón que `PRODUCT_STATUS_FILTERS`. */
export const PRICE_BANDS = ["lt100", "100to300", "300to700", "gt700"] as const;

export type PriceBand = (typeof PRICE_BANDS)[number];

/** "a, b,,c" -> ["a","b","c"]; ausente o vacío -> undefined (nunca []). */
function commaList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return entries.length > 0 ? entries : undefined;
}

/** Query pública (005/006): sin `status` — el handler fuerza `active`. */
export const publicProductsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  // Slugs inválidos simplemente no matchean ninguna categoría real: nunca 400 (006 API).
  categories: z
    .string()
    .trim()
    .max(400)
    .optional()
    .transform(commaList),
  // Bandas fuera de PRICE_BANDS se descartan en vez de rechazar la query entera (006 API).
  priceBands: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform(commaList)
    .transform((bands) => bands?.filter((band): band is PriceBand => PRICE_BANDS.includes(band as PriceBand)))
    .transform((bands) => (bands && bands.length > 0 ? bands : undefined)),
  sort: z.enum(PRODUCT_SORT_OPTIONS).default("newest"),
  onSale: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
});

export type PublicProductsQuery = z.infer<typeof publicProductsQuerySchema>;
