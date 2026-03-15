# Mach-Zero: Table, Filter & Sorting Improvement Checklist

> Informed by deep research into **Attio**, **Notion**, and **Clay** table architectures.
> Prioritized by impact for a trading dashboard context.

---

## Current State Assessment

| Aspect | Status | Notes |
|--------|--------|-------|
| Table rendering | Basic HTML `<table>` | No virtualization, no column definitions |
| Filtering | Select dropdowns only | No text search, no date range, no compound filters |
| Sorting | Not implemented | Hardcoded `ORDER BY timestamp DESC` |
| Pagination | Working (offset-based) | No page size selector, no "go to page" |
| URL persistence | Not implemented | Filters/sort/page lost on refresh |
| Column management | Not implemented | No hide/show, resize, reorder |
| Loading states | Text only ("Loading...") | No skeleton/shimmer UI |
| @tanstack/react-table | Installed but unused | v8.21.3 in package.json |
| Error states in tables | Minimal | Just "No X found" |

---

## Phase 1: Fix What's Broken (P0 — must-have)

### 1.1 Column-Header Sorting
**Pattern from**: Attio (multi-column hierarchical), Notion (property + direction tuples), Clay (priority hierarchy)

- [ ] Add `sortKey` and `sortable: boolean` to column definitions
- [ ] Add `orderBy` query param to `/api/trades`, `/api/orders`, `/api/risk-events`
- [ ] Update `queryPaginated()` to accept dynamic `orderBy` from request (not hardcoded)
- [ ] Validate `orderBy` server-side against allowed column names (prevent SQL injection)
- [ ] Add click-to-sort on `<TableHead>` — toggle ASC → DESC → none
- [ ] Show sort direction indicator (▲/▼ arrow or chevron) on active column
- [ ] Reset to page 1 when sort changes (like filter changes already do)
- [ ] Support single-column sort initially (multi-column is Phase 2)

**Files**: `lib/questdb.ts`, `api/trades/route.ts`, `api/orders/route.ts`, `api/risk-events/route.ts`, `components/ui/table.tsx`, `TradeBlotter.tsx`, `OrderHistory.tsx`, `RiskEventsTable.tsx`

### 1.2 URL State Persistence
**Pattern from**: All three — Attio uses server-side view persistence, Notion uses view objects, Clay uses views. For a trading dashboard, **URL params** are the right fit (shareable, bookmarkable, back-button works).

- [ ] Use `useSearchParams()` + `useRouter()` to sync filter/sort/page state to URL
- [ ] On mount, read URL params to initialize filter values and offset
- [ ] On filter/sort/page change, push to URL with `router.replace()` (not `router.push` to avoid history spam)
- [ ] Handle tab state in URL: `?tab=trades&symbol_id=1&sort=price&dir=desc&offset=25`
- [ ] Preserve filters when navigating away and back (URL does this naturally)

**Files**: `app/(app)/trades/page.tsx` (main), create `hooks/useTableParams.ts` (reusable)

### 1.3 Column Definition System
**Pattern from**: Notion (typed columns with per-type operators), Attio (custom labels, typed attributes)

- [ ] Create `ColumnDef<T>` type with: `key`, `label`, `sortable`, `type` (text/number/date/enum/badge), `align`, `render`, `format`
- [ ] Define column arrays for trades, orders, risk events (replace hardcoded JSX headers)
- [ ] Render table headers and cells from column definitions (loop, not manual JSX)
- [ ] This enables sorting, visibility toggles, and column reorder in later phases

**Files**: Create `lib/columns.ts`, update `TradeBlotter.tsx`, `OrderHistory.tsx`, `RiskEventsTable.tsx`

### 1.4 Loading Skeletons
**Pattern from**: Notion (shimmer rows), Attio (React Data List `renderPendingRows`)

- [ ] Create `<TableSkeleton rows={10} cols={6} />` component with animated shimmer
- [ ] Replace all "Loading trades/orders/events..." text with skeleton tables
- [ ] Add `loading.tsx` for the trades route segment (Next.js streaming)
- [ ] Use `keepPreviousData: true` (already done in SWR) + subtle opacity transition when refetching

**Files**: Create `components/ui/table-skeleton.tsx`, update `TradeBlotter.tsx`, `OrderHistory.tsx`, `RiskEventsTable.tsx`, create `app/(app)/trades/loading.tsx`

