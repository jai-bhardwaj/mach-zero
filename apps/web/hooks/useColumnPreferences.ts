"use client";

import { useState, useEffect, useRef } from "react";
import type { VisibilityState } from "@tanstack/react-table";

export function useColumnPreferences(tableId: string) {
  const storageKey = `mach-zero:columns:${tableId}`;
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const initialized = useRef(false);

  // Hydrate from localStorage on mount (client-only, avoids SSR mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setColumnVisibility(JSON.parse(stored));
      }
    } catch {
      // ignore corrupted localStorage
    }
    initialized.current = true;
  }, [storageKey]);

  // Persist to localStorage on changes (skip initial mount to avoid overwriting with {})
  useEffect(() => {
    if (!initialized.current) return;
    localStorage.setItem(storageKey, JSON.stringify(columnVisibility));
  }, [columnVisibility, storageKey]);

  return { columnVisibility, setColumnVisibility };
}
