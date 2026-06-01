"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  total: number;
  offset: number;
  limit: number;
  onPageChange: (newOffset: number) => void;
  pageSize?: number;
  onPageSizeChange?: (newSize: number) => void;
  pageSizeOptions?: number[];
}

export function Pagination({
  total,
  offset,
  limit,
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}: Props) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const showingFrom = total === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + limit, total);

  return (
    <div className="flex items-center justify-between px-1 py-1.5">
      <div className="flex items-center gap-4">
        {onPageSizeChange && (
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-[11px] text-muted-foreground">Rows per page:</span>
            <Select
              value={pageSize ?? limit}
              onValueChange={(val) => onPageSizeChange(val as number)}
            >
              <SelectTrigger size="sm" className="w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <p className="hidden text-[11px] text-muted-foreground sm:block">
          Showing {showingFrom}–{showingTo} of {total.toLocaleString()}
        </p>
        <p className="text-[11px] text-muted-foreground sm:hidden">
          {total.toLocaleString()} total
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Previous page"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(Math.max(0, offset - limit))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-[4.5rem] text-center text-[11px] tabular-nums text-muted-foreground">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Next page"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(offset + limit)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
