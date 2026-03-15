import { cn } from "@/lib/utils";

interface Props {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: Props) {
  return (
    <div className={cn("flex flex-col gap-3 border-b border-border/50 pb-4 mb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4", className)}>
      <div className="min-w-0">
        <h1 className="text-base font-semibold tracking-tight sm:text-lg">{title}</h1>
        {description && (
          <p className="text-[11px] text-muted-foreground mt-0.5 sm:text-xs">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
    </div>
  );
}
