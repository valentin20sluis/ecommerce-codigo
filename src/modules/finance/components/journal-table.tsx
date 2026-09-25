import { Fragment } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatPriceFromCents } from "@/lib/utils";
import type { JournalEntry } from "@/modules/finance/accounting";
import { formatDateOnly } from "@/modules/finance/constants";

type JournalTableProps = {
  entries: JournalEntry[];
  page: number;
  pageSize: number;
  totalEntries: number;
  isFetching: boolean;
  onPageChange: (page: number) => void;
};

function formatCents(cents: number): string {
  return cents === 0 ? "" : formatPriceFromCents(cents);
}

export function JournalTable({
  entries,
  page,
  pageSize,
  totalEntries,
  isFetching,
  onPageChange,
}: JournalTableProps) {
  const pageCount = Math.max(Math.ceil(totalEntries / pageSize), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Libro diario</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">Esta página no tiene asientos.</p>
        ) : (
          <Table aria-label="Libro diario del mes" className={cn(isFetching && "opacity-60")}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Cuenta</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="text-right">Debe</TableHead>
                <TableHead className="text-right">Haber</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <Fragment key={entry.id}>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableCell colSpan={4} className="whitespace-normal">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground tabular-nums">{formatDateOnly(entry.date)}</span>
                        <span className="font-medium">{entry.description}</span>
                        {entry.balanced ? null : <Badge variant="destructive">No cuadra</Badge>}
                      </div>
                    </TableCell>
                  </TableRow>
                  {entry.lines.map((line, index) => (
                    <TableRow key={`${entry.id}-${index}`}>
                      <TableCell className="tabular-nums">{line.accountCode}</TableCell>
                      <TableCell className={cn(line.creditCents > 0 && "pl-8")}>{line.accountName}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCents(line.debitCents)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCents(line.creditCents)}</TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="flex items-center justify-between gap-2">
          <p className="text-muted-foreground text-sm">
            Página {page} de {pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isFetching}
              onClick={() => onPageChange(Math.min(page - 1, pageCount))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount || isFetching}
              onClick={() => onPageChange(page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
