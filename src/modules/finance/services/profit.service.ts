import { api } from "@/lib/axios";
import type { ProfitQuery } from "@/modules/finance/schemas/profit.schema";
import type { ProfitStatementDto } from "@/modules/finance/types/profit";

export async function fetchProfitStatement(query: ProfitQuery): Promise<ProfitStatementDto> {
  const { data } = await api.get<ProfitStatementDto>("/admin/finance/profit", { params: query });
  return data;
}
