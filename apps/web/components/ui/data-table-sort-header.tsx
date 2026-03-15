"use client";

import { type Column } from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
  className?: string;
}

export function DataTableSortHeader<TData, TValue>({
  column,
  title,
  className,
}: Props<TData, TValue>) {
  if (!column.getCanSort()) {
    return (
      <span className={cn("text-xs uppercase tracking-wider", className)}>
        {title}
      </span>
    );
  }

  const sorted = column.getIsSorted();

  return (
    <Button
      variant="ghost"
      size="xs"
      className={cn(
        "-ml-2 h-7 gap-1 font-medium text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground",
        className
      )}
      onClick={() => {
        if (!sorted) {
          // unsorted -> ASC
          column.toggleSorting(false);
        } else if (sorted === "asc") {
          // ASC -> DESC
          column.toggleSorting(true);
        } else {
          // DESC -> unsorted
          column.clearSorting();
        }
      }}
    >
      {title}
      {sorted === "asc" ? (
        <ArrowUp className="size-3 text-foreground" />
      ) : sorted === "desc" ? (
        <ArrowDown className="size-3 text-foreground" />
      ) : (
        <ArrowUpDown className="size-3 text-muted-foreground/50" />
      )}
    </Button>
  );
}
