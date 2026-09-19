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
import type { DashboardRange } from "@/modules/dashboard/schemas/metrics.schema";
import type { DailySalesPoint } from "@/modules/dashboard/types/metrics";

type SalesTrendChartProps = {
  data: DailySalesPoint[];
  range: DashboardRange;
};

/** `--brand` y no la rampa `--chart-*` (D10): esa rampa es gris puro y no contrasta. */
const chartConfig = {
  salesCents: { label: "Ventas", color: "var(--brand)" },
} satisfies ChartConfig;

/** El día llega como `YYYY-MM-DD` en UTC (D3): se etiqueta en UTC para no correrlo un día. */
function formatDayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

export function SalesTrendChart({ data, range }: SalesTrendChartProps) {
  const hasSales = data.some((point) => point.salesCents > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ventas por día</CardTitle>
        <CardDescription>Últimos {range} días, pedidos cobrados</CardDescription>
      </CardHeader>

      {hasSales ? (
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
              dataKey="salesCents"
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
