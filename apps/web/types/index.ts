// ── Pagination ──────────────────────────────────────────────────────

// Generic paginated API response
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  offset: number;
  limit: number;
}

// Filter params for each QuestDB table
export interface TradeFilters {
  symbolId?: number;
  side?: number;
  start?: string;
  tradingMode?: string;
}

export interface OrderFilters {
  symbolId?: number;
  side?: number;
  status?: string;
  tradingMode?: string;
}

export interface RiskEventFilters {
  symbolId?: number;
  reason?: string;
  start?: string;
  tradingMode?: string;
}

// ── Shared Memory ───────────────────────────────────────────────────

// Shared memory symbol state (matches SharedMemoryLayout.h / shm_reader.py)
export interface SymbolState {
  symbolId: number;
  name: string;
  venue: string;
  lastPrice: number;
  lastQuantity: number;
  bidPrice: number;
  bidQuantity: number;
  askPrice: number;
  askQuantity: number;
  vwap: number;
  volume24h: number;
  position: number;
  unrealizedPnl: number;
  realizedPnl: number;
  orderCount: number;
  fillCount: number;
  spread: number;
  lastTradeTimestamp: number;
  lastUpdateTimestamp: number;
}

// WebSocket snapshot from Python bridge
export interface LiveSnapshot {
  type: "snapshot";
  symbols: SymbolState[];
}

// QuestDB trade record
export interface Trade {
  symbol_id: number;
  venue: number;
  price: number;
  quantity: number;
  side: number;
  strategy_id?: string;
  trading_mode?: string;
  // Joined from Postgres (StrategyConfig.engineId == strategy_id) in /api/trades.
  strategy_name?: string;
  account_name?: string;
  timestamp: string;
}

// QuestDB order record
export interface Order {
  symbol_id: number;
  order_id: number;
  side: number;
  price: number;
  quantity: number;
  status: string;
  strategy_id?: string;
  trading_mode?: string;
  // Joined from Postgres (StrategyConfig.engineId == strategy_id) in /api/orders.
  strategy_name?: string;
  account_name?: string;
  timestamp: string;
}

// QuestDB risk event
export interface RiskEvent {
  symbol_id: number;
  order_id: number;
  reason: string;
  strategy_id?: string;
  strategy_name?: string;
  account_name?: string;
  trading_mode?: string;
  timestamp: string;
}

// Strategy status (matches Prisma enum)
export type StrategyStatus = "RUNNING" | "PAUSED" | "STOPPED" | "PENDING";

// Strategy configuration (PostgreSQL)
export interface StrategyConfig {
  id: string;
  tenantId: string;
  accountId: string | null;
  name: string;
  type: string;
  symbolId: number;
  symbolName: string;
  venue: string;
  status: StrategyStatus;
  tradingMode: TradingMode;
  modeChangedAt: string | null;
  params: Record<string, unknown>;
  maxPositionLimit: number | null;
  maxOrderRate: number | null;
  maxDrawdown: number | null;
  riskMultiplier: number;
  updatedAt: string;
  updatedBy: string | null;
  allocation?: CapitalAllocation | null;
}

// Capital pool for a trading account
export interface CapitalPool {
  id: string;
  tenantId: string;
  accountId: string;
  totalCapital: number;
  allocatedTotal: number;
  reservedMargin: number;
  currency: string;
  updatedAt: string;
  allocations?: CapitalAllocation[];
  account?: { name: string; venue: string };
}

// Capital allocation to a strategy
export interface CapitalAllocation {
  id: string;
  poolId: string;
  strategyId: string;
  allocatedAmt: number;
  usedMargin: number;
  maxDrawdown: number | null;
  updatedAt: string;
  strategy?: { name: string; symbolName: string };
}

// Trading account
export interface TradingAccount {
  id: string;
  tenantId: string;
  name: string;
  venue: string;
  segments: string[];
  active: boolean;
  config: Record<string, unknown> | null;
  status: AccountStatus;
  statusMessage: string | null;
  testnet: boolean;
  lastCheckedAt: string | null;
  permissions: string[];
  createdAt: string;
}

// Account connection status
export type AccountStatus = "connected" | "disconnected" | "error" | "validating";

