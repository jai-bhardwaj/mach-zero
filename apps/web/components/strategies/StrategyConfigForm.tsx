"use client";

import { useState } from "react";
import type { StrategyConfig } from "@/types";
import { paramToInput, paramToStored, paramLabel } from "@/lib/strategy-params";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

interface Props {
  strategy: StrategyConfig;
  onSave: (id: string, data: {
    params: Record<string, unknown>;
    maxPositionLimit: number | null;
    maxOrderRate: number | null;
    maxDrawdown: number | null;
    riskMultiplier: number;
  }) => void;
  onClose: () => void;
}

export function StrategyConfigForm({ strategy, onSave, onClose }: Props) {
  // Edit params in human units (e.g. 1.0, 0.01); convert to the engine's
  // fixed-point convention on save. See lib/strategy-params.
  const [params, setParams] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(strategy.params).map(([k, v]) => [k, paramToInput(k, v)])
    )
  );
  const [maxPositionLimit, setMaxPositionLimit] = useState(
    strategy.maxPositionLimit != null ? String(strategy.maxPositionLimit) : ""
  );
  const [maxOrderRate, setMaxOrderRate] = useState(
    strategy.maxOrderRate != null ? String(strategy.maxOrderRate) : ""
  );
  const [maxDrawdown, setMaxDrawdown] = useState(
    strategy.maxDrawdown != null ? String(strategy.maxDrawdown) : ""
  );
  const [riskMultiplier, setRiskMultiplier] = useState(
    String(strategy.riskMultiplier)
  );

  const handleSave = () => {
    const parsed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      parsed[key] = paramToStored(key, value);
    }
    onSave(strategy.id, {
      params: parsed,
      maxPositionLimit: maxPositionLimit ? Number(maxPositionLimit) : null,
      maxOrderRate: maxOrderRate ? Number(maxOrderRate) : null,
      maxDrawdown: maxDrawdown ? Number(maxDrawdown) : null,
      riskMultiplier: Number(riskMultiplier) || 1.0,
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit: {strategy.name}</DialogTitle>
          <DialogDescription>
            {strategy.type} &middot; {strategy.symbolName} &middot;{" "}
            {strategy.venue}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Strategy Parameters */}
          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">
              Parameters
            </h3>
            <div className="space-y-3">
              {Object.entries(params).map(([key, value]) => (
                <div key={key}>
                  <Label className="text-xs">{paramLabel(key)}</Label>
                  <Input
                    type="text"
                    value={value}
                    onChange={(e) =>
                      setParams((p) => ({ ...p, [key]: e.target.value }))
                    }
                    className="font-mono"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Risk Limits */}
          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">
              Risk Limits
            </h3>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Max Position Limit</Label>
                <Input
                  type="number"
                  value={maxPositionLimit}
                  onChange={(e) => setMaxPositionLimit(e.target.value)}
                  placeholder="Global default"
                  className="font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">Max Order Rate</Label>
                <Input
                  type="number"
                  value={maxOrderRate}
                  onChange={(e) => setMaxOrderRate(e.target.value)}
                  placeholder="Global default"
                  className="font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">Max Drawdown</Label>
                <Input
                  type="number"
                  value={maxDrawdown}
                  onChange={(e) => setMaxDrawdown(e.target.value)}
                  placeholder="No limit"
                  className="font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">Risk Multiplier</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={riskMultiplier}
                  onChange={(e) => setRiskMultiplier(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>
            Cancel
          </DialogClose>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
