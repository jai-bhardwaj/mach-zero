# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Mach-Zero is a **polyglot monorepo** for an ultra-low-latency algorithmic trading system. Two halves that communicate only over Aeron/QuestDB/HTTP — there is no shared language between them:

- **C++20 engine** (`core/`, `apps/{engine,gateways,persistence,risk-monitor}/`, `common/`) — real-time hot path. Built with CMake + FetchContent, runs on an Oracle Cloud ARM VM inside Docker Compose.
- **Next.js 16 dashboard** (`apps/web/`) — operator UI. Deployed to Vercel, backed by Supabase Postgres (via Prisma) + QuestDB (read-only, for trades/risk events).
- **Python research bridge** (`research/`) — backtesting and Jupyter notebooks that read engine state via shared memory.

`apps/web/CLAUDE.md` has detailed Next.js/React conventions — read it before editing anything under `apps/web/`.

## Build & test commands

Top-level `Makefile` orchestrates both halves:

```bash
make build         # build-cpp + build-web
make test          # test-cpp + test-web + lint
make build-cpp     # cmake -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build -j
make test-cpp      # ctest --output-on-failure --timeout 60 (117 Google Test cases)
make build-web     # cd apps/web && npm run build
make test-web      # cd apps/web && npx vitest run
make lint          # cd apps/web && npm run lint
make clean         # rm -rf build apps/web/.next
```

### C++ single test

```bash
./build/core/tests/mach_zero_tests --gtest_filter="LatencyRegression.*"
./build/core/tests/mach_zero_tests --gtest_filter="RiskEngineTest.KillSwitch*"
```

Latency regressions have hard ceilings (e.g. risk gate p99 < 100ns) — if a perf test fails, do not loosen the threshold to pass; fix the regression.

### Web single test

```bash
cd apps/web && npx vitest run path/to/file.test.ts
cd apps/web && npx vitest                     # watch mode
```

Tests live in `apps/web/**/__tests__/*.test.{ts,tsx}` (see `vitest.config.ts`). Environment is jsdom.

### Web dev

```bash
cd apps/web
npm install --legacy-peer-deps    # peer-deps are intentionally out of sync
cp .env.example .env.local        # fill in secrets
npx prisma db push                # migrate
npx tsx prisma/seed.ts            # seed
npm run dev
```

Always use `--legacy-peer-deps` with `npm install` in `apps/web/` — the lockfile was produced with it.

## Architecture — hot path

The engine is a set of independent processes connected by **Aeron IPC** (not TCP — shared-memory ring buffers). Each stream has a well-known ID:

| Stream ID | Name | Producer → Consumer |
|-----------|------|---------------------|
| 1001 | MARKET_DATA | gateways → strategy engine |
| 1002 | ORDER | strategy engine → risk gate |
| 1003 | RISK | risk monitor ↔ engine (events + kill-switch commands) |
| 1004 | PERSISTENCE | all → QuestDB sink |
| 1005 | VALIDATED_ORDER | risk gate → venue-specific order gateway |
| 1006 | ACK | exchange gateway → strategy engine |

All messages are SBE-encoded per `common/schemas/market_data.xml`; generated headers live in `core/include/mach_zero_market_data/`. **Prices are fixed-point int64 with 8 decimals** (1.0 = 100_000_000) — never `double` on the hot path.

Add a new message type by editing the SBE XML, regenerating headers (`sbe-all.jar` at repo root), and updating producers and consumers in lockstep. Mismatched schemas between gateway and engine will silently corrupt messages.

### Risk gate

`core/src/risk/` runs 5 pre-trade checks in <100ns p99: KillSwitch (atomic bool), PriceBand, PositionLimit, OrderRate, MaxOrderSize. Orders flow strategy engine → risk gate → VALIDATED_ORDER stream → exchange gateway. No order reaches an exchange without passing this gate. The kill switch is the only cross-process control that can halt trading — exposed via HTTP on port 8080 from `apps/risk-monitor/`.

### Running the full stack locally

```bash
./infra/tuning/start_media_driver.sh              # Aeron media driver (Java)
./build/apps/gateways/binance-ws/binance_gateway  # each in its own terminal
./build/apps/engine/strategy_engine
./build/apps/risk-monitor/risk_monitor
./build/apps/persistence/persistence_service
```

Or `cd infra && docker compose up -d` (use `docker-compose.prod.yml` on the Oracle VM).

## Architecture — web dashboard

`apps/web/` is **Next.js 16 App Router with Server Components by default**. The web app reads from two data sources:

- **Prisma/Postgres (Supabase)** — user/tenant/strategy/account config. Write path. `lib/db.ts` is `import "server-only"`. `DATABASE_URL` uses the Supabase Supavisor pooler (port 6543, `?pgbouncer=true`); `DIRECT_DATABASE_URL` uses the direct host (port 5432) for Prisma migrations.
- **QuestDB** — trades, quotes, risk events. Read-only from web. `lib/questdb.ts` is `import "server-only"`.

The web app talks to the live engine via HTTP to the Oracle VM: kill switch API (port 8080) and the Python bridge WebSocket (port 3002, `NEXT_PUBLIC_BRIDGE_WS_URL`). Never import engine code into the web app — they share no types.

### Auth

NextAuth v5 with JWT sessions. After tenant/role changes, the JWT must be refreshed with `updateSession({ refresh: true })` or via a hard navigation — recent commits (`bd8bd69`, `c6b24f9`, `fff33e2`) fix stale-tenant bugs caused by stale JWTs. If you're touching anything that mutates `session.user.tenantId` or `session.user.role`, verify the JWT refresh path.

Roles: `SUPER_ADMIN`, `ADMIN`, `RISK_MANAGER`, `TRADER`, `VIEWER`. Enforced by `requireAuth()` (API) and `requirePageAuth()` (pages). Nav items are filtered by role (`lib/nav-items.ts`).

### Trading mode gate

`MOCK` vs `LIVE` mode is per-strategy. Transitioning to `LIVE` returns **HTTP 428 (Precondition Required)** to force an explicit confirmation — do not bypass this when adding new mutation endpoints.

## Deployment

- **Vercel** auto-deploys `apps/web/` on push to `main`. Root Directory set to `apps/web`. Build command `npx prisma generate && npm run build` (per `vercel.json`).
- **Oracle VM** is updated via GitHub Actions SSHing in and running `docker compose -f infra/docker-compose.prod.yml up -d --build`.
- **Supabase** migrations are run manually from a dev machine with `DATABASE_URL` + `DIRECT_DATABASE_URL` pointed at Supabase. Supabase free-tier projects auto-pause after 7 days of inactivity and are eligible for deletion after ~90 days paused — keep at least one cron-equivalent ping or upgrade the plan for production projects.

Full step-by-step in `DEPLOY.md`. Environment variable list is in `apps/web/.env.production.example`.

## Conventions

- **No `double` for prices in C++.** Always fixed-point int64.
- **No `any` in TypeScript.** `strict: true`. Prefer `unknown` for dynamic data.
- **Default to Server Components.** Push `"use client"` to the smallest leaf that needs it. Details in `apps/web/CLAUDE.md`.
- **C++ tests use `ManualClock`** from `common/clock/` — never `std::chrono::system_clock` inside logic that needs to be testable.
- **Latency benchmarks** (`test_latency_regression.cpp`) gate CI. Measured on Apple M-series; adjust budgets only with justification, not to pass a flaky run.