### 1.5 Page Size Selector
**Pattern from**: Notion (10/25/50/100 load limits), Clay (row limits in toolbar)

- [ ] Add page size dropdown to `<Pagination>` component: 10, 25, 50, 100
- [ ] Store page size in URL params
- [ ] Reset offset to 0 when page size changes
- [ ] Pass dynamic `limit` to SWR hooks

**Files**: `components/ui/pagination.tsx`, `app/(app)/trades/page.tsx`

---

## Phase 2: Professional Table UX (P1 — high value)

### 2.1 Enhanced Filter System
**Pattern from**: Attio (filter chips + compound $and/$or/$not), Notion (recursive filter tree with type-aware operators), Clay (filter groups up to 2 levels deep)

#### 2.1a Date Range Filter
- [ ] Add date range picker for `timestamp` column (start + end)
- [ ] Pass `start` and `end` params to QuestDB queries
- [ ] Add preset ranges: "Last 1h", "Last 24h", "Last 7d", "Today", "Custom"
- [ ] Show active date range as a filter chip/pill

#### 2.1b Text Search / Global Filter
- [ ] Add search input to toolbar for order ID, strategy name, symbol text search
- [ ] Debounce input (300ms) before triggering API call
- [ ] Highlight matching text in results (optional, Phase 3)

#### 2.1c Filter Chips
**Pattern from**: Attio (pills with X to remove), Notion (filter tags)

- [ ] Replace select dropdowns with a "Add Filter" button that opens a popover
- [ ] Show active filters as removable chips/pills below the toolbar
- [ ] Each chip shows: `Column: Value` with an X button
- [ ] "Clear all" button when any filters are active

### 2.2 Adopt @tanstack/react-table
Already installed (v8.21.3). This gives us sorting, filtering, pagination, column visibility, and column ordering for free.

- [ ] Create `useDataTable<T>()` wrapper hook that configures TanStack table
- [ ] Migrate `TradeBlotter` to use TanStack table with column defs
- [ ] Migrate `OrderHistory` to use TanStack table
- [ ] Migrate `RiskEventsTable` to use TanStack table
- [ ] Keep server-side filtering/sorting (TanStack supports `manualSorting`, `manualFiltering`, `manualPagination`)
- [ ] Wire TanStack's `onSortingChange` → URL params → SWR refetch → server sort

**Key TanStack features to enable**:
- `getCoreRowModel()` — base rendering
- `getSortedRowModel()` — client sort (or `manualSorting: true` for server)
- `getFilteredRowModel()` — client filter (or `manualFiltering: true`)
- `getPaginationRowModel()` — client pagination (or `manualPagination: true`)
- Column visibility state
- Column pinning

### 2.3 Column Visibility Toggle
**Pattern from**: Attio (hide/show per-view, immediately affects all users), Notion (toggle per-view, personal vs shared), Clay (hide/show from column header or Columns menu)

- [ ] Add "Columns" button to toolbar that opens a popover/dropdown
- [ ] Show checkboxes for each column with labels
- [ ] Persist column visibility in `localStorage` (per-table key)
- [ ] Show at least 2 columns always (prevent hiding everything)

### 2.4 Column Resizing
**Pattern from**: Attio (drag column border), Clay (drag handles), Notion (drag column border)

- [ ] Add resize handles on column header borders
- [ ] CSS `cursor: col-resize` on hover
- [ ] Store widths in state, apply via `style={{ width }}` or CSS custom properties
- [ ] Persist column widths in `localStorage`
- [ ] Double-click resize handle to auto-fit column width

### 2.5 Empty & Error States
**Pattern from**: Attio (React Data List `renderEmpty`), Notion (empty database prompts)

- [ ] Create `<EmptyState icon={} title="" description="" action={} />` component
- [ ] Trade-specific empty: "No trades recorded yet. Start a strategy to see executions."
- [ ] Filtered empty: "No results match your filters." + "Clear filters" button
- [ ] Error state: "Failed to load trades. Retrying..." + manual retry button
- [ ] Differentiate between "no data exists" vs "no data matches filters"

### 2.6 Row Actions
- [ ] Add a kebab menu (⋮) or action column to order rows
- [ ] Actions: "View Details", "Cancel Order" (for active orders)
- [ ] Click row to expand detail panel (or open slide-over)
- [ ] Add row click handler with visual feedback (highlight on hover already exists)

---

## Phase 3: Power Features (P2 — nice to have)

