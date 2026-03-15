"use client";

import { useEffect, useCallback, useRef, useState } from "react";

interface Options {
  totalRows: number;
  enabled?: boolean;
  onSelect?: (index: number) => void;
}

export function useTableKeyboard({ totalRows, enabled = true, onSelect }: Options) {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const focusedIndexRef = useRef(focusedIndex);
  focusedIndexRef.current = focusedIndex;

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
          if (focusedIndexRef.current >= 0) {
            e.preventDefault();
            onSelect?.(focusedIndexRef.current);
          }
          break;
        case "Escape":
          e.preventDefault();
          setFocusedIndex(-1);
          break;
      }
    },
    [enabled, totalRows, onSelect]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Reset focused index only when rows disappear or index goes out of bounds
  useEffect(() => {
    if (totalRows === 0) {
      setFocusedIndex(-1);
    } else {
      setFocusedIndex((prev) => (prev >= totalRows ? totalRows - 1 : prev));
    }
  }, [totalRows]);

  return { focusedIndex, setFocusedIndex };
}
