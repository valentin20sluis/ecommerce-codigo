"use client";

import { useState } from "react";
import { SearchXIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useStorefrontCategories } from "@/modules/categories/hooks/use-storefront-categories";
import { ActiveFilterChips } from "@/modules/products/components/storefront/active-filter-chips";
import { CatalogFiltersSheet } from "@/modules/products/components/storefront/catalog-filters-sheet";
import { CatalogPager } from "@/modules/products/components/storefront/catalog-pager";
import { CatalogSidebar } from "@/modules/products/components/storefront/catalog-sidebar";
import { CatalogToolbar } from "@/modules/products/components/storefront/catalog-toolbar";
import { ProductGrid, ProductGridSkeleton } from "@/modules/products/components/storefront/product-grid";
import {
  useStorefrontProductFilters,
  useStorefrontProducts,
} from "@/modules/products/hooks/use-storefront-products";

const EMPTY_FACETS = { categories: {}, priceBands: { lt100: 0, "100to300": 0, "300to700": 0, gt700: 0 } };

export function CatalogManager() {
  const { query, setFilters, setPage } = useStorefrontProductFilters();
  const products = useStorefrontProducts(query);
  const categoriesQuery = useStorefrontCategories({ page: 1, pageSize: 50 });
  const [view, setView] = useState<"grid" | "list">("grid");

  const categories = categoriesQuery.data?.data ?? [];
  const facets = products.data?.facets ?? EMPTY_FACETS;
  const items = products.data?.data ?? [];
  const total = products.data?.meta.total ?? 0;
  const hasActiveFilters =
    (query.categories?.length ?? 0) > 0 || (query.priceBands?.length ?? 0) > 0 || Boolean(query.onSale);

  return (
    <div className="mx-auto flex w-full max-w-6xl gap-8 px-4 py-8 sm:px-6">
      <CatalogSidebar categories={categories} facets={facets} query={query} setFilters={setFilters} />

      <div className="min-w-0 flex-1">
        <div className="mb-4 lg:hidden">
          <CatalogFiltersSheet
            categories={categories}
            facets={facets}
            query={query}
            setFilters={setFilters}
            resultCount={total}
          />
        </div>

        <CatalogToolbar
          resultCount={total}
          query={query}
          setFilters={setFilters}
          view={view}
          onViewChange={setView}
        />

        <ActiveFilterChips categories={categories} query={query} setFilters={setFilters} />

        {products.isLoading ? (
          <ProductGridSkeleton count={query.pageSize} />
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border py-20 text-center">
            <SearchXIcon className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No encontramos productos con estos filtros</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Probá quitar alguno de los filtros activos.
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters({ categories: undefined, priceBands: undefined, onSale: undefined })}
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        ) : (
          <ProductGrid products={items} view={view} />
        )}

        <CatalogPager page={query.page} pageSize={query.pageSize} total={total} onPageChange={setPage} />
      </div>
    </div>
  );
}
