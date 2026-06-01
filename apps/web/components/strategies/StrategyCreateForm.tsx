"use client";

import { useState } from "react";
import { STRATEGY_TYPES, SYMBOL_MAP } from "@/types";
import { paramToInput, paramToStored, paramLabel } from "@/lib/strategy-params";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

interface Props {
  tenantId: string;
  accounts: { id: string; name: string; venue: string }[];
  onSave: (data: {
    tenantId: string;
    accountId: string;
    name: string;
    type: string;
    symbolId: number;
    symbolName: string;
    venue: string;
    params: Record<string, number>;
    maxPositionLimit: number | null;
    maxOrderRate: number | null;
    maxDrawdown: number | null;
  }) => void;
  onClose: () => void;
}

const SYMBOLS = Object.entries(SYMBOL_MAP).map(([id, info]) => ({
  id: Number(id),
  ...info,
}));

export function StrategyCreateForm({ tenantId, accounts, onSave, onClose }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState("SimpleSpreadStrategy");
  const [symbolId, setSymbolId] = useState(SYMBOLS[0].id);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [params, setParams] = useState<Record<string, string>>(() => {
    const defaults = STRATEGY_TYPES[type]?.defaultParams ?? {};
    return Object.fromEntries(
      Object.entries(defaults).map(([k, v]) => [k, paramToInput(k, v)])
    );
  });
  const [maxPositionLimit, setMaxPositionLimit] = useState("");
  const [maxOrderRate, setMaxOrderRate] = useState("");
  const [maxDrawdown, setMaxDrawdown] = useState("");

  const handleTypeChange = (newType: string) => {
    setType(newType);
    const defaults = STRATEGY_TYPES[newType]?.defaultParams ?? {};
    setParams(
      Object.fromEntries(
        Object.entries(defaults).map(([k, v]) => [k, paramToInput(k, v)])
      )
    );
  };

  const selectedSymbol = SYMBOL_MAP[symbolId];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedParams: Record<string, number> = {};
    for (const [key, value] of Object.entries(params)) {
      parsedParams[key] = paramToStored(key, value) as number;
    }

    onSave({
      tenantId,
      accountId,
      name,
      type,
      symbolId,
      symbolName: selectedSymbol?.name ?? `SYM-${symbolId}`,
      venue: selectedSymbol?.venue ?? "Unknown",
      params: parsedParams,
      maxPositionLimit: maxPositionLimit ? Number(maxPositionLimit) : null,
      maxOrderRate: maxOrderRate ? Number(maxOrderRate) : null,
      maxDrawdown: maxDrawdown ? Number(maxDrawdown) : null,
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Strategy</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-xs">Strategy Name</Label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., spread-btcusdt-aggressive"
              required
            />
          </div>

          <div>
            <Label className="text-xs">Strategy Type</Label>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
            >
              {Object.entries(STRATEGY_TYPES).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-xs">Symbol</Label>
            <select
              value={symbolId}
              onChange={(e) => setSymbolId(Number(e.target.value))}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
            >
              {SYMBOLS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.venue})
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-xs">Trading Account</Label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.venue})
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="mb-2 text-xs font-medium text-muted-foreground">
              Parameters
            </Label>
            <div className="space-y-2">
              {Object.entries(params).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <Label className="w-32 text-xs">{paramLabel(key)}</Label>
                  <Input
                    type="number"
                    value={value}
                    onChange={(e) =>
                      setParams((p) => ({ ...p, [key]: e.target.value }))
                    }
                    className="flex-1 font-mono"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 text-xs font-medium text-muted-foreground">
              Risk Limits (optional)
            </Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="w-32 text-xs">Max Position</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={maxPositionLimit}
                  onChange={(e) => setMaxPositionLimit(e.target.value)}
                  placeholder="e.g., 10.0"
                  className="flex-1 font-mono"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="w-32 text-xs">Max Order Rate</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={maxOrderRate}
                  onChange={(e) => setMaxOrderRate(e.target.value)}
                  placeholder="e.g., 100"
                  className="flex-1 font-mono"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="w-32 text-xs">Max Drawdown</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={maxDrawdown}
                  onChange={(e) => setMaxDrawdown(e.target.value)}
                  placeholder="e.g., 5000"
                  className="flex-1 font-mono"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button type="submit">Create Strategy</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
