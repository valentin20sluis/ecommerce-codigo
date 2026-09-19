"use client";

import { Button } from "@/components/ui/button";
import {
  DASHBOARD_RANGES,
  type DashboardRange,
} from "@/modules/dashboard/schemas/metrics.schema";

type DashboardRangeSelectorProps = {
  value: DashboardRange;
  onChange: (range: DashboardRange) => void;
};

/** Tres botones y no un calendario (D2): el rango es cerrado, así que el control también. */
export function DashboardRangeSelector({ value, onChange }: DashboardRangeSelectorProps) {
  return (
    <div
      role="group"
      aria-label="Rango de fechas de las métricas"
      className="bg-muted inline-flex items-center gap-1 rounded-lg p-1"
    >
      {DASHBOARD_RANGES.map((range) => (
        <Button
          key={range}
          size="sm"
          variant={range === value ? "default" : "ghost"}
          aria-pressed={range === value}
          onClick={() => onChange(range)}
        >
          {range} días
        </Button>
      ))}
    </div>
  );
}
