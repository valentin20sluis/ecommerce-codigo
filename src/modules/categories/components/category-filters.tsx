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
import type { CategoryFiltersState } from "@/modules/categories/hooks/use-categories";
import type { CategoryStatusFilter } from "@/modules/categories/schemas/category.schema";

type CategoryFiltersProps = {
  filters: CategoryFiltersState;
  onChange: (patch: Partial<CategoryFiltersState>) => void;
  onReset: () => void;
};

const SEARCH_DELAY_MS = 300;

const STATUS_LABELS: Record<CategoryStatusFilter, string> = {
  all: "Todas",
  active: "Activas",
  inactive: "Inactivas",
};

export function CategoryFilters({ filters, onChange, onReset }: CategoryFiltersProps) {
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

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category-search">Buscar</Label>
        <Input
          id="category-search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Nombre de la categoría…"
          className="w-64"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Estado</Label>
        <Select
          value={filters.status}
          onValueChange={(value) => onChange({ status: value as CategoryStatusFilter })}
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
