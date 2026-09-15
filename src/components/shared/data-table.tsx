"use client";

import {
  createColumnHelper,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table/flex-render";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** Sin features opcionales: la paginación y el filtrado son del servidor (D11). */
export const dataTableFeatures = tableFeatures({});

export type DataTableColumns<TData extends RowData> = ColumnDef<typeof dataTableFeatures, TData>[];

export function createDataTableColumnHelper<TData extends RowData>() {
  return createColumnHelper<typeof dataTableFeatures, TData>();
}

export type DataTablePagination = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

type DataTableProps<TData extends RowData> = {
  columns: DataTableColumns<TData>;
  data: TData[];
  isLoading?: boolean;
  errorMessage?: string | null;
  emptyMessage?: string;
  pagination?: DataTablePagination;
};

const SKELETON_ROWS = 5;

export function DataTable<TData extends RowData>({
  columns,
  data,
  isLoading = false,
  errorMessage = null,
  emptyMessage = "No hay resultados.",
  pagination,
}: DataTableProps<TData>) {
  const table = useTable({ features: dataTableFeatures, columns, data });

  const pageCount = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: SKELETON_ROWS }, (_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  {columns.map((_column, columnIndex) => (
                    <TableCell key={columnIndex}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : errorMessage ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-destructive h-24 text-center">
                  {errorMessage}
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-muted-foreground h-24 text-center"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination ? (
        <div className="flex items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">
            {pagination.total} registro(s) · página {pagination.page} de {pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1 || isLoading}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pageCount || isLoading}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
