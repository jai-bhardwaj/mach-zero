# Auth UI Gating, User Info, Session Expiry, Tests & Error/Loading Pages

## Step 1: Add SessionProvider to root layout
- Create `components/providers/SessionProvider.tsx` — thin "use client" wrapper that re-exports next-auth's `SessionProvider`
- Update `app/layout.tsx` to wrap children with `<AuthSessionProvider>` inside `ThemeProvider`
- This makes `useSession()` available to all Client Components (Sidebar, Header, MobileSidebar)

## Step 2: Role-based nav gating in Sidebar + MobileSidebar
- Extract shared NAV_ITEMS config to `lib/nav-items.ts` with a `roles?: string[]` field per item
  - `/users` → `["SUPER_ADMIN", "ADMIN"]`
  - `/system` → `["SUPER_ADMIN", "ADMIN"]`
  - `/tenants` → `["SUPER_ADMIN"]` (add to nav if not there)
  - All others → `undefined` (visible to everyone)
- In `Sidebar.tsx` and `MobileSidebar.tsx`:
  - Import `useSession()` from next-auth/react
  - Filter `NAV_ITEMS` by `session.user.role`
  - Replace the duplicated NAV_ITEMS array with the shared import

## Step 3: User info display in sidebar
- In `Sidebar.tsx` footer (expanded state): show user name + tenant name above the trading mode badge
  - Use `useSession()` to get `session.user.name` and `session.user.tenantName`
  - Collapsed state: show a user avatar circle with initials + tooltip
- In `MobileSidebar.tsx` footer: same user info display
- In `Header.tsx`: no changes (keep it focused on system status)

## Step 4: Session expiry handling
- Add an `onError` handler to the TradingModeContext `fetchMode()` — if a 401 is returned, redirect to `/login`
- This catches session expiry organically since TradingModeContext polls `/api/trading-mode` every 5 seconds
- Also add a simple `useSessionGuard()` hook in the SessionProvider that checks `useSession()` status — if `unauthenticated`, call `signIn()` to redirect to login

## Step 5: Auth test cases (401/403) for existing test files
- `strategies/__tests__/route.test.ts` — add tests:
  - 401 when requireAuth returns Unauthorized
  - 403 when requireAuth returns Insufficient permissions (e.g., VIEWER trying POST)
- `square-off/__tests__/route.test.ts` — add 401/403 tests
- `kill-switch/__tests__/route.test.ts` — add 401/403 tests (VIEWER trying POST)

## Step 6: Add error.tsx + loading.tsx to missing route segments
- Missing error.tsx: `/dashboard`, `/trades`, `/strategies`, `/risk`, `/system`, `/settings`
- Missing loading.tsx: ALL route segments (none exist currently)
- Follow existing pattern from `accounts/error.tsx` (customized title per page)
- loading.tsx: animate-pulse skeleton matching each page layout

## Files to create:
1. `components/providers/SessionProvider.tsx`
2. `lib/nav-items.ts`
3. `app/dashboard/error.tsx` + `app/dashboard/loading.tsx`
4. `app/trades/error.tsx` + `app/trades/loading.tsx`
5. `app/strategies/error.tsx` + `app/strategies/loading.tsx`
6. `app/risk/error.tsx` + `app/risk/loading.tsx`
7. `app/system/error.tsx` + `app/system/loading.tsx`
8. `app/settings/error.tsx` + `app/settings/loading.tsx`
9. `app/accounts/loading.tsx`
10. `app/tenants/loading.tsx`
11. `app/users/loading.tsx`
12. `app/marketplace/loading.tsx`
13. `app/reports/loading.tsx`

## Files to modify:
1. `app/layout.tsx` — wrap with SessionProvider
2. `components/layout/Sidebar.tsx` — useSession, filter nav, show user info
3. `components/layout/MobileSidebar.tsx` — useSession, filter nav, show user info
4. `contexts/TradingModeContext.tsx` — 401 detection in fetchMode
5. `app/api/strategies/__tests__/route.test.ts` — 401/403 tests
6. `app/api/square-off/__tests__/route.test.ts` — 401/403 tests
7. `app/api/kill-switch/__tests__/route.test.ts` — 401/403 tests
