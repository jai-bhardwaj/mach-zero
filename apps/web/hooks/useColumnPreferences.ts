"use client";

import { useState, useEffect, useRef } from "react";
import type { VisibilityState } from "@tanstack/react-table";

function getStoredVisibility(storageKey: string): VisibilityState {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore corrupted localStorage
  }
  return {};
}

export function useColumnPreferences(tableId: string) {
  const storageKey = `mach-zero:columns:${tableId}`;
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    () => getStoredVisibility(storageKey)
  );
  const initialized = useRef(false);

  // Mark as initialized after first render
  useEffect(() => {
    initialized.current = true;
  }, []);

  // Persist to localStorage on changes (skip initial mount to avoid overwriting with {})
  useEffect(() => {
    if (!initialized.current) return;
    localStorage.setItem(storageKey, JSON.stringify(columnVisibility));
  }, [columnVisibility, storageKey]);

  return { columnVisibility, setColumnVisibility };
}
