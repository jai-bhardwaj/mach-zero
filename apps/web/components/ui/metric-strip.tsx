import { cn } from "@/lib/utils";

interface Metric {
  label: string;
  value: string | number;
  change?: string;
  changeColor?: string;
}

interface Props {
  metrics: Metric[];
  className?: string;
}

export function MetricStrip({ metrics, className }: Props) {
  return (
    <div className={cn("grid grid-cols-2 gap-4 sm:flex sm:gap-0 sm:divide-x sm:divide-border/50", className)}>
      {metrics.map((metric) => (
        <div key={metric.label} className="sm:px-6 first:sm:pl-0 last:sm:pr-0">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {metric.label}
          </p>
          <p className="text-base font-semibold tabular-nums font-mono mt-0.5 sm:text-lg">
            {metric.value}
          </p>
          {metric.change && (
            <p className={cn("text-[11px] tabular-nums mt-0.5", metric.changeColor ?? "text-muted-foreground")}>
              {metric.change}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
