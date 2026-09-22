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
import { INVENTORY_FILTER_LABEL } from "@/modules/inventory/constants";
import type { InventoryFiltersState } from "@/modules/inventory/hooks/use-inventory";
import {
  INVENTORY_FILTER_VALUES,
  type InventoryFilterValue,
} from "@/modules/inventory/schemas/inventory.schema";

type InventoryFiltersProps = {
  filters: InventoryFiltersState;
  onChange: (patch: Partial<InventoryFiltersState>) => void;
  onReset: () => void;
};

const SEARCH_DELAY_MS = 300;

export function InventoryFilters({ filters, onChange, onReset }: InventoryFiltersProps) {
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
        <Label htmlFor="inventory-search">Buscar</Label>
        <Input
          id="inventory-search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Nombre o SKU…"
          className="w-64"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Alerta</Label>
        <Select
          value={filters.filter}
          onValueChange={(value) => onChange({ filter: value as InventoryFilterValue })}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INVENTORY_FILTER_VALUES.map((filter) => (
              <SelectItem key={filter} value={filter}>
                {INVENTORY_FILTER_LABEL[filter]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button variant="ghost" onClick={onReset}>
        <XIcon className="size-4" />
        Limpiar filtros
      </Button>
    </div>
  );
}
