"use client";

import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { OrderFilterPeriod, OrderFilters } from "@/modules/orders/schemas/order.schema";

type OrderHistoryFiltersProps = {
  filters: OrderFilters;
  onPeriodChange: (period: OrderFilterPeriod) => void;
  onRangeChange: (range: { from?: string; to?: string }) => void;
};

function formatRange(from?: string, to?: string): string {
  if (!from && !to) return "Elegí un rango";

  const start = from ? new Date(from).toLocaleDateString("es") : "…";
  const end = to ? new Date(to).toLocaleDateString("es") : "…";

  return `${start} – ${end}`;
}

/**
 * El día elegido como fin se toma completo: el calendario devuelve las 00:00, y
 * con eso una compra de esa misma tarde quedaría fuera del rango.
 */
function toEndOfDay(date: Date): string {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return end.toISOString();
}

export function OrderHistoryFilters({
  filters,
  onPeriodChange,
  onRangeChange,
}: OrderHistoryFiltersProps) {
  const isCustom = filters.period === "custom";

  const range = {
    from: filters.from ? new Date(filters.from) : undefined,
    to: filters.to ? new Date(filters.to) : undefined,
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant={isCustom ? "outline" : "default"}
        onClick={() => onPeriodChange("month")}
        aria-pressed={!isCustom}
      >
        Mes actual
      </Button>

      <Button
        variant={isCustom ? "default" : "outline"}
        onClick={() => onPeriodChange("custom")}
        aria-pressed={isCustom}
      >
        Rango
      </Button>

      {isCustom ? (
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
                onRangeChange({
                  from: selected?.from?.toISOString(),
                  to: selected?.to ? toEndOfDay(selected.to) : undefined,
                })
              }
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
