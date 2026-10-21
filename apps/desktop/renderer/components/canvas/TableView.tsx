import React, { useState, useMemo } from "react";
import type { TableProps } from "@ego/ui-runtime";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { CaretUp, CaretDown, ArrowsDownUp } from "@phosphor-icons/react";
import { Badge } from "../ui-kit/Badge.js";
import { Button } from "../ui-kit/Button.js";

interface TableViewProps {
  props: TableProps;
  onAction?: (actionId: string, payload?: Record<string, unknown>) => void;
}

/**
 * Traduce el `variant` declarativo del contrato (`@ego/ui-runtime`) al
 * `variant` del `Button` del kit (única fuente de estilos de botón).
 */
function actionVariant(
  variant: "default" | "primary" | "danger" | "outline"
): "primary" | "secondary" | "danger" {
  if (variant === "primary") return "primary";
  if (variant === "danger") return "danger";
  return "secondary";
}

export const TableView: React.FC<TableViewProps> = ({ props, onAction }) => {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    return props.columns.map((col) => ({
      id: col.key,
      accessorFn: (row) => row[col.key],
      header: col.label,
      enableSorting: !!col.sortable,
      cell: ({ getValue }) => {
        const val = getValue();
        if (col.type === "badge") {
          return <Badge tone="info">{String(val ?? "")}</Badge>;
        }
        if (col.type === "boolean") {
          return (
            <span className={val ? "text-success" : "text-dim"}>
              {val ? "✓ Sí" : "✗ No"}
            </span>
          );
        }
        return <span>{val !== undefined && val !== null ? String(val) : "—"}</span>;
      },
    }));
  }, [props.columns]);

  const table = useReactTable({
    data: props.rows,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: props.pagination ? getPaginationRowModel() : undefined,
    initialState: {
      pagination: {
        pageSize: props.pagination?.pageSize || 10,
        pageIndex: (props.pagination?.currentPage || 1) - 1,
      },
    },
  });

  return (
    <div className="rounded-[var(--radius-card)] border border-hairline bg-panel p-4 shadow-[var(--ego-elevation-l1)] select-text">
      {/* Cabecera de la tabla */}
      <div className="mb-3 flex items-center justify-between border-b border-hairline pb-3">
        <h3 className="text-sm font-semibold text-ink">{props.title || "Datos Estructurados"}</h3>
        {props.actions && props.actions.length > 0 && (
          <div className="flex items-center gap-2">
            {props.actions.map((act) => (
              <Button
                key={act.actionId}
                variant={actionVariant(act.variant)}
                size="sm"
                onClick={() => onAction?.(act.actionId, { tableId: props.id })}
              >
                {act.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Tabla responsiva generada vía TanStack Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-hairline text-dim">
                {headerGroup.headers.map((header) => {
                  const isSortable = header.column.getCanSort();
                  const sortDirection = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={`px-3 py-2 font-medium ${
                        isSortable ? "cursor-pointer select-none hover:text-ink" : ""
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                        {isSortable && (
                          <span className="text-xs">
                            {sortDirection === "asc" ? (
                              <CaretUp size={11} />
                            ) : sortDirection === "desc" ? (
                              <CaretDown size={11} />
                            ) : (
                              <ArrowsDownUp size={11} className="text-faint" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-hairline">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={props.columns.length} className="py-6 text-center text-faint">
                  Sin registros disponibles
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-raised">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2.5 font-mono">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginador TanStack */}
      {props.pagination && (
        <div className="mt-3 flex items-center justify-between border-t border-hairline pt-3 text-xs text-dim">
          <span>
            Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()} (
            {table.getFilteredRowModel().rows.length} elementos)
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              Anterior
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
