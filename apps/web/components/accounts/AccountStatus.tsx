"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import type { AccountStatus as AccountStatusType } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  AccountStatusType,
  { label: string; dotColor: "green" | "yellow" | "red" | "blue"; pulse?: boolean }
> = {
  connected: { label: "Connected", dotColor: "green" },
  disconnected: { label: "Disconnected", dotColor: "yellow" },
  error: { label: "Error", dotColor: "red" },
  validating: { label: "Validating", dotColor: "blue", pulse: true },
};

interface Props {
  status: AccountStatusType;
  statusMessage?: string | null;
}

export function AccountStatusBadge({ status, statusMessage }: Props) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.disconnected;

  const badge = (
    <Badge variant="dot" dotColor={config.dotColor}>
      <span className={cn(config.pulse && "animate-pulse")}>
        {config.label}
      </span>
    </Badge>
  );

  if (statusMessage) {
    return (
      <Tooltip>
        <TooltipTrigger render={<span className="cursor-default" />}>
          {badge}
        </TooltipTrigger>
        <TooltipContent>{statusMessage}</TooltipContent>
      </Tooltip>
    );
  }

  return badge;
}
