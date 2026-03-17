/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useColumnPreferences } from "../useColumnPreferences";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("useColumnPreferences", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("initializes with empty object when no stored value", () => {
    const { result } = renderHook(() => useColumnPreferences("test-table"));
    expect(result.current.columnVisibility).toEqual({});
  });

  it("loads stored preferences from localStorage", () => {
    const stored = { price: false, quantity: false };
    localStorageMock.setItem(
      "mach-zero:columns:test-table",
      JSON.stringify(stored)
    );

    const { result } = renderHook(() => useColumnPreferences("test-table"));
    expect(result.current.columnVisibility).toEqual(stored);
  });

  it("saves preferences to localStorage on change", () => {
    const { result } = renderHook(() => useColumnPreferences("test-table"));

    act(() => {
      result.current.setColumnVisibility({ price: false });
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "mach-zero:columns:test-table",
      JSON.stringify({ price: false })
    );
  });

  it("uses different storage keys for different tables", () => {
    renderHook(() => useColumnPreferences("trades"));
    renderHook(() => useColumnPreferences("orders"));

    expect(localStorageMock.getItem).toHaveBeenCalledWith(
      "mach-zero:columns:trades"
    );
    expect(localStorageMock.getItem).toHaveBeenCalledWith(
      "mach-zero:columns:orders"
    );
  });

  it("handles invalid JSON in localStorage gracefully", () => {
    localStorageMock.setItem(
      "mach-zero:columns:broken-table",
      "not valid json"
    );

    const { result } = renderHook(() =>
      useColumnPreferences("broken-table")
    );
    expect(result.current.columnVisibility).toEqual({});
  });

  it("returns setColumnVisibility function", () => {
    const { result } = renderHook(() => useColumnPreferences("test-table"));
    expect(typeof result.current.setColumnVisibility).toBe("function");
  });
});
