"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type OnChangeFn,
  type VisibilityState,
  type ColumnPinningState,
} from "@tanstack/react-table";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

interface Props<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  manualSorting?: boolean;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>;
  columnPinning?: ColumnPinningState;
  isLoading?: boolean;
  isValidating?: boolean;
  loadingSkeleton?: React.ReactNode;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  className?: string;
  onRowClick?: (row: TData) => void;
  getRowId?: (row: TData) => string;
  focusedRowIndex?: number;
}

export function DataTable<TData>({
  columns,
  data,
  sorting,
  onSortingChange,
  manualSorting = true,
  columnVisibility,
  onColumnVisibilityChange,
  columnPinning,
  isLoading,
  isValidating,
  loadingSkeleton,
  emptyMessage = "No results found.",
  emptyIcon,
  emptyDescription,
  emptyAction,
  className,
  onRowClick,
  getRowId,
  focusedRowIndex,
}: Props<TData>) {
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting: sorting ?? [],
      columnVisibility: columnVisibility ?? {},
      columnPinning: columnPinning ?? {},
    },
    onSortingChange,
    onColumnVisibilityChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    manualSorting,
    manualFiltering: true,
    manualPagination: true,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    getRowId,
  });

  // Only show full skeleton on the very first load (no data yet).
  const showSkeleton = isLoading && data.length === 0 && loadingSkeleton;
  const showLoadingBar = isValidating && data.length > 0;

  if (showSkeleton) {
    return <div className="overflow-hidden rounded-lg border border-border/50">{loadingSkeleton}</div>;
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border/50 relative", className)}>
      {/* Subtle top loading bar during revalidation */}
      {showLoadingBar && (
        <div className="absolute top-0 left-0 right-0 z-20 h-0.5 overflow-hidden bg-muted">
          <div className="h-full w-1/3 animate-[shimmer_1.5s_ease-in-out_infinite] bg-accent/60 rounded-full" />
        </div>
      )}
      <div className="overflow-x-auto">
        <Table className="min-w-[600px]">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta as
                    | Record<string, unknown>
                    | undefined;
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "text-xs uppercase tracking-wider text-muted-foreground relative",
                        meta?.align === "right" && "text-right"
                      )}
                      aria-sort={
                        header.column.getIsSorted() === "asc"
                          ? "ascending"
                          : header.column.getIsSorted() === "desc"
                            ? "descending"
                            : undefined
                      }
                      style={{
                        width: header.getSize() !== 150 ? header.getSize() : undefined,
                        position: header.column.getIsPinned() ? "sticky" : undefined,
                        left:
                          header.column.getIsPinned() === "left"
                            ? `${header.column.getStart("left")}px`
                            : undefined,
                        zIndex: header.column.getIsPinned() ? 1 : undefined,
                        background: header.column.getIsPinned()
                          ? "var(--color-card)"
                          : undefined,
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={cn(
                            "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none transition-colors duration-100",
                            header.column.getIsResizing()
                              ? "bg-accent"
                              : "bg-transparent hover:bg-border"
                          )}
                        />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="p-0">
                  <EmptyState
                    icon={emptyIcon}
                    title={emptyMessage}
                    description={emptyDescription}
                    action={emptyAction}
                  />
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row, rowIndex) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    "transition-colors duration-100",
                    onRowClick && "cursor-pointer hover:bg-muted/50 active:bg-muted/70",
                    focusedRowIndex === rowIndex && "bg-muted"
                  )}
                  onClick={() => onRowClick?.(row.original)}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRowClick(row.original);
                          }
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? "button" : undefined}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as
                      | Record<string, unknown>
                      | undefined;
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          meta?.align === "right" && "text-right"
                        )}
                        style={{
                          position: cell.column.getIsPinned()
                            ? "sticky"
                            : undefined,
                          left:
                            cell.column.getIsPinned() === "left"
                              ? `${cell.column.getStart("left")}px`
                              : undefined,
                          zIndex: cell.column.getIsPinned() ? 1 : undefined,
                          background: cell.column.getIsPinned()
                            ? "var(--color-card)"
                            : undefined,
                        }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
