import { computeMargin } from "@/modules/finance/utils";
import type { UnitPriceRow } from "@/server/repositories/product.repository";
import type { Paginated } from "@/types/api";

export type UnitPriceRowDto = {
  productId: string;
  name: string;
  sku: string | null;
  priceCents: number;
  costCents: number | null;
  marginCents: number | null;
  marginPercent: number | null;
};

export type UnitPriceListResponse = Paginated<UnitPriceRowDto>;

export function toUnitPriceRowDto(row: UnitPriceRow): UnitPriceRowDto {
  const { marginCents, marginPercent } = computeMargin(row.priceCents, row.costCents);

  return {
    productId: row.id,
    name: row.name,
    sku: row.sku,
    priceCents: row.priceCents,
    costCents: row.costCents,
    marginCents,
    marginPercent,
  };
}
