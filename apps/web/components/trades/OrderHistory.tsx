"use client";

import { useMemo, useCallback } from "react";
import type { Order } from "@/types";
import type { SortingState as AppSortingState } from "@/types";
import type { SortingState, OnChangeFn, VisibilityState } from "@tanstack/react-table";
import { DataTableVirtual } from "@/components/ui/data-table-virtual";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { getOrderColumns } from "@/lib/columns-ui";

interface Props {
  orders: Order[];
  isLoading: boolean;
  isValidating?: boolean;
  sorting: AppSortingState[];
  onSortingChange: (sorting: AppSortingState[]) => void;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>;
}

export function OrderHistory({
  orders,
  isLoading,
  isValidating,
  sorting,
  onSortingChange,
  columnVisibility,
  onColumnVisibilityChange,
}: Props) {
  const columns = useMemo(() => getOrderColumns(), []);

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
      data={orders}
      sorting={sorting}
      onSortingChange={handleSortingChange}
      manualSorting
      columnVisibility={columnVisibility}
      onColumnVisibilityChange={onColumnVisibilityChange}
      isLoading={isLoading}
      isValidating={isValidating}
      loadingSkeleton={<TableSkeleton columns={7} rows={10} />}
      emptyMessage="No orders found."
      emptyDescription="Try adjusting your filters or date range."
      estimateSize={40}
      overscan={15}
      maxHeight={600}
    />
  );
}
