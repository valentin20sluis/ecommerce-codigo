"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { RevenueQuery } from "@/modules/finance/schemas/revenue.schema";
import type { UpdateTaxSettingsInput } from "@/modules/finance/schemas/taxes.schema";
import { fetchTaxSummary, updateTaxSettings } from "@/modules/finance/services/taxes.service";

export const taxKeys = {
  all: ["finance", "taxes"] as const,
  summary: (query: RevenueQuery) => [...taxKeys.all, "summary", query] as const,
};

export function useTaxSummary(query: RevenueQuery | null) {
  return useQuery({
    queryKey: query ? taxKeys.summary(query) : taxKeys.all,
    queryFn: () => fetchTaxSummary(query as RevenueQuery),
    enabled: query !== null,
  });
}

/** La tasa entra en toda estimación: se invalidan todos los resúmenes, no solo el visible. */
export function useUpdateTaxSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateTaxSettingsInput) => updateTaxSettings(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: taxKeys.all });
    },
  });
}
