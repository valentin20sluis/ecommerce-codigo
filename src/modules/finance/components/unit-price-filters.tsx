"use client";

import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebounce } from "@/hooks/use-debounce";
import type { UnitPriceFiltersState } from "@/modules/finance/hooks/use-unit-price";

type UnitPriceFiltersProps = {
  filters: UnitPriceFiltersState;
  onChange: (patch: Partial<UnitPriceFiltersState>) => void;
};

const SEARCH_DELAY_MS = 300;

export function UnitPriceFilters({ filters, onChange }: UnitPriceFiltersProps) {
  const applied = filters.q ?? "";

  const [term, setTerm] = useState(applied);
  const debouncedTerm = useDebounce(term, SEARCH_DELAY_MS);
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
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="unit-price-search">Buscar</Label>
      <Input
        id="unit-price-search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Nombre o SKU…"
        className="w-64"
      />
    </div>
  );
}