### 3.1 Multi-Column Sort
**Pattern from**: Attio (drag to reorder sort rules), Notion (ordered sort array), Clay (priority hierarchy with drag reorder)

- [ ] Allow adding multiple sort rules (primary, secondary, tertiary)
- [ ] Show sort priority numbers on column headers (1▲, 2▼)
- [ ] Drag to reorder sort rules in the sort popover
- [ ] Server-side: `ORDER BY col1 ASC, col2 DESC`

### 3.2 Compound Filters (AND/OR)
**Pattern from**: Attio (boolean tree composition with $and/$or/$not), Notion (recursive filter tree, 3-level nesting in UI), Clay (filter groups up to 2 levels deep)

- [ ] Allow toggling AND/OR between filter conditions
- [ ] Filter groups: nest filters inside an AND or OR group
- [ ] Limit to 2 levels of nesting (Clay's approach — simpler than Notion's 3)
- [ ] Visual: indented filter groups with AND/OR toggle between them
- [ ] Server-side: build nested WHERE clause from filter tree

### 3.3 Column Pinning / Freezing
**Pattern from**: Attio (first column always pinned), Notion ("Freeze up to column"), Clay (pin columns)

- [ ] Pin first column (symbol/time) by default
- [ ] Allow right-click → "Pin column" on any column
- [ ] Pinned columns stay fixed during horizontal scroll
- [ ] Use sticky positioning (`position: sticky; left: 0; z-index: 1`)

### 3.4 Keyboard Navigation
**Pattern from**: Attio (arrow keys across cells, Enter to edit, copy/paste), Notion (arrow key navigation, Enter to open row)

- [ ] Arrow keys to move between rows
- [ ] Enter to expand row detail
- [ ] Escape to close detail panel
- [ ] Cmd/Ctrl+C to copy cell value
- [ ] `j`/`k` for Vim-style row navigation (trading tool power users)

### 3.5 CSV Export
- [ ] "Export" button in toolbar
- [ ] Export current view (with active filters applied)
- [ ] Include all columns or only visible columns (user choice)
- [ ] Server-side export for large datasets (stream via API route)
- [ ] Filename: `trades_2024-01-15_filtered.csv`

### 3.6 Saved Views / Presets
**Pattern from**: Attio (named views with saved filter/sort/columns, shared across team), Notion (multiple views per database, personal vs shared), Clay (views with filters/sorts/column visibility/colors)

- [ ] Save current filter + sort + column config as a named "view"
- [ ] Store views in PostgreSQL (per-user, per-table)
- [ ] View switcher tabs/dropdown above the table
- [ ] Preset views: "All Trades", "Filled Only", "Today's Orders", "Risk Breaches"
- [ ] Share views across team members (Attio pattern)

### 3.7 Virtual Scrolling (if needed)
**Pattern from**: Attio (React Data List — open source, only renders viewport + buffer), Notion (row virtualization), Clay (likely react-virtualized or TanStack Virtual)

