"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { JournalSummary } from "@/modules/finance/components/journal-summary";
import { JournalTable } from "@/modules/finance/components/journal-table";
import { ProfitMonthPicker } from "@/modules/finance/components/profit-month-picker";
import { useAccountingJournal } from "@/modules/finance/hooks/use-accounting";
import { useProfitMonth } from "@/modules/finance/hooks/use-profit";

export function AccountingManager() {
  const { month, months, setMonth } = useProfitMonth();

  return (
    <div className="flex flex-col gap-6">
      <ProfitMonthPicker month={month} months={months} onMonthChange={setMonth} />
      {/* `key={month}`: cambiar de mes reinicia la página a 1 (021 D8). */}
      <AccountingJournal key={month} month={month} />
    </div>
  );
}

function AccountingJournal({ month }: { month: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching, error, refetch } = useAccountingJournal(month, page);

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3">
          <p className="text-destructive text-sm">No se pudo cargar el libro diario: {error.message}</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !data) return <Skeleton className="h-[28rem] w-full" />;

  if (data.totalEntries === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Este mes no hubo ventas cobradas ni egresos registrados, así que no hay asientos que mostrar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <JournalSummary journal={data} />
      <JournalTable
        entries={data.entries}
        page={data.page}
        pageSize={data.pageSize}
        totalEntries={data.totalEntries}
        isFetching={isFetching}
        onPageChange={setPage}
      />
    </>
  );
}
