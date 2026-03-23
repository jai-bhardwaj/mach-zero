"use client";

import { useState } from "react";
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
import type { TradingAccountWithRelations } from "@/types";

interface Props {
  account: TradingAccountWithRelations;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

export function DeleteAccountDialog({ account, open, onOpenChange, onDeleted }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strategyCount = account._count?.strategies ?? 0;

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts?id=${account.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to delete account");
        return;
      }
      onOpenChange(false);
      onDeleted();
    } catch {
      setError("Failed to delete account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Trading Account</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{account.name}</strong>? This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {strategyCount > 0 && (
          <div className="rounded-md border border-amber-500/30 bg-amber-900/10 px-3 py-2 text-xs text-amber-400">
            This account has {strategyCount} attached{" "}
            {strategyCount === 1 ? "strategy" : "strategies"}. Remove or
            reassign them before deleting.
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-900/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={loading || strategyCount > 0}
          >
            {loading ? "Deleting..." : "Delete Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
