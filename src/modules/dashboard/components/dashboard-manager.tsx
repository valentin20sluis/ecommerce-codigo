"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardRangeSelector } from "@/modules/dashboard/components/dashboard-range-selector";
import { LowStockCard } from "@/modules/dashboard/components/low-stock-card";
import { MetricKpiCards } from "@/modules/dashboard/components/metric-kpi-cards";
import { SalesTrendChart } from "@/modules/dashboard/components/sales-trend-chart";
import { TopProductsChart } from "@/modules/dashboard/components/top-products-chart";
import {
  useDashboardMetrics,
  useMetricsRange,
} from "@/modules/dashboard/hooks/use-dashboard-metrics";

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
      <Skeleton className="h-80 w-full" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    </div>
  );
}

export function DashboardManager() {
  const { range, setRange } = useMetricsRange();
  const { data, isLoading, error, refetch } = useDashboardMetrics(range);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <DashboardRangeSelector value={range} onChange={setRange} />
      </div>

      {error && (
        <Card>
          <CardContent className="flex flex-col items-start gap-3">
            <p className="text-destructive text-sm">
              No se pudieron cargar las métricas: {error.message}
            </p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* `isLoading` solo es cierto sin datos en caché: el refetch de 60 s no
          devuelve la vista al skeleton (D6, AC10). */}
      {isLoading && <DashboardSkeleton />}

      {data && (
        <>
          <MetricKpiCards
            salesCents={data.salesCents}
            ordersCount={data.ordersCount}
            range={data.range}
          />

          <SalesTrendChart data={data.dailySales} range={data.range} />

          <div className="grid gap-4 lg:grid-cols-2">
            <TopProductsChart data={data.topProducts} />
            <LowStockCard products={data.lowStock} />
          </div>
        </>
      )}
    </div>
  );
}
