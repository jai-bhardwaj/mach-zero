"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DataTableFilterChips,
  type FilterChip,
} from "@/components/ui/data-table-filter-chips";
import { DateRangePicker } from "@/components/ui/date-range-picker";

export interface FilterConfig {
  key: string;
  label: string;
  type: "select" | "text" | "dateRange";
  options?: { label: string; value: string }[];
  placeholder?: string;
}

interface Props {
  filters: FilterConfig[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onRemove: (key: string) => void;
  onRemoveMany?: (keys: string[]) => void;
  onReset: () => void;
  total?: number;
  children?: React.ReactNode;
}

function DebouncedTextFilter({
  filter,
  value,
  onChange,
}: {
  filter: FilterConfig;
  value: string;
  onChange: (key: string, value: string) => void;
}) {
  const [localValue, setLocalValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        onChange(filter.key, newValue);
      }, 300);
    },
    [onChange, filter.key]
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
      <Input
        value={localValue}
        onChange={handleChange}
        placeholder={filter.placeholder ?? `Filter ${filter.label}...`}
        className="h-7 pl-7 w-[180px] text-xs"
      />
    </div>
  );
}

export function DataTableToolbar({
  filters,
  values,
  onChange,
  onRemove,
  onRemoveMany,
  onReset,
  total,
  children,
}: Props) {
  const hasActiveFilters = Object.values(values).some((v) => v !== "");

  // Build filter chips from active values
  const chips: FilterChip[] = useMemo(() => {
    const result: FilterChip[] = [];
    for (const filter of filters) {
      if (filter.type === "dateRange") {
        const startVal = values[`${filter.key}_start`];
        const endVal = values[`${filter.key}_end`];
        if (startVal || endVal) {
          const parts: string[] = [];
          if (startVal) parts.push(startVal.replace("T", " "));
          if (endVal) parts.push(endVal.replace("T", " "));
          result.push({
            key: filter.key,
            label: filter.label,
            displayValue: parts.join(" \u2013 "),
          });
        }
      } else {
        const val = values[filter.key];
        if (val) {
          // Resolve display value from options if select type
          let displayValue = val;
          if (filter.type === "select" && filter.options) {
            const matched = filter.options.find((opt) => opt.value === val);
            if (matched) displayValue = matched.label;
          }
          result.push({
            key: filter.key,
            label: filter.label,
            displayValue,
          });
        }
      }
    }
    return result;
  }, [filters, values]);

  const handleChipRemove = useCallback(
    (key: string) => {
      // For date range filters, remove both start and end in a single URL update
      const filter = filters.find((f) => f.key === key);
      if (filter?.type === "dateRange") {
        if (onRemoveMany) {
          onRemoveMany([`${key}_start`, `${key}_end`]);
        } else {
          onRemove(`${key}_start`);
          onRemove(`${key}_end`);
        }
      } else {
        onRemove(key);
      }
    },
    [filters, onRemove, onRemoveMany]
  );

  return (
    <div className="space-y-2">
      {/* Top row: filter controls + children slot */}
      <div className="flex flex-wrap items-start gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">

          {filters.map((filter) => {
            if (filter.type === "select") {
              return (
                <Select
                  key={filter.key}
                  value={values[filter.key] || ""}
                  onValueChange={(val) => onChange(filter.key, String(val ?? ""))}
                >
                  <SelectTrigger size="sm">
                    <SelectValue placeholder={filter.label} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All {filter.label}s</SelectItem>
                    {filter.options?.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            }

            if (filter.type === "text") {
              return (
                <DebouncedTextFilter
                  key={filter.key}
                  filter={filter}
                  value={values[filter.key] ?? ""}
                  onChange={onChange}
                />
              );
            }

            if (filter.type === "dateRange") {
              return (
                <DateRangePicker
                  key={filter.key}
                  startDate={values[`${filter.key}_start`]}
                  endDate={values[`${filter.key}_end`]}
                  onStartChange={(date) =>
                    onChange(`${filter.key}_start`, date)
                  }
                  onEndChange={(date) => onChange(`${filter.key}_end`, date)}
                  onClear={() => {
                    if (onRemoveMany) {
                      onRemoveMany([`${filter.key}_start`, `${filter.key}_end`]);
                    } else {
                      onRemove(`${filter.key}_start`);
                      onRemove(`${filter.key}_end`);
                    }
                  }}
                />
              );
            }

            return null;
          })}

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onReset}>
              <X className="size-3" />
              Clear all
            </Button>
          )}
        </div>

        {/* Right side: children slot + total count */}
        <div className="ml-auto flex items-center gap-1.5">
          {children}
          {total !== undefined && (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {total.toLocaleString()} results
            </span>
          )}
        </div>
      </div>

      {/* Bottom row: active filter chips */}
      <DataTableFilterChips
        chips={chips}
        onRemove={handleChipRemove}
        onClearAll={onReset}
      />
    </div>
  );
}
