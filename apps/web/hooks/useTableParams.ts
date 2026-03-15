"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { SortingState } from "@/types";

const DEFAULT_PAGE_SIZE = 25;
const VALID_PAGE_SIZES = [10, 25, 50, 100];
const DEFAULT_SORT: SortingState[] = [{ id: "timestamp", desc: true }];

interface UseTableParamsOptions {
  defaultSort?: SortingState[];
  defaultPageSize?: number;
  prefix?: string;
}

interface TableParamsReturn {
  page: number;
  pageSize: number;
  offset: number;
  sorting: SortingState[];
  filters: Record<string, string>;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setSorting: (sorting: SortingState[]) => void;
  setFilter: (key: string, value: string) => void;
  removeFilter: (key: string) => void;
  removeFilters: (keys: string[]) => void;
  resetFilters: () => void;
  resetAll: () => void;
  searchParamsString: string;
}

export function useTableParams(options: UseTableParamsOptions = {}): TableParamsReturn {
  const {
    defaultSort = DEFAULT_SORT,
    defaultPageSize = DEFAULT_PAGE_SIZE,
    prefix = "",
  } = options;

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const page = Math.max(1, Number(searchParams.get(`${prefix}page`)) || 1);
  const rawPageSize = Number(searchParams.get(`${prefix}pageSize`) ?? String(defaultPageSize));
  const pageSize = VALID_PAGE_SIZES.includes(rawPageSize) ? rawPageSize : defaultPageSize;
  const offset = (page - 1) * pageSize;

  const sorting: SortingState[] = useMemo(() => {
    const sortParam = searchParams.get(`${prefix}sort`);
    const dirParam = searchParams.get(`${prefix}dir`);
    if (sortParam) {
      return [{ id: sortParam, desc: dirParam !== "asc" }];
    }
    return defaultSort;
  }, [searchParams, prefix, defaultSort]);

  const reservedKeys = useMemo(
    () => new Set([`${prefix}page`, `${prefix}pageSize`, `${prefix}sort`, `${prefix}dir`]),
    [prefix]
  );

  const filters: Record<string, string> = useMemo(() => {
    const result: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (key.startsWith(prefix) && !reservedKeys.has(key) && value) {
        result[key.slice(prefix.length)] = value;
      }
    });
    return result;
  }, [searchParams, prefix, reservedKeys]);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const setPage = useCallback(
    (p: number) => updateParams({ [`${prefix}page`]: p > 1 ? String(p) : null }),
    [updateParams, prefix]
  );

  const setPageSize = useCallback(
    (size: number) => updateParams({ [`${prefix}pageSize`]: String(size), [`${prefix}page`]: null }),
    [updateParams, prefix]
  );

  const setSorting = useCallback(
    (s: SortingState[]) => {
      if (s.length === 0) {
        updateParams({ [`${prefix}sort`]: null, [`${prefix}dir`]: null, [`${prefix}page`]: null });
      } else {
        updateParams({
          [`${prefix}sort`]: s[0].id,
          [`${prefix}dir`]: s[0].desc ? "desc" : "asc",
          [`${prefix}page`]: null,
        });
      }
    },
    [updateParams, prefix]
  );

  const setFilter = useCallback(
    (key: string, value: string) => updateParams({ [`${prefix}${key}`]: value || null, [`${prefix}page`]: null }),
    [updateParams, prefix]
  );

  const removeFilter = useCallback(
    (key: string) => updateParams({ [`${prefix}${key}`]: null, [`${prefix}page`]: null }),
    [updateParams, prefix]
  );

  const removeFilters = useCallback(
    (keys: string[]) => {
      const updates: Record<string, string | null> = { [`${prefix}page`]: null };
      for (const key of keys) {
        updates[`${prefix}${key}`] = null;
      }
      updateParams(updates);
    },
    [updateParams, prefix]
  );

  const resetFilters = useCallback(() => {
    const updates: Record<string, string | null> = { [`${prefix}page`]: null };
    searchParams.forEach((_, key) => {
      if (key.startsWith(prefix) && !reservedKeys.has(key)) {
        updates[key] = null;
      }
    });
    updateParams(updates);
  }, [updateParams, searchParams, prefix, reservedKeys]);

  const resetAll = useCallback(() => {
    const updates: Record<string, string | null> = {};
    searchParams.forEach((_, key) => {
      if (key.startsWith(prefix)) updates[key] = null;
    });
    updateParams(updates);
  }, [updateParams, searchParams, prefix]);

  return {
    page,
    pageSize,
    offset,
    sorting,
    filters,
    setPage,
    setPageSize,
    setSorting,
    setFilter,
    removeFilter,
    removeFilters,
    resetFilters,
    resetAll,
    searchParamsString: searchParams.toString(),
  };
}
