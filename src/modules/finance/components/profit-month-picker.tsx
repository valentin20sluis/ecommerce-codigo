"use client";

import { useMemo } from "react";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ProfitMonthPickerProps = {
  month: string;
  months: string[];
  onMonthChange: (month: string) => void;
};

const MONTH_LABEL = new Intl.DateTimeFormat("es-PE", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** `YYYY-MM` → "septiembre de 2026", leído en UTC como la consulta (020 D4). */
function formatMonth(month: string): string {
  const label = MONTH_LABEL.format(new Date(`${month}-01T00:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function ProfitMonthPicker({ month, months, onMonthChange }: ProfitMonthPickerProps) {
  // `items` le da a `SelectValue` la etiqueta legible en vez del `YYYY-MM` crudo.
  const items = useMemo(() => months.map((value) => ({ value, label: formatMonth(value) })), [months]);

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="profit-month">Mes</Label>
      <Select
        items={items}
        value={month}
        onValueChange={(value) => {
          if (value) onMonthChange(value);
        }}
      >
        <SelectTrigger id="profit-month" className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
