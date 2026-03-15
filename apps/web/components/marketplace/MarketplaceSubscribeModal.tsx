"use client";

import { useState } from "react";
import type { StrategyTemplate } from "@/types";
import { SYMBOL_MAP } from "@/types";
import { formatPrice } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface Props {
  template: StrategyTemplate;
  accounts: { id: string; name: string; venue: string }[];
  onConfirm: (templateId: string, accountId: string, symbolId: number) => void;
  onClose: () => void;
  submitting: boolean;
}

export function MarketplaceSubscribeModal({
  template,
  accounts,
  onConfirm,
  onClose,
  submitting,
}: Props) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [symbolId, setSymbolId] = useState(template.symbolIds[0] ?? 0);

  const supportedSymbols = template.symbolIds.map((sid) => ({
    id: sid,
    ...(SYMBOL_MAP[sid] ?? { name: `SYM-${sid}`, venue: "Unknown" }),
  }));

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Subscribe to Strategy</DialogTitle>
          <DialogDescription>{template.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Account selector */}
          <div>
            <Label className="mb-1">Trading Account</Label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.venue})
                </option>
              ))}
            </select>
          </div>

          {/* Symbol selector */}
          <div>
            <Label className="mb-1">Symbol</Label>
            <select
              value={symbolId}
              onChange={(e) => setSymbolId(Number(e.target.value))}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {supportedSymbols.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.venue})
                </option>
              ))}
            </select>
          </div>

          {/* Mock mode info */}
          <div className="rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-blue-400">
            Strategy will start immediately in Paper Trading (MOCK) mode.
            Switch to LIVE from the Strategies page when ready.
          </div>

          {/* Min capital notice */}
          {template.minCapital > 0 && (
            <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
              This strategy requires a minimum capital of{" "}
              {formatPrice(template.minCapital)} for LIVE mode. You can allocate
              capital on the Strategies page before going live.
            </div>
          )}
        </div>

        {/* Actions */}
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />} disabled={submitting}>
            Cancel
          </DialogClose>
          <Button
            onClick={() => onConfirm(template.id, accountId, symbolId)}
            disabled={submitting || !accountId}
          >
            {submitting ? "Subscribing..." : "Confirm Subscribe"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
