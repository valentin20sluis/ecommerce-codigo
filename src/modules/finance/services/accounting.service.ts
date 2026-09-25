import { api } from "@/lib/axios";
import type { AccountingQuery } from "@/modules/finance/schemas/accounting.schema";
import type { AccountingJournalDto } from "@/modules/finance/types/accounting";

export async function fetchAccountingJournal(query: AccountingQuery): Promise<AccountingJournalDto> {
  const { data } = await api.get<AccountingJournalDto>("/admin/finance/accounting", { params: query });
  return data;
}
