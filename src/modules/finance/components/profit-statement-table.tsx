import { InfoIcon, TriangleAlertIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatPriceFromCents } from "@/lib/utils";
import { formatRateBpsAsPercent } from "@/modules/finance/schemas/taxes.schema";
import { IGV_RATE_BPS } from "@/modules/finance/taxes";
import type { ProfitStatementDto } from "@/modules/finance/types/profit";

type ProfitStatementTableProps = {
  statement: ProfitStatementDto;
};

type StatementLine = {
  sign: "" | "−" | "=";
  label: string;
  explanation: string;
  cents: number;
  isResult: boolean;
};

function formatRate(rateBps: number): string {
  return `${formatRateBpsAsPercent(rateBps)} %`;
}

function buildLines(statement: ProfitStatementDto): StatementLine[] {
  return [
    {
      sign: "",
      label: "Ventas sin IGV",
      explanation: `Lo cobrado en el mes (${formatPriceFromCents(statement.grossCents)}) sin el IGV ${formatRate(IGV_RATE_BPS)}, que es del Estado y no del negocio.`,
      cents: statement.salesBaseCents,
      isResult: false,
    },
    {
      sign: "−",
      label: "Costo de lo vendido",
      explanation: "Lo que te costaron los productos que vendiste, según el costo cargado al momento de la venta.",
      cents: statement.costOfSalesCents,
      isResult: false,
    },
    {
      sign: "=",
      label: "Utilidad bruta",
      explanation: "Lo que te dejan los productos antes de pagar los gastos del negocio.",
      cents: statement.grossProfitCents,
      isResult: true,
    },
    {
      sign: "−",
      label: "Egresos",
      explanation: "Gastos del mes para operar: sueldos, alquiler, publicidad, software y demás.",
      cents: statement.expensesCents,
      isResult: false,
    },
    {
      sign: "=",
      label: "Utilidad operativa",
      explanation: "Lo que gana el negocio con su operación, antes del impuesto a la renta.",
      cents: statement.operatingProfitCents,
      isResult: true,
    },
    {
      sign: "−",
      label: `Renta estimada (${formatRate(statement.incomeTaxRateBps)})`,
      explanation: "Impuesto a la renta sobre la utilidad operativa. Si hubo pérdida, es 0.",
      cents: statement.incomeTaxCents,
      isResult: false,
    },
    {
      sign: "=",
      label: "Utilidad neta",
      explanation: "Lo que realmente queda para el negocio después de todo.",
      cents: statement.netProfitCents,
      isResult: true,
    },
  ];
}

export function ProfitStatementTable({ statement }: ProfitStatementTableProps) {
  const lines = buildLines(statement);
  const showCoverageWarning = statement.grossCents > 0 && statement.costCoveragePercent < 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estado de resultados</CardTitle>
        <CardDescription className="flex items-center gap-1.5">
          <InfoIcon className="size-4 shrink-0" />
          Estimación de gestión, no es una declaración tributaria.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-6" aria-label="Operación" />
              <TableHead>Concepto</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.label} className={cn(line.isResult && "bg-muted/50")}>
                <TableCell className="text-muted-foreground text-center align-top" aria-hidden="true">
                  {line.sign}
                </TableCell>
                <TableCell className="whitespace-normal">
                  <div className={cn(line.isResult && "font-semibold")}>{line.label}</div>
                  <p className="text-muted-foreground text-xs">{line.explanation}</p>
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right align-top tabular-nums",
                    line.isResult && "font-semibold",
                    line.isResult && line.cents < 0 && "text-destructive",
                  )}
                >
                  {formatPriceFromCents(line.cents)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <p className="text-muted-foreground text-xs">
          {statement.costCoveragePercent}% de las ventas tienen costo conocido.
        </p>

        {showCoverageWarning ? (
          <div
            role="alert"
            className="border-destructive/40 text-destructive flex items-start gap-2 rounded-md border p-3 text-sm"
          >
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
            <p>
              Hay ventas de productos sin costo cargado: cuentan como costo 0, así que la utilidad está
              sobreestimada. Carga el costo en Precio unitario para afinarla.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
