# Mach-Zero — Feature & Quality Checklist

> Generated: 2026-03-14 | Current: 117 C++ tests, 125 web tests passing

---

## Legend
- ✅ Done
- 🔲 To Do
- 🔶 Partially Done

---

## 1. Authentication & Authorization
- ✅ NextAuth v5 credentials provider (JWT sessions)
- ✅ Role-based access: SUPER_ADMIN, ADMIN, RISK_MANAGER, TRADER, VIEWER
- ✅ `requireAuth()` guard on all API routes (401/403)
- ✅ `requirePageAuth()` guard on all Server Component pages
- ✅ Middleware protecting all routes except `/login`, `/api/auth/*`, `/api/health`
- ✅ Role-based nav filtering (`filterNavByRole`)
- ✅ User info in sidebar (name, tenant, initials avatar)
- ✅ Sign-out button in sidebar
- ✅ Session expiry detection (401 → redirect to `/login`)
- ✅ Login page in `(auth)` route group with its own layout (no sidebar/header)
- 🔲 Session expiry handling in all polling hooks (only TradingModeContext has it)
- 🔲 Password change / profile settings page
- 🔲 Hardcoded `NEXTAUTH_SECRET` fallback — should fail in production if env var missing

---

## 2. Strategy Management
- ✅ Strategy CRUD (create, read, update, delete)
- ✅ Status state machine: PENDING → RUNNING ↔ PAUSED → STOPPED → RUNNING
- ✅ Per-strategy trading mode (MOCK / LIVE) with confirmation gate (HTTP 428)
- ✅ Per-strategy square-off with confirmation
- ✅ "Square Off All" on Strategies page (tenant scope + kill switch)
- ✅ Strategy create/edit forms with parameters
- ✅ Capital pool allocation per strategy
- ✅ Live metrics display (position, unrealized/realized PnL, fill count)
- ✅ Strategy card with Start/Resume/Restart/Pause/Stop/Delete buttons
- 🔲 Strategy duplication (clone existing strategy)
- 🔲 Strategy performance history / mini-chart per card
- 🔲 Bulk actions (start/stop/pause multiple strategies)

---

## 3. Risk Management
- ✅ Kill switch panel (activate/deactivate via C++ engine or local fallback)
- ✅ Square-off panel (tenant-level, "type SQUARE OFF" confirmation)
- ✅ Risk metrics display
- ✅ Risk events table with QuestDB backend
- ✅ C++ risk engine: 5 checks (PositionLimit, OrderRate, MaxOrderSize, PriceBand, KillSwitch)
- 🔲 Configurable risk limits per strategy from UI (currently only via create/edit form params)
- 🔲 Real-time risk alerts / notifications on breaches
- 🔲 Risk dashboard charts (drawdown curve, exposure over time)

---

## 4. Dashboard
- ✅ Summary cards (total PnL, positions, trades, etc.)
- ✅ Positions table with live data via WebSocket (Python bridge)
- ✅ Market data panel
- ✅ PnL chart
- 🔲 Page is fully `"use client"` — should be Server Component with client leaf components
- 🔲 Dashboard customization (drag/rearrange widgets)

---

## 5. Trades & Orders
- ✅ Tabbed view: Trades / Orders / Risk Events
- ✅ QuestDB-backed with pagination
- ✅ Filter toolbar (symbol, side, status, mode)
- 🔲 Page is fully `"use client"` — should use Server Component pattern
- 🔲 Export trades to CSV
- 🔲 Real-time trade push (WebSocket) instead of polling
- 🔲 SQL injection fix — sanitize user input in QuestDB query routes (`/api/trades`, `/api/orders`, `/api/risk-events`)

---

## 6. Reports
- ✅ Performance Overview (daily PnL, summary, side breakdown)
- ✅ Execution Quality (fill rate, order stats, reject reasons)
- ✅ Volume Analytics (by symbol, hourly, buy/sell ratio)
- ✅ Period selector (1D / 7D / 30D)
- ✅ Recharts-based charts (bar, pie, area)
- 🔲 Page is fully `"use client"` — should use Server Component pattern
- 🔲 Export reports to PDF

