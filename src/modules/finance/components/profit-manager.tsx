"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfitMonthPicker } from "@/modules/finance/components/profit-month-picker";
import { ProfitStatementTable } from "@/modules/finance/components/profit-statement-table";
import { useProfitMonth, useProfitStatement } from "@/modules/finance/hooks/use-profit";

export function ProfitManager() {
  const { month, months, setMonth } = useProfitMonth();
  const { data, isLoading, error, refetch } = useProfitStatement(month);

  const isEmpty = data !== undefined && data.grossCents === 0 && data.expensesCents === 0;

  return (
    <div className="flex flex-col gap-6">
      <ProfitMonthPicker month={month} months={months} onMonthChange={setMonth} />

      {error ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3">
            <p className="text-destructive text-sm">No se pudo cargar el estado de resultados: {error.message}</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? <Skeleton className="h-[28rem] w-full" /> : null}

      {data && isEmpty ? (
        <Card>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Este mes no hubo ventas cobradas ni egresos registrados, así que no hay resultado que
              mostrar.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {data && !isEmpty ? <ProfitStatementTable statement={data} /> : null}
    </div>
  );
}
