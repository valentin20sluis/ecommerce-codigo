"use client";

import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { RevenueFilterPreset, RevenueFilters } from "@/modules/finance/schemas/revenue.schema";
import { REVENUE_RANGE_PRESETS } from "@/modules/finance/utils";

type RevenueRangePickerProps = {
  filters: RevenueFilters;
  onPresetChange: (preset: RevenueFilterPreset) => void;
  onCustomRangeChange: (range: { from?: string; to?: string }) => void;
};

const PRESET_LABEL: Record<(typeof REVENUE_RANGE_PRESETS)[number], string> = {
  this_month: "Este mes",
  last_month: "Mes pasado",
  this_quarter: "Este trimestre",
  this_year: "Este año",
};

function formatRange(from?: string, to?: string): string {
  if (!from && !to) return "Rango libre…";

  const start = from ? new Date(from).toLocaleDateString("es") : "…";
  const end = to ? new Date(to).toLocaleDateString("es") : "…";

  return `${start} – ${end}`;
}

/**
 * El día elegido como fin se toma completo: el calendario devuelve las 00:00,
 * y con eso una venta de esa misma tarde quedaría fuera del rango — mismo
 * criterio que `order-history-filters.tsx`.
 */
function toEndOfDay(date: Date): string {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
}

export function RevenueRangePicker({ filters, onPresetChange, onCustomRangeChange }: RevenueRangePickerProps) {
  const isCustom = filters.preset === "custom";

  const range = {
    from: filters.from ? new Date(filters.from) : undefined,
    to: filters.to ? new Date(filters.to) : undefined,
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label="Rango de fechas de ingresos"
        className="bg-muted inline-flex items-center gap-1 rounded-lg p-1"
      >
        {REVENUE_RANGE_PRESETS.map((preset) => (
          <Button
            key={preset}
            size="sm"
            variant={filters.preset === preset ? "default" : "ghost"}
            aria-pressed={filters.preset === preset}
            onClick={() => onPresetChange(preset)}
          >
            {PRESET_LABEL[preset]}
          </Button>
        ))}
      </div>

      <Popover>
        <PopoverTrigger
          render={
            <Button
              size="sm"
              variant={isCustom ? "default" : "outline"}
              aria-pressed={isCustom}
              className="justify-start font-normal"
            >
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
              onCustomRangeChange({
                from: selected?.from?.toISOString(),
                to: selected?.to ? toEndOfDay(selected.to) : undefined,
              })
            }
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