---

## 7. Marketplace
- ✅ Strategy template catalog
- ✅ Template detail modal
- ✅ Subscribe/unsubscribe flow
- ✅ Server + Client component split
- 🔲 Template reviews / ratings
- 🔲 Template search / filtering

---

## 8. User & Tenant Management
- ✅ Users page with CRUD (create, list, edit, delete) — role-gated SUPER_ADMIN + ADMIN
- ✅ Tenants page (read-only) — SUPER_ADMIN only
- ✅ Accounts page (read-only) — role-scoped
- 🔲 Tenant CRUD (create, edit, delete tenants)
- 🔲 Account CRUD (create, edit, delete trading accounts)
- 🔲 Audit log viewer (AuditLog model exists in Prisma but no UI/API)

---

## 9. System & Settings
- ✅ Health check dashboard (QuestDB, kill-switch, bridge status)
- ✅ Architecture diagram
- ✅ Theme settings (dark mode)
- ✅ Trading mode settings
- 🔲 System logs viewer
- 🔲 Configuration management (engine params, gateway settings)

---

## 10. UI / UX Quality
- ✅ Error pages (`error.tsx`) for all 11 route segments + `global-error.tsx`
- ✅ Loading skeletons (`loading.tsx`) for all 11 route segments
- ✅ Responsive layout (sidebar collapses, mobile sidebar)
- ✅ Tailwind CSS 4 with CSS custom properties + dark mode
- ✅ Login page layout fix (should not show sidebar/header)
- ✅ Toast/notification system (sonner) wired across strategies, kill-switch, square-off, marketplace, accounts
- 🔲 Keyboard shortcuts for common actions
- 🔲 Empty states for tables/lists when no data

---

## 11. Code Quality & Architecture
- 🔲 Convert 5 `"use client"` pages to Server Components with client leaf components:
  - 🔲 `dashboard/page.tsx`
  - 🔲 `trades/page.tsx`
  - 🔲 `risk/page.tsx`
  - 🔲 `strategies/page.tsx`
  - 🔲 `reports/page.tsx`
- 🔲 Replace manual `setInterval` polling with SWR `refreshInterval` (strategies page)
- 🔲 Server Actions for form mutations (zero Server Actions currently — all use client `fetch()`)
- 🔲 SQL injection fix — sanitize QuestDB query parameters in 6 API routes
- 🔲 Fix `NEXTAUTH_SECRET` fallback to fail in production
- 🔲 Add `server-only` package to `lib/db.ts` and `lib/questdb.ts`
- 🔲 Fix incomplete `SymbolState` mocks in SquareOffPanel tests (missing fields)
- 🔲 Add `updatedAt` to `User` type in `types/index.ts`

---

## 12. Test Coverage

### Currently Tested (6 test files, 125 tests)
- ✅ `lib/utils.ts` — 33 tests
- ✅ `api/strategies/route.ts` — 29 tests
- ✅ `api/kill-switch/route.ts` — 9 tests
- ✅ `api/square-off/route.ts` — 13 tests
- ✅ `components/StrategyCard.tsx` — 29 tests
- ✅ `components/SquareOffPanel.tsx` — 12 tests

### API Routes — Not Tested (15 routes)
- 🔲 `/api/trades`
- 🔲 `/api/orders`
- 🔲 `/api/risk-events`
- 🔲 `/api/health`
- 🔲 `/api/capital`
- 🔲 `/api/accounts`
- 🔲 `/api/tenants`
- 🔲 `/api/users`
- 🔲 `/api/trading-mode`
- 🔲 `/api/reports/performance`
- 🔲 `/api/reports/execution`
- 🔲 `/api/reports/volume`
- 🔲 `/api/marketplace` (GET)
- 🔲 `/api/marketplace/[id]` (GET)
- 🔲 `/api/marketplace/subscribe` (POST)

