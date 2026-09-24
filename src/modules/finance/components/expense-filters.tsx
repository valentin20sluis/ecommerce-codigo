"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RevenueRangePicker } from "@/modules/finance/components/revenue-range-picker";
import { EXPENSE_CATEGORY_LABEL } from "@/modules/finance/constants";
import {
  EXPENSE_CATEGORY_VALUES,
  type ExpenseCategoryValue,
  type ExpenseFilters,
} from "@/modules/finance/schemas/expense.schema";
import type { RevenueFilterPreset } from "@/modules/finance/schemas/revenue.schema";

type ExpenseFiltersProps = {
  filters: ExpenseFilters;
  onPresetChange: (preset: RevenueFilterPreset) => void;
  onCustomRangeChange: (range: { from?: string; to?: string }) => void;
  onCategoryChange: (category: ExpenseCategoryValue | undefined) => void;
};

const ALL = "all";

export function ExpenseFiltersBar({
  filters,
  onPresetChange,
  onCustomRangeChange,
  onCategoryChange,
}: ExpenseFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <RevenueRangePicker
        filters={filters}
        onPresetChange={onPresetChange}
        onCustomRangeChange={onCustomRangeChange}
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expense-category-filter">Categoría</Label>
        <Select
          value={filters.category ?? ALL}
          onValueChange={(value) =>
            onCategoryChange(value === ALL ? undefined : (value as ExpenseCategoryValue))
          }
        >
          <SelectTrigger id="expense-category-filter" className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            {EXPENSE_CATEGORY_VALUES.map((category) => (
              <SelectItem key={category} value={category}>
                {EXPENSE_CATEGORY_LABEL[category]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
