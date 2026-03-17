"use client";

import { useEffect, useCallback, useState, useMemo } from "react";

interface Options {
  totalRows: number;
  enabled?: boolean;
  onSelect?: (index: number) => void;
}

export function useTableKeyboard({ totalRows, enabled = true, onSelect }: Options) {
  const [rawFocusedIndex, setFocusedIndex] = useState<number>(-1);

  // Clamp focused index to valid range without needing an effect
  const focusedIndex = useMemo(() => {
    if (totalRows === 0) return -1;
    if (rawFocusedIndex >= totalRows) return totalRows - 1;
    return rawFocusedIndex;
  }, [rawFocusedIndex, totalRows]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;
      // Don't capture if user is typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
      )
        return;

      switch (e.key) {
        case "j":
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, totalRows - 1));
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          if (focusedIndex >= 0) {
            e.preventDefault();
            onSelect?.(focusedIndex);
          }
          break;
        case "Escape":
          e.preventDefault();
          setFocusedIndex(-1);
          break;
      }
    },
    [enabled, totalRows, focusedIndex, onSelect]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return { focusedIndex, setFocusedIndex };
}
