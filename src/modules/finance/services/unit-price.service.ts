import { api } from "@/lib/axios";
import type { UnitPriceQuery, UpdateCostInput } from "@/modules/finance/schemas/unit-price.schema";
import type { UnitPriceListResponse, UnitPriceRowDto } from "@/modules/finance/types/finance";

export async function fetchUnitPrices(query: UnitPriceQuery): Promise<UnitPriceListResponse> {
  const { data } = await api.get<UnitPriceListResponse>("/admin/finance/unit-price", {
    params: query,
  });

  return data;
}

export async function updateUnitPriceCost(
  productId: string,
  input: UpdateCostInput,
): Promise<UnitPriceRowDto> {
  const { data } = await api.patch<UnitPriceRowDto>(
    `/admin/finance/unit-price/${productId}`,
    input,
  );

  return data;
}
