"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  startDate?: string;
  endDate?: string;
  onStartChange: (date: string) => void;
  onEndChange: (date: string) => void;
  onClear: () => void;
}

const PRESETS = [
  { label: "Today", days: 0 },
  { label: "24h", days: 1 },
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
] as const;

function toLocalDatetimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  onClear,
}: Props) {
  const handlePreset = useCallback(
    (days: number) => {
      const now = new Date();
      const end = toLocalDatetimeString(now);

      if (days === 0) {
        // "Today" — start of today
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        onStartChange(toLocalDatetimeString(startOfDay));
      } else {
        const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        onStartChange(toLocalDatetimeString(start));
      }
      onEndChange(end);
    },
    [onStartChange, onEndChange]
  );

  const hasValue = Boolean(startDate || endDate);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Calendar className="size-3.5 text-muted-foreground shrink-0" />
        <Input
          type="datetime-local"
          value={startDate ?? ""}
          max={endDate || undefined}
          onChange={(e) => onStartChange(e.target.value)}
          className={cn(
            "h-7 w-auto min-w-[160px] text-xs",
            !startDate && "text-muted-foreground"
          )}
          aria-label="Start date"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <Input
          type="datetime-local"
          value={endDate ?? ""}
          min={startDate || undefined}
          onChange={(e) => onEndChange(e.target.value)}
          className={cn(
            "h-7 w-auto min-w-[160px] text-xs",
            !endDate && "text-muted-foreground"
          )}
          aria-label="End date"
        />
        {hasValue && (
          <Button variant="ghost" size="xs" onClick={onClear}>
            Clear
          </Button>
        )}
      </div>

      <div className="flex items-center gap-1">
        {PRESETS.map((preset) => (
          <Button
            key={preset.label}
            variant="outline"
            size="xs"
            onClick={() => handlePreset(preset.days)}
            className="text-[10px] h-5 px-1.5"
          >
            {preset.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
