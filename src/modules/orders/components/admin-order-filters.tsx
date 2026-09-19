"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";
import { ORDER_STATUS_VIEW } from "@/modules/orders/constants";
import type { AdminOrderFiltersState } from "@/modules/orders/hooks/use-admin-orders";
import { ORDER_STATUS_VALUES } from "@/modules/orders/schemas/admin-order.schema";

type AdminOrderFiltersProps = {
  filters: AdminOrderFiltersState;
  onChange: (patch: Partial<AdminOrderFiltersState>) => void;
  onReset: () => void;
};

const SEARCH_DELAY_MS = 300;

/** El `Select` no admite `value=""`: este centinela representa «sin filtro» (D6). */
const ALL_STATUSES = "__all__";

function formatRange(from?: string, to?: string): string {
  if (!from && !to) return "Cualquier fecha";

  const start = from ? new Date(from).toLocaleDateString("es") : "…";
  const end = to ? new Date(to).toLocaleDateString("es") : "…";

  return `${start} – ${end}`;
}

/**
 * El día elegido como fin se toma completo: el calendario devuelve las 00:00, y
 * con eso un pedido de esa misma tarde quedaría fuera del rango (AC4).
 */
function toEndOfDay(date: Date): string {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return end.toISOString();
}

export function AdminOrderFilters({ filters, onChange, onReset }: AdminOrderFiltersProps) {
  const applied = filters.customer ?? "";

  const [term, setTerm] = useState(applied);
  const debouncedTerm = useDebounce(term, SEARCH_DELAY_MS);

  // Distingue lo que empujó este input de lo que cambió la URL por fuera.
  const lastPushed = useRef(applied);

  useEffect(() => {
    if (debouncedTerm === lastPushed.current) return;

    lastPushed.current = debouncedTerm;
    onChange({ customer: debouncedTerm || undefined });
  }, [debouncedTerm, onChange]);

  useEffect(() => {
    if (applied === lastPushed.current) return;

    lastPushed.current = applied;
    setTerm(applied);
  }, [applied]);

  const range = {
    from: filters.from ? new Date(filters.from) : undefined,
    to: filters.to ? new Date(filters.to) : undefined,
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label>Estado</Label>
        <Select
          value={filters.status ?? ALL_STATUSES}
          onValueChange={(value) =>
            onChange({
              status:
                value === ALL_STATUSES
                  ? undefined
                  : (value as AdminOrderFiltersState["status"]),
            })
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES}>Todos los estados</SelectItem>
            {ORDER_STATUS_VALUES.map((status) => (
              <SelectItem key={status} value={status}>
                {ORDER_STATUS_VIEW[status].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="admin-order-customer">Cliente</Label>
        <Input
          id="admin-order-customer"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Email, nombre o apellido…"
          className="w-64"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Rango de fechas</Label>
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" className="w-56 justify-start font-normal">
                <CalendarIcon className="size-4" />
                {formatRange(filters.from, filters.to)}
              </Button>
            }
          />
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="range"
              selected={range.from || range.to ? range : undefined}
              onSelect={(selected) =>
                onChange({
                  from: selected?.from?.toISOString(),
                  to: selected?.to ? toEndOfDay(selected.to) : undefined,
                })
              }
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>

      <Button variant="ghost" onClick={onReset}>
        <XIcon className="size-4" />
        Limpiar filtros
      </Button>
    </div>
  );
}
