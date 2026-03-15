"use client";

import { useState, useMemo } from "react";
import type { SymbolState, SortingState } from "@/types";
import { DataTable } from "@/components/ui/data-table";
import { getPositionColumns } from "@/lib/columns-ui";

interface Props {
  symbols: SymbolState[];
}

export function PositionsTable({ symbols }: Props) {
  const columns = useMemo(() => getPositionColumns(), []);
  const [sorting, setSorting] = useState<SortingState[]>([]);

  return (
    <DataTable
      columns={columns}
      data={symbols}
      sorting={sorting}
      onSortingChange={setSorting}
      manualSorting={false}
      emptyMessage="No active symbols. Waiting for market data..."
      getRowId={(row) => String(row.symbolId)}
    />
  );
}
