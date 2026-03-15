"use client";

import useSWR from "swr";
import type {
  Trade,
  Order,
  RiskEvent,
  PaginatedResponse,
  TradeFilters,
  OrderFilters,
  RiskEventFilters,
} from "@/types";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useTrades(
  params?: TradeFilters & { limit?: number; offset?: number; sort?: string; dir?: string; end?: string; refreshInterval?: number }
) {
  const query = new URLSearchParams();
  if (params?.symbolId) query.set("symbol_id", String(params.symbolId));
  if (params?.side !== undefined && params.side !== null)
    query.set("side", String(params.side));
  if (params?.start) query.set("start", params.start);
  if (params?.tradingMode) query.set("trading_mode", params.tradingMode);
  if (params?.limit != null) query.set("limit", String(params.limit));
  if (params?.offset != null) query.set("offset", String(params.offset));
  if (params?.sort) query.set("sort", params.sort);
  if (params?.dir) query.set("dir", params.dir);
  if (params?.end) query.set("end", params.end);

  const { data, error, isLoading, isValidating, mutate } = useSWR<PaginatedResponse<Trade>>(
    `/api/trades?${query}`,
    fetcher,
    { refreshInterval: params?.refreshInterval ?? 5000, keepPreviousData: true }
  );

  return {
    trades: data?.data ?? [],
    total: data?.total ?? 0,
    error,
    isLoading,
    isValidating,
    refresh: mutate,
  };
}

export function useOrders(
  params?: OrderFilters & { limit?: number; offset?: number; sort?: string; dir?: string; start?: string; end?: string; refreshInterval?: number }
) {
  const query = new URLSearchParams();
  if (params?.symbolId) query.set("symbol_id", String(params.symbolId));
  if (params?.side !== undefined && params.side !== null)
    query.set("side", String(params.side));
  if (params?.status) query.set("status", params.status);
  if (params?.tradingMode) query.set("trading_mode", params.tradingMode);
  if (params?.limit != null) query.set("limit", String(params.limit));
  if (params?.offset != null) query.set("offset", String(params.offset));
  if (params?.sort) query.set("sort", params.sort);
  if (params?.dir) query.set("dir", params.dir);
  if (params?.start) query.set("start", params.start);
  if (params?.end) query.set("end", params.end);

  const { data, error, isLoading, isValidating, mutate } = useSWR<PaginatedResponse<Order>>(
    `/api/orders?${query}`,
    fetcher,
    { refreshInterval: params?.refreshInterval ?? 5000, keepPreviousData: true }
  );

  return {
    orders: data?.data ?? [],
    total: data?.total ?? 0,
    error,
    isLoading,
    isValidating,
    refresh: mutate,
  };
}

export function useRiskEvents(
  params?: RiskEventFilters & { limit?: number; offset?: number; sort?: string; dir?: string; end?: string; refreshInterval?: number }
) {
  const query = new URLSearchParams();
  if (params?.symbolId) query.set("symbol_id", String(params.symbolId));
  if (params?.reason) query.set("reason", params.reason);
  if (params?.start) query.set("start", params.start);
  if (params?.tradingMode) query.set("trading_mode", params.tradingMode);
  if (params?.limit != null) query.set("limit", String(params.limit));
  if (params?.offset != null) query.set("offset", String(params.offset));
  if (params?.sort) query.set("sort", params.sort);
  if (params?.dir) query.set("dir", params.dir);
  if (params?.end) query.set("end", params.end);

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    PaginatedResponse<RiskEvent>
  >(`/api/risk-events?${query}`, fetcher, {
    refreshInterval: params?.refreshInterval ?? 5000,
    keepPreviousData: true,
  });

  return {
    events: data?.data ?? [],
    total: data?.total ?? 0,
    error,
    isLoading,
    isValidating,
    refresh: mutate,
  };
}