### Components — Not Tested (24 components)
- 🔲 `SummaryCards`
- 🔲 `PositionsTable`
- 🔲 `MarketDataPanel`
- 🔲 `PnLChart`
- 🔲 `KillSwitchPanel`
- 🔲 `RiskMetrics`
- 🔲 `TradeBlotter`
- 🔲 `OrderHistory`
- 🔲 `RiskEventsTable`
- 🔲 `StrategyConfigForm`
- 🔲 `StrategyCreateForm`
- 🔲 `CapitalPanel`
- 🔲 `Sidebar`
- 🔲 `Header`
- 🔲 `MobileSidebar`
- 🔲 `MarketplaceClient`
- 🔲 `MarketplaceDetailModal`
- 🔲 `MarketplaceSubscribeModal`
- 🔲 `MarketplaceTemplateCard`
- 🔲 `UsersClient`
- 🔲 `UserForm`
- 🔲 `UserTable`
- 🔲 `ThemeSettings`
- 🔲 `TradingModeSettings`

### Hooks — Not Tested (8 hooks)
- 🔲 `usePositions`
- 🔲 `useTrades`
- 🔲 `useOrders`
- 🔲 `useRiskEvents`
- 🔲 `useKillSwitch`
- 🔲 `useSquareOff`
- 🔲 `useMounted`
- 🔲 `useReports`

### Context — Not Tested
- 🔲 `TradingModeContext`

---

## 13. Infrastructure & Deployment
- ✅ Docker Compose (7 services: postgres, questdb, aeron-driver, gateway, engine, risk-monitor, persistence)
- ✅ Mock exchange gateway (Docker profile: mock)
- ✅ Dockerfiles for all C++ services
- ✅ CI pipeline (GitHub Actions: C++ build/test + web lint/test)
- ✅ Makefile (`make all`, `make test`, `make build-cpp`, `make test-web`, `make lint`, `make clean`)
- ✅ Prisma schema with 8 models + seed script
- ✅ QuestDB schema (trades, orders, risk_events tables)
- 🔲 Python bridge not in docker-compose (dashboard live data depends on it)
- 🔲 No Dockerfile for Next.js web app
- 🔲 No production deployment config (Vercel / K8s / etc.)
- 🔲 No environment variable documentation (.env.example)

---

## 14. C++ Engine (Phase 2 Remaining)
- ✅ In-memory order book with pool allocator
- ✅ Binance depth stream integration
- 🔶 Binance REST gateway (directory exists, scaffolded but not production-ready)
- 🔶 NSE ITCH market data gateway (simulator exists, not production-ready)
- 🔶 NSE Order Entry gateway (scaffolded)
- 🔲 Backtesting web UI (C++ backtesting framework exists, no web interface)

---

## Priority Order (Recommended)

### 🔴 P0 — Security & Correctness
1. ✅ SQL injection guarantees on QuestDB query routes — audit complete; all 6 routes route every user input through whitelist validators (`validateTradingMode`, `validateOrderStatus`, `validateRiskReason`, `validateTimestamp`, `validateDays`) or numeric clamping. 54 regression tests in `lib/__tests__/questdb-sanitize.test.ts` cover injection attempts (`'; DROP --`, `' OR 1=1`, null bytes, ORDER BY tampering, etc.).
2. ✅ Fix `NEXTAUTH_SECRET` fallback — `requireSecret()` in `lib/auth.ts` fails fast in production, blocks the dev-compose default value
3. ✅ SBE tenant isolation (see `docs/0001-sbe-tenant-isolation.md`) — branch `feat/sbe-tenant-isolation`, 9 commits, 151 C++ + 216 web tests green

### 🟠 P1 — Core Functionality Gaps
4. Tenant CRUD
5. Account CRUD
6. Audit log viewer

### 🟡 P2 — Architecture & Code Quality
8. Server Component refactor (5 pages)
9. SWR polling instead of setInterval
10. Server Actions for mutations
11. Add `server-only` to DB modules

### 🔵 P3 — Test Coverage
12. API route tests (15 routes)
13. Component tests (critical ones: KillSwitchPanel, StrategyForms, Sidebar)
14. Hook tests

### ⚪ P4 — Nice to Have
15. Export trades to CSV / reports to PDF
16. Strategy duplication
17. Python bridge in docker-compose
18. Dockerfile for web app
19. .env.example documentation
