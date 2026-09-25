import { api } from "@/lib/axios";
import type { RevenueQuery } from "@/modules/finance/schemas/revenue.schema";
import type { UpdateTaxSettingsInput } from "@/modules/finance/schemas/taxes.schema";
import type { TaxSummaryDto } from "@/modules/finance/types/taxes";

export async function fetchTaxSummary(query: RevenueQuery): Promise<TaxSummaryDto> {
  const { data } = await api.get<TaxSummaryDto>("/admin/finance/taxes", { params: query });
  return data;
}

export async function updateTaxSettings(
  input: UpdateTaxSettingsInput,
): Promise<UpdateTaxSettingsInput> {
  const { data } = await api.patch<UpdateTaxSettingsInput>("/admin/finance/taxes/settings", input);
  return data;
}
