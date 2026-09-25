"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { fetchAccountingJournal } from "@/modules/finance/services/accounting.service";

export const accountingKeys = {
  all: ["finance", "accounting"] as const,
  journal: (month: string, page: number) => [...accountingKeys.all, "journal", month, page] as const,
};

/** `keepPreviousData`: al cambiar de página la tabla no parpadea a skeleton (021 D8). */
export function useAccountingJournal(month: string, page: number) {
  return useQuery({
    queryKey: accountingKeys.journal(month, page),
    queryFn: () => fetchAccountingJournal({ month, page }),
    placeholderData: keepPreviousData,
  });
}
