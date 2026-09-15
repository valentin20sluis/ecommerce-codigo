"use client";

import { LayoutGridIcon, LayoutListIcon } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  PRODUCT_SORT_OPTIONS,
  type ProductSortOption,
  type PublicProductsQuery,
} from "@/modules/products/schemas/product.schema";
import type { StorefrontProductFiltersState } from "@/modules/products/hooks/use-storefront-products";

const SORT_LABELS: Record<ProductSortOption, string> = {
  newest: "Novedades",
  price_asc: "Precio: menor a mayor",
  price_desc: "Precio: mayor a menor",
};

export function CatalogToolbar({
  resultCount,
  query,
  setFilters,
  view,
  onViewChange,
}: {
  resultCount: number;
  query: PublicProductsQuery;
  setFilters: (patch: Partial<StorefrontProductFiltersState>) => void;
  view: "grid" | "list";
  onViewChange: (view: "grid" | "list") => void;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Catálogo completo</h1>
        <p className="text-sm text-muted-foreground">
          {resultCount} producto{resultCount === 1 ? "" : "s"} encontrado{resultCount === 1 ? "" : "s"}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Select value={query.sort} onValueChange={(value) => setFilters({ sort: value as ProductSortOption })}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRODUCT_SORT_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {SORT_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex overflow-hidden rounded-lg border border-border">
          <button
            type="button"
            aria-label="Vista de cuadrícula"
            onClick={() => onViewChange("grid")}
            className={cn(
              "flex size-9 items-center justify-center",
              view === "grid" ? "bg-muted text-brand" : "text-muted-foreground",
            )}
          >
            <LayoutGridIcon className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Vista de lista"
            onClick={() => onViewChange("list")}
            className={cn(
              "flex size-9 items-center justify-center",
              view === "list" ? "bg-muted text-brand" : "text-muted-foreground",
            )}
          >
            <LayoutListIcon className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
