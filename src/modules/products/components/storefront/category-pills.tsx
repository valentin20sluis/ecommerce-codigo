"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { ProductGrid } from "@/modules/products/components/storefront/product-grid";
import type { StorefrontProduct } from "@/modules/products/components/storefront/product-card";

export type StorefrontCategory = { slug: string; name: string };

/**
 * Chips de categoría + grilla, filtrados client-side sobre los productos que ya
 * trajo el Server Component del home (005 D-implicit): sin ir a la URL ni a la API,
 * a diferencia de la futura página `/products` (filtros persistentes por URL).
 */
export function CategoryPillsSection({
  categories,
  products,
}: {
  categories: StorefrontCategory[];
  products: StorefrontProduct[];
}) {
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  const visibleCategories = useMemo(
    () => categories.filter((category) => products.some((p) => p.categorySlug === category.slug)),
    [categories, products],
  );

  const filteredProducts = useMemo(
    () => (activeSlug ? products.filter((product) => product.categorySlug === activeSlug) : products),
    [activeSlug, products],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveSlug(null)}
          className={cn(
            "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition",
            activeSlug === null
              ? "border-brand bg-brand text-brand-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          Todos
        </button>
        {visibleCategories.map((category) => (
          <button
            key={category.slug}
            type="button"
            onClick={() => setActiveSlug(category.slug)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition",
              activeSlug === category.slug
                ? "border-brand bg-brand text-brand-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {category.name}
          </button>
        ))}
      </div>

      <ProductGrid products={filteredProducts} />
    </div>
  );
}
