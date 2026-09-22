import { api } from "@/lib/axios";
import type {
  CreateStockMovementInput,
  InventoryQuery,
  MovementsQuery,
} from "@/modules/inventory/schemas/inventory.schema";
import type {
  InventoryListResponse,
  StockMovementDto,
  StockMovementListResponse,
} from "@/modules/inventory/types/inventory";

export async function fetchInventory(query: InventoryQuery): Promise<InventoryListResponse> {
  const { data } = await api.get<InventoryListResponse>("/admin/inventory", { params: query });
  return data;
}

export async function fetchStockMovements(
  productId: string,
  query: MovementsQuery,
): Promise<StockMovementListResponse> {
  const { data } = await api.get<StockMovementListResponse>(
    `/admin/inventory/${productId}/movements`,
    { params: query },
  );

  return data;
}

export async function createStockMovement(
  productId: string,
  input: CreateStockMovementInput,
): Promise<StockMovementDto> {
  const { data } = await api.post<StockMovementDto>(
    `/admin/inventory/${productId}/movements`,
    input,
  );

  return data;
}