// Trading account with relations (from API response)
export interface TradingAccountWithRelations extends TradingAccount {
  _count?: { strategies: number };
  tenant?: { name: string };
}

// Binance credential validation result
export interface AccountValidationResult {
  valid: boolean;
  canTrade?: boolean;
  // canWithdraw true = the API key permits fund withdrawal. Mach-Zero
  // never withdraws, so this is purely a security footgun: a leaked
  // withdraw-enabled key drains the user's exchange account. UX should
  // warn loudly and prefer to block the save.
  canWithdraw?: boolean;
  permissions?: string[];
  balances?: { asset: string; free: string; locked: string }[];
  error?: string;
}

// ── Venue / Segment / Credential Config ─────────────────────────────

export type Venue = "Binance" | "NSE";

export const VENUE_SEGMENTS: Record<
  Venue,
  { value: string; label: string; description: string }[]
> = {
  Binance: [
    { value: "crypto-spot", label: "Spot", description: "Spot trading (BTC, ETH, etc.)" },
    { value: "crypto-futures", label: "Futures", description: "USDT-margined perpetuals" },
  ],
  NSE: [
    { value: "nse-eq", label: "Equity", description: "Cash equity segment" },
    { value: "nse-fo", label: "Futures & Options", description: "Equity derivatives" },
    { value: "nse-cd", label: "Currency Derivatives", description: "USD/INR, EUR/INR, etc." },
  ],
};

export const VENUE_CREDENTIAL_FIELDS: Record<
  Venue,
  { key: string; label: string; type: "text" | "password"; placeholder: string; required: boolean }[]
> = {
  Binance: [
    { key: "apiKey", label: "API Key", type: "text", placeholder: "Enter your Binance API key", required: true },
    { key: "apiSecret", label: "API Secret", type: "password", placeholder: "Enter your Binance API secret", required: true },
  ],
  NSE: [
    { key: "brokerName", label: "Broker", type: "text", placeholder: "e.g. Zerodha, Angel One", required: true },
    { key: "clientId", label: "Client ID", type: "text", placeholder: "Your broker client ID", required: true },
    { key: "apiKey", label: "API Key", type: "password", placeholder: "Broker API key", required: true },
    { key: "apiSecret", label: "API Secret", type: "password", placeholder: "Broker API secret", required: false },
  ],
};

// Segment label lookup
export const SEGMENT_LABELS: Record<string, string> = {
  "crypto-spot": "Spot",
  "crypto-futures": "Futures",
  "nse-eq": "Equity",
  "nse-fo": "F&O",
  "nse-cd": "Currency",
};

// User
export interface User {
  id: string;
  tenantId: string;
  username: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

export type Role = "SUPER_ADMIN" | "ADMIN" | "RISK_MANAGER" | "TRADER" | "VIEWER";

// Trading mode (matches Prisma enum)
export type TradingMode = "MOCK" | "LIVE";

// Tenant
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  config: Record<string, unknown> | null;
  createdAt: string;
}

// Kill switch status
export interface KillSwitchStatus {
  killSwitch: boolean;
}

// Strategy type definitions with default params
export const STRATEGY_TYPES: Record<
  string,
  { label: string; defaultParams: Record<string, number> }
> = {
  SimpleSpreadStrategy: {
    label: "Spread Strategy",
    defaultParams: {
      spreadOffset: 100000000,
      orderQuantity: 1000000,
    },
  },
  MomentumStrategy: {
    label: "Momentum Strategy",
    defaultParams: {
      windowSize: 20,
      threshold: 50000000,
      orderQuantity: 1000000,
    },
  },
};

// Symbol ID → name mapping (matches SymbolRegistry.h defaults)
export const SYMBOL_MAP: Record<number, { name: string; venue: string }> = {
  1: { name: "BTCUSDT", venue: "Binance" },
  2: { name: "ETHUSDT", venue: "Binance" },
  100: { name: "RELIANCE", venue: "NSE" },
  101: { name: "TCS", venue: "NSE" },
  102: { name: "INFY", venue: "NSE" },
};

// Venue ID → name mapping
export const VENUE_MAP: Record<number, string> = {
  0: "Unknown",
  1: "Binance",
  2: "NSE",
};

