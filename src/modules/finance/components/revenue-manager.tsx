"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RevenueByCategoryChart } from "@/modules/finance/components/revenue-by-category-chart";
import { RevenueByCategoryTable } from "@/modules/finance/components/revenue-by-category-table";
import { RevenueKpiCards } from "@/modules/finance/components/revenue-kpi-cards";
import { RevenueRangePicker } from "@/modules/finance/components/revenue-range-picker";
import { RevenueTrendChart } from "@/modules/finance/components/revenue-trend-chart";
import { useRevenue, useRevenueFilters } from "@/modules/finance/hooks/use-revenue";

function RevenueSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
      <Skeleton className="h-80 w-full" />
      <Skeleton className="h-80 w-full" />
    </div>
  );
}

export function RevenueManager() {
  const { filters, query, setPreset, setCustomRange } = useRevenueFilters();
  const { data, isLoading, error, refetch } = useRevenue(query);

  return (
    <div className="flex flex-col gap-6">
      <RevenueRangePicker filters={filters} onPresetChange={setPreset} onCustomRangeChange={setCustomRange} />

      {query === null ? (
        <p className="text-muted-foreground text-sm">Elige un rango de fechas para ver el reporte.</p>
      ) : null}

      {error ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3">
            <p className="text-destructive text-sm">No se pudo cargar el reporte: {error.message}</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? <RevenueSkeleton /> : null}

      {data ? (
        <>
          <RevenueKpiCards
            revenueCents={data.revenueCents}
            ordersCount={data.ordersCount}
            marginCents={data.marginCents}
            marginCoveragePercent={data.marginCoveragePercent}
          />

          <RevenueTrendChart data={data.dailyRevenue} />

          <RevenueByCategoryChart data={data.byCategory} />
          <RevenueByCategoryTable rows={data.byCategory} />
        </>
      ) : null}
    </div>
  );
}
