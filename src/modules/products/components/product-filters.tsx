"use client";

import { useEffect, useRef, useState } from "react";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";
import { useCategories } from "@/modules/categories/hooks/use-categories";
import type { ProductFiltersState } from "@/modules/products/hooks/use-products";
import type { ProductStatusFilter } from "@/modules/products/schemas/product.schema";

type ProductFiltersProps = {
  filters: ProductFiltersState;
  onChange: (patch: Partial<ProductFiltersState>) => void;
  onReset: () => void;
};

const SEARCH_DELAY_MS = 300;

/** El `Select` de Radix no admite `value=""`: este centinela representa «sin filtro». */
const ALL_CATEGORIES = "all";

const STATUS_LABELS: Record<ProductStatusFilter, string> = {
  all: "Todos",
  active: "Activos",
  inactive: "Inactivos",
};

export function ProductFilters({ filters, onChange, onReset }: ProductFiltersProps) {
  const applied = filters.q ?? "";

  const [term, setTerm] = useState(applied);
  const debouncedTerm = useDebounce(term, SEARCH_DELAY_MS);

  // Distingue lo que empujó este input de lo que cambió la URL por fuera.
  const lastPushed = useRef(applied);

  useEffect(() => {
    if (debouncedTerm === lastPushed.current) return;

    lastPushed.current = debouncedTerm;
    onChange({ q: debouncedTerm || undefined });
  }, [debouncedTerm, onChange]);

  useEffect(() => {
    if (applied === lastPushed.current) return;

    lastPushed.current = applied;
    setTerm(applied);
  }, [applied]);

  // Solo categorías activas: son las asignables desde el formulario (AC3).
  const categories = useCategories({ status: "active", page: 1, pageSize: 100 });

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-search">Buscar</Label>
        <Input
          id="product-search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Nombre o SKU…"
          className="w-64"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Categoría</Label>
        <Select
          value={filters.categoryId ?? ALL_CATEGORIES}
          onValueChange={(value) =>
            onChange({ categoryId: value && value !== ALL_CATEGORIES ? value : undefined })
          }
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CATEGORIES}>Todas</SelectItem>
            {(categories.data?.data ?? []).map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {categories.error ? (
          <p role="alert" className="text-destructive text-xs">
            No se pudieron cargar las categorías.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Estado</Label>
        <Select
          value={filters.status}
          onValueChange={(value) => onChange({ status: value as ProductStatusFilter })}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button variant="ghost" onClick={onReset}>
        <XIcon className="size-4" />
        Limpiar
      </Button>
    </div>
  );
}