// Side mapping (matches SBE schema: Unknown=0, Buy=1, Sell=2)
export const SIDE_MAP: Record<number, string> = {
  0: "Unknown",
  1: "Buy",
  2: "Sell",
};

// Valid status transitions
export const STATUS_TRANSITIONS: Record<StrategyStatus, StrategyStatus[]> = {
  PENDING: ["RUNNING"],
  RUNNING: ["PAUSED", "STOPPED"],
  PAUSED: ["RUNNING", "STOPPED"],
  STOPPED: ["RUNNING"],
};

// ── Strategy Marketplace ──────────────────────────────────────────────

export type StrategyCategory =
  | "MARKET_MAKING"
  | "MOMENTUM"
  | "ARBITRAGE"
  | "MEAN_REVERSION"
  | "TREND_FOLLOWING"
  | "STATISTICAL";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface StrategyTemplate {
  id: string;
  name: string;
  slug: string;
  description: string;
  longDescription: string | null;
  type: string;
  category: StrategyCategory;
  riskLevel: RiskLevel;
  params: Record<string, number>;
  symbolIds: number[];
  version: string;
  returnPct: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalTrades: number;
  featured: boolean;
  active: boolean;
  minCapital: number;
  maxDrawdownPct: number | null;
  createdAt: string;
  updatedAt: string;
  _count?: { subscriptions: number };
  isSubscribed?: boolean;
  subscriptionStrategyId?: string | null;
}

export interface StrategySubscription {
  id: string;
  tenantId: string;
  templateId: string;
  strategyId: string;
  subscribedAt: string;
  subscribedBy: string | null;
}

export const STRATEGY_CATEGORIES: Record<
  StrategyCategory,
  { label: string; color: string }
> = {
  MARKET_MAKING: { label: "Market Making", color: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  MOMENTUM: { label: "Momentum", color: "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" },
  ARBITRAGE: { label: "Arbitrage", color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
  MEAN_REVERSION: { label: "Mean Reversion", color: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" },
  TREND_FOLLOWING: { label: "Trend Following", color: "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400" },
  STATISTICAL: { label: "Statistical", color: "bg-pink-50 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400" },
};

export const RISK_LEVEL_STYLES: Record<
  RiskLevel,
  { label: string; color: string }
> = {
  LOW: { label: "Low Risk", color: "text-green-600 dark:text-green-400" },
  MEDIUM: { label: "Medium Risk", color: "text-yellow-600 dark:text-yellow-400" },
  HIGH: { label: "High Risk", color: "text-red-600 dark:text-red-400" },
};

// ── Trading Mode ─────────────────────────────────────────────────────

export const TRADING_MODE_STYLES: Record<
  TradingMode,
  { label: string; color: string; bg: string; borderColor: string; dot: string }
> = {
  MOCK: {
    label: "Paper Trading",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/30",
    borderColor: "border-blue-300 dark:border-blue-500/30",
    dot: "bg-blue-400",
  },
  LIVE: {
    label: "Live Trading",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-900/30",
    borderColor: "border-red-300 dark:border-red-500/30",
    dot: "bg-red-500",
  },
};

// ── Square Off ───────────────────────────────────────────────────────

export interface SquareOffRequest {
  scope: "strategy" | "tenant";
  strategyId?: string;
  tenantId?: string;
  activateKillSwitch?: boolean;
}

export interface SquareOffDetail {
  symbolId: number;
  position: number;
  closingSide: string;
}

export interface SquareOffResult {
  success: boolean;
  scope: string;
  strategiesPaused: number;
  killSwitchActivated: boolean;
  symbolsSquaredOff: number;
  details: SquareOffDetail[];
  source: string;
}

// ── Table System Types ──────────────────────────────────────────────

export interface SortingState {
  id: string;
  desc: boolean;
}

// Column meta for server-side validation
export interface ColumnMeta {
  accessorKey: string;
  serverSortable: boolean;
  serverFilterable: boolean;
  filterType?: "select" | "text" | "number" | "date" | "dateRange";
  filterOptions?: { label: string; value: string }[];
  questdbColumn?: string;
}

