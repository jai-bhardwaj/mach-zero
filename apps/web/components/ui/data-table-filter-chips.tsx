"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export interface FilterChip {
  key: string;
  label: string;
  displayValue: string;
}

interface Props {
  chips: FilterChip[];
  onRemove: (key: string) => void;
  onClearAll: () => void;
}

export function DataTableFilterChips({ chips, onRemove, onClearAll }: Props) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="secondary"
          className="gap-1 pr-1 text-xs"
        >
          <span className="text-muted-foreground">{chip.label}:</span>
          <span>{chip.displayValue}</span>
          <button
            type="button"
            onClick={() => onRemove(chip.key)}
            className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
            aria-label={`Remove ${chip.label} filter`}
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}

      {/* "Clear all" is shown in the parent DataTableToolbar, not here */}
    </div>
  );
}
