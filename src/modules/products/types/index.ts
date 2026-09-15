import type { FacetCounts } from "@/server/repositories/product.repository";
import type { Product } from "@/server/db/schema";
import type { Paginated, Serialized } from "@/types/api";

export type ProductDto = Serialized<Product>;

/** El listado llega con el nombre de la categoría ya resuelto por el join del repositorio. */
export type ProductListItemDto = ProductDto & { categoryName: string };

export type ProductListResponse = Paginated<ProductListItemDto>;

/** DTO público (005): igual que el admin, más `categorySlug` para enlazar por URL. */
export type PublicProductListItemDto = ProductDto & { categoryName: string; categorySlug: string };

/** `facets`: conteos estáticos para los checkboxes del sidebar de catálogo (006 T6). */
export type PublicProductListResponse = Paginated<PublicProductListItemDto> & { facets: FacetCounts };
