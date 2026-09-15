import { CatalogFilterFields } from "@/modules/products/components/storefront/catalog-filter-fields";
import type { StorefrontCategory } from "@/modules/products/components/storefront/category-pills";
import type { StorefrontProductFiltersState } from "@/modules/products/hooks/use-storefront-products";
import type { PublicProductsQuery } from "@/modules/products/schemas/product.schema";
import type { FacetCounts } from "@/server/repositories/product.repository";

/** Desktop: sidebar sticky (006 T6); en mobile se usa `CatalogFiltersSheet` en su lugar. */
export function CatalogSidebar({
  categories,
  facets,
  query,
  setFilters,
}: {
  categories: StorefrontCategory[];
  facets: FacetCounts;
  query: PublicProductsQuery;
  setFilters: (patch: Partial<StorefrontProductFiltersState>) => void;
}) {
  return (
    <aside className="sticky top-20 hidden h-fit w-64 shrink-0 rounded-3xl border border-border bg-card p-5 lg:block">
      <CatalogFilterFields categories={categories} facets={facets} query={query} setFilters={setFilters} />
    </aside>
  );
}
