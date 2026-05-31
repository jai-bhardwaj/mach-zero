"use client";

import { useMemo, useCallback } from "react";
import type { RiskEvent } from "@/types";
import type { SortingState as AppSortingState } from "@/types";
import type { SortingState, OnChangeFn, VisibilityState } from "@tanstack/react-table";
import { DataTableVirtual } from "@/components/ui/data-table-virtual";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { getRiskEventColumns } from "@/lib/columns-ui";

interface Props {
  events: RiskEvent[];
  isLoading: boolean;
  isValidating?: boolean;
  sorting: AppSortingState[];
  onSortingChange: (sorting: AppSortingState[]) => void;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>;
}

export function RiskEventsTable({
  events,
  isLoading,
  isValidating,
  sorting,
  onSortingChange,
  columnVisibility,
  onColumnVisibilityChange,
}: Props) {
  const columns = useMemo(() => getRiskEventColumns(), []);

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
      data={events}
      sorting={sorting}
      onSortingChange={handleSortingChange}
      manualSorting
      columnVisibility={columnVisibility}
      onColumnVisibilityChange={onColumnVisibilityChange}
      isLoading={isLoading}
      isValidating={isValidating}
      loadingSkeleton={<TableSkeleton columns={4} rows={10} />}
      emptyMessage="No risk events found."
      emptyDescription="No risk limit breaches detected in this time period."
      estimateSize={40}
      overscan={15}
      fill
    />
  );
}
