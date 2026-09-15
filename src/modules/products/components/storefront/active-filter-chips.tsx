"use client";

import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { StorefrontProductFiltersState } from "@/modules/products/hooks/use-storefront-products";
import type { PriceBand, PublicProductsQuery } from "@/modules/products/schemas/product.schema";
import type { StorefrontCategory } from "@/modules/products/components/storefront/category-pills";

const PRICE_BAND_LABELS: Record<PriceBand, string> = {
  lt100: "Menos de $100",
  "100to300": "$100 - $300",
  "300to700": "$300 - $700",
  gt700: "Más de $700",
};

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full bg-brand/15 pr-2 pl-3 text-xs font-medium text-foreground",
      )}
    >
      {label}
      <XIcon className="size-3.5" />
    </button>
  );
}

/** Chips removibles de filtros activos (006 T8); no incluye `sort` ni `q`. */
export function ActiveFilterChips({
  categories,
  query,
  setFilters,
}: {
  categories: StorefrontCategory[];
  query: PublicProductsQuery;
  setFilters: (patch: Partial<StorefrontProductFiltersState>) => void;
}) {
  const selectedCategories = query.categories ?? [];
  const selectedBands = query.priceBands ?? [];
  const hasChips = selectedCategories.length > 0 || selectedBands.length > 0 || Boolean(query.onSale);

  if (!hasChips) return null;

  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {selectedCategories.map((slug) => {
        const name = categories.find((c) => c.slug === slug)?.name ?? slug;
        return (
          <Chip
            key={slug}
            label={name}
            onRemove={() => {
              const next = selectedCategories.filter((c) => c !== slug);
              setFilters({ categories: next.length > 0 ? next : undefined });
            }}
          />
        );
      })}
      {selectedBands.map((band) => (
        <Chip
          key={band}
          label={PRICE_BAND_LABELS[band]}
          onRemove={() => {
            const next = selectedBands.filter((b) => b !== band);
            setFilters({ priceBands: next.length > 0 ? next : undefined });
          }}
        />
      ))}
      {query.onSale && <Chip label="Solo ofertas" onRemove={() => setFilters({ onSale: undefined })} />}
    </div>
  );
}
