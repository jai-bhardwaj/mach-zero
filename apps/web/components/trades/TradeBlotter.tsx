"use client";

import { useMemo, useCallback } from "react";
import type { Trade } from "@/types";
import type { SortingState as AppSortingState } from "@/types";
import type { SortingState, OnChangeFn, VisibilityState } from "@tanstack/react-table";
import { DataTableVirtual } from "@/components/ui/data-table-virtual";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { getTradeColumns } from "@/lib/columns-ui";

interface Props {
  trades: Trade[];
  isLoading: boolean;
  isValidating?: boolean;
  sorting: AppSortingState[];
  onSortingChange: (sorting: AppSortingState[]) => void;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>;
  onRowClick?: (trade: Trade) => void;
  focusedRowIndex?: number;
}

export function TradeBlotter({
  trades,
  isLoading,
  isValidating,
  sorting,
  onSortingChange,
  columnVisibility,
  onColumnVisibilityChange,
  onRowClick,
  focusedRowIndex,
}: Props) {
  const columns = useMemo(() => getTradeColumns(), []);

  const handleSortingChange: OnChangeFn<SortingState> = useCallback(
    (updaterOrValue) => {
      const next =
        typeof updaterOrValue === "function"
          ? updaterOrValue(sorting)
          : updaterOrValue;
      onSortingChange(next);
    },
    [sorting, onSortingChange]
  );

  return (
    <DataTableVirtual
      columns={columns}
      data={trades}
      sorting={sorting}
      onSortingChange={handleSortingChange}
      manualSorting
      columnVisibility={columnVisibility}
      onColumnVisibilityChange={onColumnVisibilityChange}
      isLoading={isLoading}
      isValidating={isValidating}
      loadingSkeleton={<TableSkeleton columns={8} rows={10} />}
      emptyMessage="No trades yet"
      emptyDescription="Once your strategies execute in your accounts, those trades appear here."
      onRowClick={onRowClick}
      focusedRowIndex={focusedRowIndex}
      estimateSize={40}
      overscan={15}
      maxHeight={600}
    />
  );
}