- [ ] Only needed if tables regularly exceed 100+ visible rows
- [ ] Use `@tanstack/react-virtual` for row virtualization
- [ ] Keep offset-based pagination for server data (like Attio's API)
- [ ] Render only visible rows + 5-row overscan buffer
- [ ] Fixed row height for simpler virtualization math

**Note**: With current 25-row pages, virtualization isn't needed yet. Prioritize only if page size increases to 100+ or infinite scroll is added.

---

## Phase 4: Real-Time & Advanced (P3 — future)

### 4.1 WebSocket for Table Updates
**Pattern from**: Attio (Pusher WebSockets + live cursors), Notion (WebSocket MessageStore for version updates)

- [ ] Replace 5-second SWR polling with WebSocket push for trades/orders
- [ ] New trade/order events push to client, prepend to table
- [ ] Visual indicator: "3 new trades" banner above table (click to load)
- [ ] Fallback to polling if WebSocket disconnects
- [ ] Keep SWR for initial load, WebSocket for incremental updates

### 4.2 Inline Cell Editing (for editable tables)
**Pattern from**: Attio (click to select, Enter to edit, Enter to save), Clay (inline cell editing with undo/redo)

- [ ] For strategy table: click to edit strategy name, risk params
- [ ] For user table: click to edit role, status
- [ ] Optimistic updates with SWR `mutate()`
- [ ] Validation on blur/Enter, revert on Escape
- [ ] Not applicable to trade/order tables (read-only data)

### 4.3 Column Reordering (Drag & Drop)
**Pattern from**: Attio (drag column headers), Notion (drag headers), Clay (drag or right-click move)

- [ ] Drag and drop column headers to reorder
- [ ] Use `@dnd-kit/sortable` for drag UX
- [ ] Persist column order in `localStorage`
- [ ] Reset to default order button

### 4.4 Responsive Table Improvements
- [ ] Card layout on mobile (< 768px) instead of horizontal scroll
- [ ] Each card shows key fields with expandable detail
- [ ] Swipe gestures for mobile table navigation
- [ ] Priority columns shown first on small screens

---

## Architecture Recommendations

### Data Flow (inspired by Attio + Notion)

```
URL Params (source of truth for filters/sort/page)
    ↓
useTableParams() hook (reads/writes URL)
    ↓
SWR hook (useTrades/useOrders) with URL-derived params
    ↓
API Route → queryPaginated() with validated sort/filter
    ↓
QuestDB (server-side filter + sort + paginate)
    ↓
PaginatedResponse<T> → TanStack Table (render)
```

### Key Architectural Decisions

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Filter/sort state | URL params | Shareable, bookmarkable, back-button works. Trading dashboards are used by teams. |
| Sorting | Server-side | QuestDB handles sort efficiently; client-side sort on paginated data is misleading |
| Filtering | Server-side | Already implemented; keep security boundary |
| Column visibility | localStorage | Per-user preference, not shared team state |
| Column definitions | Typed array config | Single source of truth for headers, render, sort, filter |
| Table library | @tanstack/react-table | Already installed, battle-tested, supports manual server-side operations |
| Virtualization | Defer until needed | 25-row pages don't need it; add if page size goes 100+ |
| Real-time updates | WebSocket (Phase 4) | SWR polling is fine for now; WS adds complexity |

### Operator Matrix (from Notion's approach — operators per column type)

| Column Type | Operators |
|------------|-----------|
| **Text** (symbol, status) | equals, not equals, contains |
| **Number** (price, qty, PnL) | =, ≠, >, <, ≥, ≤ |
| **Date** (timestamp) | before, after, between, last 1h/24h/7d |
| **Enum** (side, status, mode) | is, is not, is any of |
| **Boolean** (active) | is true, is false |

### File Structure for New Components

```
components/
├── ui/
│   ├── data-table.tsx              # TanStack-powered table component
│   ├── data-table-toolbar.tsx      # Enhanced toolbar (filters, sort, columns, export)
│   ├── data-table-filter-chips.tsx # Active filter chips with remove
│   ├── data-table-column-toggle.tsx# Column visibility popover
│   ├── data-table-sort-header.tsx  # Sortable column header with indicator
│   ├── table-skeleton.tsx          # Shimmer loading skeleton
│   ├── empty-state.tsx             # Configurable empty/error states
│   └── pagination.tsx              # Enhanced with page size selector
hooks/
├── useTableParams.ts               # URL ↔ table state sync
├── useDataTable.ts                 # TanStack table wrapper
lib/
├── columns.ts                      # Column definitions for all tables
├── filter-operators.ts             # Type-aware filter operator config
```

---

## Priority Order for Implementation

```
Week 1:  1.1 (sorting) + 1.2 (URL persistence) + 1.3 (column defs)
Week 2:  1.4 (skeletons) + 1.5 (page size) + 2.5 (empty/error states)
Week 3:  2.2 (TanStack adoption) + 2.1a (date range) + 2.1c (filter chips)
Week 4:  2.3 (column visibility) + 2.4 (column resize) + 2.1b (text search)
Week 5:  3.5 (CSV export) + 2.6 (row actions) + 3.3 (column pinning)
Week 6+: 3.1 (multi-sort) + 3.2 (compound filters) + 3.6 (saved views)
Future:  4.x (WebSocket, inline edit, drag reorder, virtual scroll)
```

---

## References

- **Attio**: React Data List (open-source virtualizer), Rust query engine, filter tree composition ($and/$or/$not), multi-column hierarchical sort, view-based persistence
- **Notion**: Recursive filter tree, type-aware operators per property, cursor-based pagination, WASM SQLite client cache, synchronized multi-grid for frozen columns, configurable load limits (10/25/50/100)
- **Clay**: Spreadsheet-paradigm UI, column pinning, 2-level nested filter groups, priority-based multi-sort, enrichment-aware filtered views, 50K row / 100 column limits
