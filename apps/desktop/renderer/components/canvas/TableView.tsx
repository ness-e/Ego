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

interface TableViewProps {
  props: TableProps;
  onAction?: (actionId: string, payload?: Record<string, unknown>) => void;
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
          return (
            <span className="inline-block rounded px-1.5 py-0.5 text-[10px] uppercase font-semibold bg-raised text-dim border border-hairline">
              {String(val ?? "")}
            </span>
          );
        }
        if (col.type === "boolean") {
          return (
            <span className={val ? "text-emerald-400" : "text-zinc-500"}>
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
    <div className="rounded-xl border border-hairline bg-panel p-4 shadow-xs select-text">
      {/* Cabecera de la tabla */}
      <div className="flex items-center justify-between pb-3 border-b border-hairline mb-3">
        <h3 className="font-semibold text-sm text-ink">{props.title || "Datos Estructurados"}</h3>
        {props.actions && props.actions.length > 0 && (
          <div className="flex items-center gap-2">
            {props.actions.map((act) => (
              <button
                key={act.actionId}
                type="button"
                onClick={() => onAction?.(act.actionId, { tableId: props.id })}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  act.variant === "primary"
                    ? "bg-ink text-paper hover:opacity-90"
                    : act.variant === "danger"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30"
                    : "bg-raised text-ink hover:bg-hairline border border-hairline"
                }`}
              >
                {act.label}
              </button>
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
                      className={`py-2 px-3 font-medium ${
                        isSortable ? "cursor-pointer hover:text-ink select-none" : ""
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                        {isSortable && (
                          <span className="text-[10px]">
                            {sortDirection === "asc" ? (
                              <CaretUp size={11} />
                            ) : sortDirection === "desc" ? (
                              <CaretDown size={11} />
                            ) : (
                              <ArrowsDownUp size={11} className="opacity-40" />
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
                <tr key={row.id} className="hover:bg-raised/40 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="py-2.5 px-3 font-mono">
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
        <div className="flex items-center justify-between pt-3 border-t border-hairline mt-3 text-xs text-dim">
          <span>
            Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()} (
            {table.getFilteredRowModel().rows.length} elementos)
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
              className="rounded bg-raised px-2 py-1 text-xs disabled:opacity-40 hover:bg-hairline"
            >
              Anterior
            </button>
            <button
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
              className="rounded bg-raised px-2 py-1 text-xs disabled:opacity-40 hover:bg-hairline"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
