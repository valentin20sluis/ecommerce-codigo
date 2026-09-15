"use client";

import Link from "next/link";

import { formatPriceFromCents } from "@/lib/utils";
import { ProductImage } from "@/modules/products/components/storefront/product-image";
import { useStorefrontProducts } from "@/modules/products/hooks/use-storefront-products";

/**
 * Sin ningún control de carrito en las filas (007 D5): así no hay forma de que un
 * click acá agregue algo al carrito, solo navega a la ficha del producto exacto.
 */
export function SearchResultsDropdown({ term, onNavigate }: { term: string; onNavigate: () => void }) {
  const query = useStorefrontProducts({
    q: term,
    categories: undefined,
    priceBands: undefined,
    sort: "newest",
    onSale: undefined,
    page: 1,
    pageSize: 5,
  });

  const results = query.data?.data ?? [];

  return (
    <div className="absolute top-full right-0 left-0 z-50 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-border bg-popover p-2 shadow-lg">
      {query.isLoading ? (
        <p className="p-4 text-center text-sm text-muted-foreground">Buscando…</p>
      ) : results.length === 0 ? (
        <p className="p-4 text-center text-sm text-muted-foreground">Sin resultados para “{term}”</p>
      ) : (
        results.map((product) => (
          <Link
            key={product.id}
            href={`/products/${product.slug}`}
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-xl p-2 hover:bg-muted"
          >
            <div className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-muted">
              {product.imageUrl && (
                <ProductImage src={product.imageUrl} alt={product.name} className="object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{product.name}</p>
              <p className="text-xs text-muted-foreground">{product.categoryName}</p>
            </div>
            <span className="shrink-0 text-sm font-semibold">{formatPriceFromCents(product.priceCents)}</span>
          </Link>
        ))
      )}
    </div>
  );
}
