"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { VisibilityState } from "@tanstack/react-table";
import type { Trade } from "@/types";
import { useTableParams } from "@/hooks/useTableParams";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { useTrades, useOrders, useRiskEvents } from "@/hooks/useTrades";
import { useTradeStream } from "@/hooks/useTradeStream";
import { useTableViews } from "@/hooks/useTableViews";
import { useTableKeyboard } from "@/hooks/useTableKeyboard";
import { TradeBlotter } from "@/components/trades/TradeBlotter";
import { OrderHistory } from "@/components/trades/OrderHistory";
import { RiskEventsTable } from "@/components/trades/RiskEventsTable";
import { NewTradesBanner } from "@/components/trades/NewTradesBanner";
import { DataTableRowDetail } from "@/components/ui/data-table-row-detail";
import { TradeDetail } from "@/components/trades/TradeDetail";
import { DataTableToolbar, type FilterConfig } from "@/components/ui/data-table-toolbar";
import { DataTableColumnToggle } from "@/components/ui/data-table-column-toggle";
import { DataTableViewSwitcher } from "@/components/ui/data-table-view-switcher";
import { DataTableExport } from "@/components/ui/data-table-export";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/page-header";
import { SYMBOL_MAP } from "@/types";

// Build symbol options from SYMBOL_MAP
const SYMBOL_OPTIONS = Object.entries(SYMBOL_MAP).map(([id, { name }]) => ({
  label: name,
  value: id,
}));

const SIDE_OPTIONS = [
  { label: "Buy", value: "1" },
  { label: "Sell", value: "2" },
];

const STATUS_OPTIONS = [
  { label: "New", value: "NEW" },
  { label: "Acked", value: "ACKED" },
  { label: "Filled", value: "FILLED" },
  { label: "Partially Filled", value: "PARTIALLY_FILLED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Cancelled", value: "CANCELLED" },
];

const MODE_OPTIONS = [
  { label: "Mock", value: "MOCK" },
  { label: "Live", value: "LIVE" },
];

// Filter configs for each tab
const TRADE_FILTERS: FilterConfig[] = [
  { key: "symbolId", label: "Symbol", type: "select", options: SYMBOL_OPTIONS },
  { key: "side", label: "Side", type: "select", options: SIDE_OPTIONS },
  { key: "tradingMode", label: "Mode", type: "select", options: MODE_OPTIONS },
  { key: "timestamp", label: "Date Range", type: "dateRange" },
];

const ORDER_FILTERS: FilterConfig[] = [
  { key: "symbolId", label: "Symbol", type: "select", options: SYMBOL_OPTIONS },
  { key: "side", label: "Side", type: "select", options: SIDE_OPTIONS },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
  { key: "tradingMode", label: "Mode", type: "select", options: MODE_OPTIONS },
  { key: "timestamp", label: "Date Range", type: "dateRange" },
];

const RISK_FILTERS: FilterConfig[] = [
  { key: "symbolId", label: "Symbol", type: "select", options: SYMBOL_OPTIONS },
  { key: "tradingMode", label: "Mode", type: "select", options: MODE_OPTIONS },
  { key: "timestamp", label: "Date Range", type: "dateRange" },
];

// Column labels for column toggle dropdowns
const TRADE_COLUMN_LABELS: Record<string, string> = {
  timestamp: "Time",
  account_name: "Account",
  symbol_id: "Market",
  strategy_name: "Strategy",
  side: "Side",
  price: "Price",
  quantity: "Quantity",
  trading_mode: "Mode",
};

const ORDER_COLUMN_LABELS: Record<string, string> = {
  timestamp: "Time",
  order_id: "Order ID",
  symbol_id: "Market",
  strategy_name: "Strategy",
  side: "Side",
  price: "Price",
  quantity: "Quantity",
  status: "Status",
  trading_mode: "Mode",
};

const RISK_COLUMN_LABELS: Record<string, string> = {
  timestamp: "Time",
  order_id: "Order ID",
  symbol_id: "Symbol",
  reason: "Reason",
  trading_mode: "Mode",
};

// Export column definitions for CSV export
const TRADE_EXPORT_COLUMNS = [
  { key: "timestamp", label: "Time" },
  { key: "account_name", label: "Account" },
  { key: "symbol_id", label: "Market" },
  { key: "strategy_name", label: "Strategy" },
  { key: "side", label: "Side" },
  { key: "price", label: "Price" },
  { key: "quantity", label: "Quantity" },
  { key: "trading_mode", label: "Mode" },
];

