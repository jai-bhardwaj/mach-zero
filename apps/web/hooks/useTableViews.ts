"use client";

import useSWR from "swr";

interface SavedViewConfig {
  filters: Record<string, string>;
  sorting: { id: string; desc: boolean }[];
  columnVisibility: Record<string, boolean>;
  pageSize: number;
}

interface SavedView {
  id: string;
  name: string;
  tableId: string;
  config: SavedViewConfig;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useTableViews(tableId: string) {
  const { data, error, isLoading, mutate } = useSWR<{ data: SavedView[] }>(
    `/api/views?tableId=${tableId}`,
    fetcher
  );

  const saveView = async (
    name: string,
    config: SavedViewConfig,
    isDefault = false
  ) => {
    const res = await fetch("/api/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, tableId, config, isDefault }),
    });
    if (!res.ok) throw new Error("Failed to save view");
    await mutate();
    return res.json();
  };

  const updateView = async (
    id: string,
    updates: Partial<{
      name: string;
      config: SavedViewConfig;
      isDefault: boolean;
    }>
  ) => {
    const res = await fetch("/api/views", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    if (!res.ok) throw new Error("Failed to update view");
    await mutate();
    return res.json();
  };

  const deleteView = async (id: string) => {
    const res = await fetch("/api/views", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) throw new Error("Failed to delete view");
    await mutate();
  };

  return {
    views: data?.data ?? [],
    error,
    isLoading,
    saveView,
    updateView,
    deleteView,
    refresh: mutate,
  };
}

export type { SavedView, SavedViewConfig };
