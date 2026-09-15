import { api } from "@/lib/axios";
import type { PublicProductsQuery } from "@/modules/products/schemas/product.schema";
import type { PublicProductListResponse } from "@/modules/products/types";

/**
 * Axios serializa un array por defecto como `categories[]=a&categories[]=b`
 * (repite la clave), pero `publicProductsQuerySchema` solo sabe leer una clave con
 * valores coma-separados (`categories=a,b`, igual que arma la URL `useStorefrontProductFilters`
 * con `String(array)`). Sin este join, `categories`/`priceBands` nunca llegan al
 * servidor con la clave esperada y el filtro no hace nada (bug reportado por el usuario).
 */
function toRequestParams(query: PublicProductsQuery): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      params[key] = value.join(",");
    } else {
      params[key] = value;
    }
  }

  return params;
}

export async function fetchPublicProducts(
  query: PublicProductsQuery,
): Promise<PublicProductListResponse> {
  const { data } = await api.get<PublicProductListResponse>("/products", {
    params: toRequestParams(query),
  });
  return data;
}
