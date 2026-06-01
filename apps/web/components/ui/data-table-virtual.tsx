"use client";

import { useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

interface Props<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  // Sorting
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  manualSorting?: boolean;
  // Column visibility
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>;
  // Column pinning
  columnPinning?: ColumnPinningState;
  // Virtual config
  estimateSize?: number;
  overscan?: number;
  maxHeight?: number;
  // When true, the table fills its parent (which must be a flex column with a
  // bounded height, e.g. flex-1 min-h-0) and becomes the sole vertical
  // scroller, instead of being capped at a fixed maxHeight. Preferred for
  // full-page table views so the table uses the whole viewport.
  fill?: boolean;
  // Loading / empty
  isLoading?: boolean;
  isValidating?: boolean;
  loadingSkeleton?: React.ReactNode;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  // Row
  onRowClick?: (row: TData) => void;
  getRowId?: (row: TData) => string;
  // Infinite scroll
  onLoadMore?: () => void;
  hasMore?: boolean;
  // Styling
  className?: string;
  // Focused row (keyboard nav)
  focusedRowIndex?: number;
}

export function DataTableVirtual<TData>({
  columns,
  data,
  sorting,
  onSortingChange,
  manualSorting = true,
  columnVisibility,
  onColumnVisibilityChange,
  columnPinning,
  estimateSize = 40,
  overscan = 10,
  maxHeight = 600,
  fill = false,
  isLoading,
  loadingSkeleton,
  emptyMessage = "No results found.",
  emptyIcon,
  emptyDescription,
  emptyAction,
  isValidating,
  onRowClick,
  getRowId,
  onLoadMore,
  hasMore,
  className,
  focusedRowIndex,
}: Props<TData>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

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

  const rows = table.getRowModel().rows;

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  // Reset loading guard when data changes (new items loaded)
  useEffect(() => {
    loadingRef.current = false;
  }, [data.length]);

  // Only show full skeleton on the very first load (no data yet).
  // Once data is available, keep showing it and use a subtle loading bar.
  const showSkeleton = isLoading && data.length === 0 && loadingSkeleton;
  const showLoadingBar = isValidating && data.length > 0;

  if (showSkeleton) {
    return (
      <Card className={cn("p-0 py-0 overflow-hidden", fill && "flex-1 min-h-0 flex flex-col")}>
        {loadingSkeleton}
      </Card>
    );
  }

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  return (
    <Card className={cn("p-0 py-0 overflow-hidden relative", fill && "flex-1 min-h-0 flex flex-col", className)}>
      {/* Subtle top loading bar during revalidation */}
      {showLoadingBar && (
        <div className="absolute top-0 left-0 right-0 z-20 h-0.5 overflow-hidden bg-muted">
          <div className="h-full w-1/3 animate-[shimmer_1.5s_ease-in-out_infinite] bg-accent/60 rounded-full" />
        </div>
      )}
      <div
        ref={parentRef}
        className={cn("overflow-auto", fill && "flex-1 min-h-0")}
        style={fill ? undefined : { maxHeight }}
        onScroll={() => {
          if (!onLoadMore || !hasMore || !parentRef.current) return;
          if (loadingRef.current) return;
          const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
          if (scrollHeight - scrollTop - clientHeight < 200) {
            loadingRef.current = true;
            onLoadMore();
          }
        }}
      >
        <Table className="min-w-[600px]">
          <TableHeader className="sticky top-0 z-10 bg-card">
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
                        width:
                          header.getSize() !== 150
                            ? header.getSize()
                            : undefined,
                        position: header.column.getIsPinned()
                          ? "sticky"
                          : undefined,
                        left:
                          header.column.getIsPinned() === "left"
                            ? `${header.column.getStart("left")}px`
                            : undefined,
                        zIndex: header.column.getIsPinned() ? 11 : undefined,
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
                            "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none",
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
            {rows.length === 0 ? (
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
              <>
                {/* Top spacer */}
                {virtualRows.length > 0 && virtualRows[0].start > 0 && (
                  <tr style={{ height: virtualRows[0].start }}>
                    <td colSpan={columns.length} />
                  </tr>
                )}
                {/* Virtual rows */}
                {virtualRows.map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  return (
                    <TableRow
                      key={row.id}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      className={cn(
                        onRowClick && "cursor-pointer",
                        focusedRowIndex === virtualRow.index && "bg-muted"
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
                  );
                })}
                {/* Bottom spacer */}
                {virtualRows.length > 0 && (
                  <tr
                    style={{
                      height:
                        totalSize -
                        (virtualRows[virtualRows.length - 1]?.end ?? 0),
                    }}
                  >
                    <td colSpan={columns.length} />
                  </tr>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