const ORDER_EXPORT_COLUMNS = [
  { key: "timestamp", label: "Time" },
  { key: "order_id", label: "Order ID" },
  { key: "symbol_id", label: "Market" },
  { key: "strategy_name", label: "Strategy" },
  { key: "side", label: "Side" },
  { key: "price", label: "Price" },
  { key: "quantity", label: "Quantity" },
  { key: "status", label: "Status" },
  { key: "trading_mode", label: "Mode" },
];

const RISK_EXPORT_COLUMNS = [
  { key: "timestamp", label: "Time" },
  { key: "order_id", label: "Order ID" },
  { key: "symbol_id", label: "Symbol" },
  { key: "reason", label: "Reason" },
  { key: "trading_mode", label: "Mode" },
];

/** Build column info array for the toggle dropdown. */
function buildColumnInfoList(
  labels: Record<string, string>,
  visibility: VisibilityState
) {
  return Object.entries(labels).map(([id, label]) => ({
    id,
    label,
    visible: visibility[id] !== false,
  }));
}

function TradesPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Tab state from URL
  const activeTab = searchParams.get("tab") ?? "trades";

  // Trade stream for new-trades banner + WS connection state for polling fallback
  const { connected: wsConnected, newTradeCount, resetCount } = useTradeStream();

  // Selected trade for row-click detail panel
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  // Saved table views
  const tradeViews = useTableViews("trades");
  const orderViews = useTableViews("orders");
  const riskViews = useTableViews("risk-events");

  // Table params for each tab (prefixed to avoid collisions)
  const tradeParams = useTableParams({ prefix: "t_" });
  const orderParams = useTableParams({ prefix: "o_" });
  const riskParams = useTableParams({ prefix: "r_" });

  // Column visibility preferences (persisted in localStorage)
  const tradeColumnPrefs = useColumnPreferences("trades");
  const orderColumnPrefs = useColumnPreferences("orders");
  const riskColumnPrefs = useColumnPreferences("risk-events");

  // Build column info lists for toggle dropdowns
  const tradeColumnInfo = useMemo(
    () => buildColumnInfoList(TRADE_COLUMN_LABELS, tradeColumnPrefs.columnVisibility),
    [tradeColumnPrefs.columnVisibility]
  );
  const orderColumnInfo = useMemo(
    () => buildColumnInfoList(ORDER_COLUMN_LABELS, orderColumnPrefs.columnVisibility),
    [orderColumnPrefs.columnVisibility]
  );
  const riskColumnInfo = useMemo(
    () => buildColumnInfoList(RISK_COLUMN_LABELS, riskColumnPrefs.columnVisibility),
    [riskColumnPrefs.columnVisibility]
  );

  // Toggle handlers for column visibility
  const handleTradeColumnToggle = useCallback(
    (columnId: string, visible: boolean) => {
      tradeColumnPrefs.setColumnVisibility((prev) => ({ ...prev, [columnId]: visible }));
    },
    [tradeColumnPrefs]
  );
  const handleOrderColumnToggle = useCallback(
    (columnId: string, visible: boolean) => {
      orderColumnPrefs.setColumnVisibility((prev) => ({ ...prev, [columnId]: visible }));
    },
    [orderColumnPrefs]
  );
  const handleRiskColumnToggle = useCallback(
    (columnId: string, visible: boolean) => {
      riskColumnPrefs.setColumnVisibility((prev) => ({ ...prev, [columnId]: visible }));
    },
    [riskColumnPrefs]
  );

  // Wire SWR hooks to URL params — only poll the active tab
  const { trades, total: tradeTotal, isLoading: tradesLoading, isValidating: tradesValidating, refresh: tradeRefresh } = useTrades({
    symbolId: tradeParams.filters.symbolId ? Number(tradeParams.filters.symbolId) : undefined,
    side: tradeParams.filters.side !== undefined && tradeParams.filters.side !== ""
      ? Number(tradeParams.filters.side)
      : undefined,
    tradingMode: tradeParams.filters.tradingMode || undefined,
    start: tradeParams.filters.timestamp_start || undefined,
    end: tradeParams.filters.timestamp_end || undefined,
    limit: tradeParams.pageSize,
    offset: tradeParams.offset,
    sort: tradeParams.sorting[0]?.id,
    dir: tradeParams.sorting[0]?.desc ? "desc" : "asc",
    // When WS is connected, trades are pushed in real-time — no polling needed.
    // When WS disconnects, fall back to SWR polling every 5s for the active tab.
    refreshInterval: activeTab === "trades" && !wsConnected ? 5000 : 0,
  });

  const { orders, total: orderTotal, isLoading: ordersLoading, isValidating: ordersValidating } = useOrders({
    symbolId: orderParams.filters.symbolId ? Number(orderParams.filters.symbolId) : undefined,
    side: orderParams.filters.side !== undefined && orderParams.filters.side !== ""
      ? Number(orderParams.filters.side)
      : undefined,
    status: orderParams.filters.status || undefined,
    tradingMode: orderParams.filters.tradingMode || undefined,
    start: orderParams.filters.timestamp_start || undefined,
    end: orderParams.filters.timestamp_end || undefined,
    limit: orderParams.pageSize,
    offset: orderParams.offset,
    sort: orderParams.sorting[0]?.id,
    dir: orderParams.sorting[0]?.desc ? "desc" : "asc",
    refreshInterval: activeTab === "orders" ? 5000 : 0,
  });

  const { events, total: riskTotal, isLoading: eventsLoading, isValidating: eventsValidating } = useRiskEvents({
    symbolId: riskParams.filters.symbolId ? Number(riskParams.filters.symbolId) : undefined,
    tradingMode: riskParams.filters.tradingMode || undefined,
    start: riskParams.filters.timestamp_start || undefined,
    end: riskParams.filters.timestamp_end || undefined,
    limit: riskParams.pageSize,
    offset: riskParams.offset,
    sort: riskParams.sorting[0]?.id,
    dir: riskParams.sorting[0]?.desc ? "desc" : "asc",
    refreshInterval: activeTab === "risk-events" ? 5000 : 0,
  });

  // Tab change handler — persist in URL
  const handleTabChange = useCallback(
    (value: unknown) => {
      const tab = value as string;
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "trades") {
        params.delete("tab");
      } else {
        params.set("tab", tab);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  // Convert offset-based Pagination callbacks to page-based setPage calls
  const makePageChangeHandler = (pageSize: number, setPage: (page: number) => void) => {
    return (newOffset: number) => {
      const newPage = Math.floor(newOffset / pageSize) + 1;
      setPage(newPage);
    };
  };

  // Keyboard navigation for the trades table
  const handleTradeKeySelect = useCallback(
    (index: number) => {
      if (trades[index]) setSelectedTrade(trades[index]);
    },
    [trades]
  );

  const { focusedIndex: tradeFocusedIndex } = useTableKeyboard({
    totalRows: trades.length,
    enabled: activeTab === "trades" && selectedTrade === null,
    onSelect: handleTradeKeySelect,
  });

  // NewTradesBanner refresh handler
  const handleNewTradesRefresh = useCallback(() => {
    resetCount();
    tradeRefresh();
  }, [resetCount, tradeRefresh]);

  // View switcher load handlers
  const handleTradeViewLoad = useCallback(
    (viewId: string) => {
      const view = tradeViews.views.find((v) => v.id === viewId);
      if (view?.config) {
        // Apply filters from saved view
        for (const [key, value] of Object.entries(view.config.filters)) {
          tradeParams.setFilter(key, value);
        }
        // Apply sorting
        if (view.config.sorting) {
          tradeParams.setSorting(view.config.sorting);
        }
        // Apply column visibility
        if (view.config.columnVisibility) {
          tradeColumnPrefs.setColumnVisibility(view.config.columnVisibility);
        }
        // Apply page size
        if (view.config.pageSize) {
          tradeParams.setPageSize(view.config.pageSize);
        }
      }
    },
    [tradeViews.views, tradeParams, tradeColumnPrefs]
  );

  const handleOrderViewLoad = useCallback(
    (viewId: string) => {
      const view = orderViews.views.find((v) => v.id === viewId);
      if (view?.config) {
        for (const [key, value] of Object.entries(view.config.filters)) {
          orderParams.setFilter(key, value);
        }
        if (view.config.sorting) {
          orderParams.setSorting(view.config.sorting);
        }
        if (view.config.columnVisibility) {
          orderColumnPrefs.setColumnVisibility(view.config.columnVisibility);
        }
        if (view.config.pageSize) {
          orderParams.setPageSize(view.config.pageSize);
        }
      }
    },
    [orderViews.views, orderParams, orderColumnPrefs]
  );

  const handleRiskViewLoad = useCallback(
    (viewId: string) => {
      const view = riskViews.views.find((v) => v.id === viewId);
      if (view?.config) {
        for (const [key, value] of Object.entries(view.config.filters)) {
          riskParams.setFilter(key, value);
        }
        if (view.config.sorting) {
          riskParams.setSorting(view.config.sorting);
        }
        if (view.config.columnVisibility) {
          riskColumnPrefs.setColumnVisibility(view.config.columnVisibility);
        }
        if (view.config.pageSize) {
          riskParams.setPageSize(view.config.pageSize);
        }
      }
    },
    [riskViews.views, riskParams, riskColumnPrefs]
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Header */}
      <PageHeader title="Trades & Orders" />

      {/* Tabs — fill the viewport; the table area is the sole vertical scroller */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-1 min-h-0 flex-col">
        <TabsList variant="line" className="shrink-0">
          <TabsTrigger value="trades">
            Trades
            <span className="text-[10px] text-muted-foreground ml-1">{tradeTotal.toLocaleString()}</span>
          </TabsTrigger>
          <TabsTrigger value="orders">
            Orders
            <span className="text-[10px] text-muted-foreground ml-1">{orderTotal.toLocaleString()}</span>
          </TabsTrigger>
          <TabsTrigger value="risk-events">
            Risk Events
            <span className="text-[10px] text-muted-foreground ml-1">{riskTotal.toLocaleString()}</span>
          </TabsTrigger>
        </TabsList>

        {/* Trades Tab */}
        <TabsContent value="trades" className="min-h-0 flex flex-col gap-3">
          <NewTradesBanner count={newTradeCount} onRefresh={handleNewTradesRefresh} />
          <DataTableToolbar
            filters={TRADE_FILTERS}
            values={tradeParams.filters}
            onChange={tradeParams.setFilter}
            onRemove={tradeParams.removeFilter}
            onRemoveMany={tradeParams.removeFilters}
            onReset={tradeParams.resetFilters}
            total={tradeTotal}
          >
            <DataTableViewSwitcher
              views={tradeViews.views}
              onLoad={handleTradeViewLoad}
              onSave={(name) =>
                tradeViews.saveView(name, {
                  filters: tradeParams.filters,
                  sorting: tradeParams.sorting,
                  columnVisibility: tradeColumnPrefs.columnVisibility as Record<string, boolean>,
                  pageSize: tradeParams.pageSize,
                })
              }
              onDelete={(id) => tradeViews.deleteView(id)}
              onSetDefault={(id) => tradeViews.updateView(id, { isDefault: true })}
            />
            <DataTableExport
              data={trades as unknown as Record<string, unknown>[]}
              filename="trades"
              columns={TRADE_EXPORT_COLUMNS}
            />
            <DataTableColumnToggle
              columns={tradeColumnInfo}
              onToggle={handleTradeColumnToggle}
            />
          </DataTableToolbar>
          <TradeBlotter
            trades={trades}
            isLoading={tradesLoading}
            isValidating={tradesValidating}
            sorting={tradeParams.sorting}
            onSortingChange={tradeParams.setSorting}
            columnVisibility={tradeColumnPrefs.columnVisibility}
            onColumnVisibilityChange={tradeColumnPrefs.setColumnVisibility}
            onRowClick={setSelectedTrade}
            focusedRowIndex={tradeFocusedIndex}
          />
          <Pagination
            total={tradeTotal}
            offset={tradeParams.offset}
            limit={tradeParams.pageSize}
            onPageChange={makePageChangeHandler(tradeParams.pageSize, tradeParams.setPage)}
            pageSize={tradeParams.pageSize}
            onPageSizeChange={tradeParams.setPageSize}
          />
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders" className="min-h-0 flex flex-col gap-3">
          <DataTableToolbar
            filters={ORDER_FILTERS}
            values={orderParams.filters}
            onChange={orderParams.setFilter}
            onRemove={orderParams.removeFilter}
            onRemoveMany={orderParams.removeFilters}
            onReset={orderParams.resetFilters}
            total={orderTotal}
          >
            <DataTableViewSwitcher
              views={orderViews.views}
              onLoad={handleOrderViewLoad}
              onSave={(name) =>
                orderViews.saveView(name, {
                  filters: orderParams.filters,
                  sorting: orderParams.sorting,
                  columnVisibility: orderColumnPrefs.columnVisibility as Record<string, boolean>,
                  pageSize: orderParams.pageSize,
                })
              }
              onDelete={(id) => orderViews.deleteView(id)}
              onSetDefault={(id) => orderViews.updateView(id, { isDefault: true })}
            />
            <DataTableExport
              data={orders as unknown as Record<string, unknown>[]}
              filename="orders"
              columns={ORDER_EXPORT_COLUMNS}
            />
            <DataTableColumnToggle
              columns={orderColumnInfo}
              onToggle={handleOrderColumnToggle}
            />
          </DataTableToolbar>
          <OrderHistory
            orders={orders}
            isLoading={ordersLoading}
            isValidating={ordersValidating}
            sorting={orderParams.sorting}
            onSortingChange={orderParams.setSorting}
            columnVisibility={orderColumnPrefs.columnVisibility}
            onColumnVisibilityChange={orderColumnPrefs.setColumnVisibility}
          />
          <Pagination
            total={orderTotal}
            offset={orderParams.offset}
            limit={orderParams.pageSize}
            onPageChange={makePageChangeHandler(orderParams.pageSize, orderParams.setPage)}
            pageSize={orderParams.pageSize}
            onPageSizeChange={orderParams.setPageSize}
          />
        </TabsContent>

        {/* Risk Events Tab */}
        <TabsContent value="risk-events" className="min-h-0 flex flex-col gap-3">
          <DataTableToolbar
            filters={RISK_FILTERS}
            values={riskParams.filters}
            onChange={riskParams.setFilter}
            onRemove={riskParams.removeFilter}
            onRemoveMany={riskParams.removeFilters}
            onReset={riskParams.resetFilters}
            total={riskTotal}
          >
            <DataTableViewSwitcher
              views={riskViews.views}
              onLoad={handleRiskViewLoad}
              onSave={(name) =>
                riskViews.saveView(name, {
                  filters: riskParams.filters,
                  sorting: riskParams.sorting,
                  columnVisibility: riskColumnPrefs.columnVisibility as Record<string, boolean>,
                  pageSize: riskParams.pageSize,
                })
              }
              onDelete={(id) => riskViews.deleteView(id)}
              onSetDefault={(id) => riskViews.updateView(id, { isDefault: true })}
            />
            <DataTableExport
              data={events as unknown as Record<string, unknown>[]}
              filename="risk-events"
              columns={RISK_EXPORT_COLUMNS}
            />
            <DataTableColumnToggle
              columns={riskColumnInfo}
              onToggle={handleRiskColumnToggle}
            />
          </DataTableToolbar>
          <RiskEventsTable
            events={events}
            isLoading={eventsLoading}
            isValidating={eventsValidating}
            sorting={riskParams.sorting}
            onSortingChange={riskParams.setSorting}
            columnVisibility={riskColumnPrefs.columnVisibility}
            onColumnVisibilityChange={riskColumnPrefs.setColumnVisibility}
          />
          <Pagination
            total={riskTotal}
            offset={riskParams.offset}
            limit={riskParams.pageSize}
            onPageChange={makePageChangeHandler(riskParams.pageSize, riskParams.setPage)}
            pageSize={riskParams.pageSize}
            onPageSizeChange={riskParams.setPageSize}
          />
        </TabsContent>
      </Tabs>

      {/* Trade detail slide-over */}
      <DataTableRowDetail
        open={selectedTrade !== null}
        onClose={() => setSelectedTrade(null)}
        title="Trade Details"
      >
        {selectedTrade && <TradeDetail trade={selectedTrade} />}
      </DataTableRowDetail>
    </div>
  );
}

function TradesPageSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <div className="h-6 w-40 rounded bg-muted animate-pulse" />
        <div className="h-4 w-64 rounded bg-muted animate-pulse mt-1" />
      </div>
      <div className="h-8 w-64 rounded bg-muted animate-pulse" />
      <TableSkeleton columns={6} rows={10} />
    </div>
  );
}

export default function TradesPage() {
  return (
    <Suspense fallback={<TradesPageSkeleton />}>
      <TradesPageInner />
    </Suspense>
  );
}
