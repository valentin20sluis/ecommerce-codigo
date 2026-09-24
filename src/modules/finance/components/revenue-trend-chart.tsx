"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatPriceFromCents } from "@/lib/utils";
import type { DailyRevenuePoint } from "@/modules/finance/utils";

type RevenueTrendChartProps = { data: DailyRevenuePoint[] };

/** `--brand` (013 D10): es la métrica protagonista del reporte. */
const chartConfig = {
  revenueCents: { label: "Ingresos", color: "var(--brand)" },
} satisfies ChartConfig;

function formatDayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

export function RevenueTrendChart({ data }: RevenueTrendChartProps) {
  const hasRevenue = data.some((point) => point.revenueCents > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingresos por día</CardTitle>
        <CardDescription>Pedidos cobrados en el rango elegido</CardDescription>
      </CardHeader>

      {hasRevenue ? (
        <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full px-2">
          <LineChart accessibilityLayer data={data} margin={{ top: 8, right: 16, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={16}
              tickFormatter={(value) => formatDayLabel(String(value))}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={72}
              tickFormatter={(value) => formatPriceFromCents(Number(value))}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(label) => formatDayLabel(String(label))}
                  formatter={(value) => formatPriceFromCents(Number(value))}
                />
              }
            />
            <Line
              dataKey="revenueCents"
              type="monotone"
              stroke="var(--brand)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ChartContainer>
      ) : (
        <p className="text-muted-foreground flex h-64 items-center justify-center text-sm">
          Sin ventas en el rango.
        </p>
      )}
    </Card>
  );
}
