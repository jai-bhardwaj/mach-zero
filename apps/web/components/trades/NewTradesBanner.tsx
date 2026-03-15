"use client";

import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface Props {
  count: number;
  onRefresh: () => void;
}

export function NewTradesBanner({ count, onRefresh }: Props) {
  if (count === 0) return null;

  return (
    <div className="flex items-center justify-between rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs animate-in fade-in slide-in-from-top-1 duration-200">
      <span className="text-accent font-medium">
        {count} new trade{count !== 1 ? "s" : ""} received
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRefresh}
        className="h-6 gap-1 text-xs"
      >
        <RefreshCw className="size-3" />
        Load new
      </Button>
    </div>
  );
}
