"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PRICE_BANDS, type PriceBand } from "@/modules/products/schemas/product.schema";
import type { StorefrontProductFiltersState } from "@/modules/products/hooks/use-storefront-products";
import type { PublicProductsQuery } from "@/modules/products/schemas/product.schema";
import type { FacetCounts } from "@/server/repositories/product.repository";
import type { StorefrontCategory } from "@/modules/products/components/storefront/category-pills";

const PRICE_BAND_LABELS: Record<PriceBand, string> = {
  lt100: "Menos de $100",
  "100to300": "$100 - $300",
  "300to700": "$300 - $700",
  gt700: "Más de $700",
};

/**
 * Campos de filtro compartidos por el sidebar desktop y el bottom-sheet mobile
 * (006 T6/T7): un solo lugar para no duplicar la lista de checkboxes.
 */
export function CatalogFilterFields({
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
  const selectedCategories = query.categories ?? [];
  const selectedBands = query.priceBands ?? [];

  const toggleCategory = (slug: string) => {
    const next = selectedCategories.includes(slug)
      ? selectedCategories.filter((c) => c !== slug)
      : [...selectedCategories, slug];
    setFilters({ categories: next.length > 0 ? next : undefined });
  };

  const togglePriceBand = (band: PriceBand) => {
    const next = selectedBands.includes(band)
      ? selectedBands.filter((b) => b !== band)
      : [...selectedBands, band];
    setFilters({ priceBands: next.length > 0 ? next : undefined });
  };

  const hasActiveFilters =
    selectedCategories.length > 0 || selectedBands.length > 0 || Boolean(query.onSale);

  // Categorías sin productos activos no se listan: un checkbox que siempre da
  // vacío es ruido, mismo criterio que `CategoryPillsSection` del home (005).
  const visibleCategories = categories.filter(
    (category) => (facets.categories[category.slug] ?? 0) > 0 || selectedCategories.includes(category.slug),
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Filtros</span>
        {hasActiveFilters && (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={() =>
              setFilters({ categories: undefined, priceBands: undefined, onSale: undefined })
            }
          >
            Limpiar
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold text-muted-foreground">Categoría</span>
        {visibleCategories.map((category) => (
          <label key={category.slug} className="flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={selectedCategories.includes(category.slug)}
              onCheckedChange={() => toggleCategory(category.slug)}
            />
            <span className="flex-1 text-sm">{category.name}</span>
            <span className="text-xs text-muted-foreground">
              ({facets.categories[category.slug] ?? 0})
            </span>
          </label>
        ))}
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold text-muted-foreground">Precio</span>
        {PRICE_BANDS.map((band) => (
          <label key={band} className="flex cursor-pointer items-center gap-2">
            <Checkbox checked={selectedBands.includes(band)} onCheckedChange={() => togglePriceBand(band)} />
            <span className="flex-1 text-sm">{PRICE_BAND_LABELS[band]}</span>
            <span className="text-xs text-muted-foreground">({facets.priceBands[band] ?? 0})</span>
          </label>
        ))}
      </div>

      <Separator />

      <label className="flex cursor-pointer items-center justify-between gap-2">
        <Label className="text-sm font-normal">Solo ofertas</Label>
        <Checkbox
          checked={Boolean(query.onSale)}
          onCheckedChange={(checked) => setFilters({ onSale: checked ? true : undefined })}
        />
      </label>
    </div>
  );
}
