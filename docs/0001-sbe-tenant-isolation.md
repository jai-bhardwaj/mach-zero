# SBE tenant isolation

Status: Draft
Authors: @jaibhardwaj
Target branch: `feat/sbe-tenant-isolation`
Estimated effort: 3–4 weeks focused (shared-tier), +2 weeks (dedicated-tier)

## Problem

One `strategy_engine` process serves all tenants today. The Aeron ORDER stream
carries every tenant's orders through one risk gate, one position map, and one
scheduler thread. This means:

- A runaway strategy in tenant A consumes CPU budget of tenant B — "noisy
  neighbor."
- One bug in position accounting can leak PnL across tenants.
- The risk gate's per-tenant limits cannot be enforced because messages don't
  identify their tenant.
- We cannot sell a "dedicated engine" tier because the engine is a singleton.

SBE messages carry no tenant identity. Tenants exist only in Postgres and on
the web side. The Aeron bus is the choke point where we lose that identity.

## Goals

- Every order-path SBE message carries `tenantId`.
- The engine partitions position, risk, and strategy state by `tenantId`.
- Kill switch is per-tenant (plus a global super-admin kill).
- Support two isolation tiers without a second codebase:
  - **Shared** — one engine process, N tenants, logical isolation.
  - **Dedicated** — one engine process per tenant (Pro/Enterprise).
- No regression in p99 latency on the shared tier beyond 2× current
  (83ns → ≤200ns). Dedicated tier must hold the current 100ns ceiling.

## Non-goals

- Cross-tenant market data isolation. `Trade`/`Quote` remain public feeds —
  every engine subscribes to the same MARKET_DATA stream. No `tenantId` on
  those messages.
- Per-tenant databases. Still one Postgres, one QuestDB, row-level tenant
  filtering.
- Full hot-reload of risk limits. We'll reload at engine startup + on an
  Aeron `ReloadLimits` command; no live mutation of in-flight state.

## Schema changes

Add `tenantId: uint32` to the following messages. `uint32` gives 4B tenants
and keeps alignment clean. 4 bytes added per message × ~5M messages/day is
negligible.

| Message | ID | Gets `tenantId`? | Rationale |
|---------|----|--------------------|-----------|
| Trade | 1 | No | Public market data |
| Quote | 2 | No | Public market data |
| OrderRequest | 10 | **Yes** | Originates with a tenant |
| OrderAck | 11 | **Yes** | Tenant's order lifecycle |
| OrderReject | 12 | **Yes** | Tenant's rejected order |
| CancelRequest | 13 | **Yes** | Tenant-scoped |
| Heartbeat | 99 | No | Sender is a process, not a tenant |
| RiskCommand | 20 | **Yes** | Per-tenant kill switch; `tenantId=0` = global |
| SquareOffCommand | 21 | **Yes** | Per-tenant square-off |

Bump `schemaId` from 1 → 2. `version` from 2 → 3. Regen headers via
`sbe-all.jar` into `core/include/mach_zero_market_data/`.

New schema error: if a consumer receives a message with `schemaId=1` after
cutover, reject and log `SchemaMismatch`. Do not attempt backward-compatible
decoding.

## Engine state partitioning (`core/src/`)

Every piece of per-tenant state becomes keyed by `(TenantId, SymbolId)`
instead of just `SymbolId`:

```cpp
// Before
std::unordered_map<SymbolId, Position> positions_;

// After
using TenantSymbol = std::pair<TenantId, SymbolId>;
std::unordered_map<TenantSymbol, Position, TenantSymbolHash> positions_;
```

Files touched:

- `core/src/strategy/StrategyEngine.h` — per-tenant strategy instances, not
  shared. One `StrategyInstance` per `(tenantId, strategyConfigId)`.
- `core/src/strategy/VenueRouter.h` — routing still by venue, but open-order
  tracking is per-tenant.
- `core/src/risk/RiskState.h` — positions, order rate windows, price bands
  all keyed by `(TenantId, SymbolId)`.
- `core/src/risk/PositionLimitCheck.h`, `OrderRateCheck.h`,
  `MaxOrderSizeCheck.h`, `PriceBandCheck.h` — read limits from per-tenant
  config loaded at startup.
- `core/src/risk/KillSwitch.h` — today one atomic bool. Change to an array
  indexed by `tenantId`, plus a global `adminKill` that overrides all.

Order book (`core/src/matching/`) stays public. Multiple tenants can trade
BTCUSDT and they share the same L2 view. This is correct — the order book
models the exchange, not any tenant's orders.

## Risk limit loading

At engine startup:

1. Query Postgres for all active tenants and their per-symbol limits.
2. Build `std::unordered_map<TenantId, TenantRiskConfig>` on the engine
   thread (off hot path).
3. Every `OrderRequest` hitting the risk gate looks up its tenant's config
   by `tenantId`. Missing tenant = reject with `InvalidTenant` (new reject
   reason, add to enum).

Hot-reload path:

- Admin UI publishes a `ReloadLimits` Aeron command with a target `tenantId`.
- Engine receives, re-queries Postgres for that tenant only, atomically
  swaps the config pointer (RCU-style).
- No lock on the hot path — readers hold a shared_ptr snapshot.

## Aeron channel strategy

Today all streams are `aeron:ipc` with stream IDs 1001–1006.

**Shared tier:** keep the single-channel model. Every engine-tagged message
carries `tenantId`; the engine filters in software.

**Dedicated tier:** add per-tenant channel suffixes for the order path only.
Market data stays global.

| Stream | Shared tier | Dedicated tier |
|--------|-------------|----------------|
| MARKET_DATA (1001) | `aeron:ipc` | `aeron:ipc` (shared subscribe) |
| ORDER (1002) | `aeron:ipc` | `aeron:ipc?alias=tenant-<id>` |
| VALIDATED_ORDER (1005) | `aeron:ipc` | `aeron:ipc?alias=tenant-<id>` |
| ACK (1006) | `aeron:ipc` | `aeron:ipc?alias=tenant-<id>` |
| RISK (1003) | `aeron:ipc` | `aeron:ipc?alias=tenant-<id>` |

Web-side gateways route outgoing OrderRequests to the right channel by
looking up the tenant's tier in Postgres at send time.

## Supervisor service (new, dedicated tier only)

A small Go or Rust binary running on the Oracle VM that:

1. Polls Postgres every 30s for active Pro/Enterprise tenants.
2. For each tenant not yet running, `docker compose up` a per-tenant
   `strategy_engine` with `TENANT_ID=<id>` env var and dedicated channel
   aliases.
3. For each running engine whose tenant has churned/downgraded,
   graceful-stop: publish `Drain` command, wait for outstanding orders to
   ack, then `docker compose down`.

Supervisor state is stateless (reconstructs from Postgres on restart). One
instance; restart loop handles crashes.

Not in scope for MVP: hot-move from shared → dedicated without restart. Tier
upgrade requires a brief engine restart for that tenant (document this).

## Migration sequence

Deploy as a **single atomic cutover**. Partial rollout is not safe — a v1
producer feeding a v2 consumer silently decodes wrong fields.

1. **PR 1 — schema + codegen.** Update `market_data.xml`, regen headers,
   bump schema version. No behavior change yet; field defaults to 0. Tests
   still pass because single-tenant path treats `tenantId=0` as the default.

2. **PR 2 — engine partitioning.** Make all state maps keyed by
   `(tenantId, symbolId)`. With only tenant 0 in play, behavior unchanged.
   Extend tests to assert cross-tenant isolation with synthetic tenants
   1 and 2.

3. **PR 3 — producer updates.** Every place that constructs an
   `OrderRequest` (binance-rest, nse-oe-sbe, mock-exchange, strategy engine)
   populates `tenantId` from its runtime context. Strategy engine learns
   tenant from its `StrategyInstance`.

4. **PR 4 — risk gate + kill switch.** Per-tenant limits, per-tenant kill
   switch. New `InvalidTenant` reject reason. Global admin kill preserved.

5. **PR 5 — web integration.** `/api/strategies` and `/api/kill-switch`
   include tenant context in Aeron publishes. `lib/auth.ts` already scopes
   to tenant — reuse.

6. **PR 6 — dedicated-tier supervisor.** New service, gated behind a
   feature flag. Pro tier can be sold while supervisor is still beta.

Each PR ships with its own latency regression run. If p99 creeps past 200ns
on shared tier, stop and investigate before the next PR.

## Testing

New test files:

- `core/tests/test_tenant_isolation.cpp`
  - Tenant A's kill switch does not halt tenant B's orders.
  - Tenant A's position limit does not affect tenant B's order acceptance.
  - OrderRequest with unknown `tenantId` gets rejected with `InvalidTenant`.
  - Cross-tenant PnL leakage assertion: after N random orders across M
    tenants, sum of per-tenant PnL equals total PnL (invariant check).

Updated tests:

- `test_latency_regression.cpp` — add a `MultiTenantP99` case. Budget
  ≤200ns p99 for shared tier, ≤100ns for dedicated.
- `test_risk_engine.cpp` — existing tests parameterize over `tenantId=0`
  to keep coverage, plus new cases at `tenantId={1,2}`.
- `test_sbe_roundtrip.cpp` — add `tenantId` field assertions.
- `test_kill_switch_e2e.cpp` — per-tenant kill plus global admin kill.

## Risks and mitigations

- **Cross-tenant state leakage.** Every state mutation must assert
  `state.tenantId == msg.tenantId`. Add a debug-build invariant check
  that's a noop in release. This is the single biggest correctness hazard.

- **`tenantId=0` ambiguity.** Reserve `tenantId=0` for the global admin
  kill command, and no other purpose. Any `OrderRequest` with `tenantId=0`
  is rejected.

- **Hot-path cache pressure.** Per-tenant `unordered_map` has worse cache
  behavior than single `unordered_map`. Benchmark before committing.
  Fallback: flat array indexed by dense tenant id if N tenants ≤ 1024.

- **Shared-tier OOM with many free-tier tenants.** Each tenant's state
  footprint is small (~1KB per active symbol), but with 10K free tenants
  × 20 symbols that's 200MB. Add a per-engine tenant cap (e.g. 1000) and
  shard across engines when exceeded. Out of scope for v1.

- **Supervisor thrash.** Tier flaps cause engine restart thrash. Debounce:
  tier change must persist 60s before supervisor acts.

## Open questions

- Should `tenantId` be `uint32` or a 16-byte UUID? Prisma tenants are
  `cuid`s — we'd need an integer mapping table. Proposal: `uint32` engine-
  internal id, maintained in a `TenantMapping` Prisma model. `uint32`
  aligns better and saves 12 bytes/message.

- Do we need per-venue tenant scoping (one tenant trades Binance but not
  NSE)? Out of scope for v1 — assume tenants can trade any venue; gate at
  the `TradingAccount` level instead.

- Downgrade from dedicated → shared: state transfer or drop-and-restart?
  Proposal: drop-and-restart. Dedicated-tier SLA already assumes brief
  restarts for tier changes.

## Rollback plan

- PR 1–2 are safe to revert: schema bump is additive, engine with
  `tenantId=0` is functionally the previous behavior.
- PR 3+ changes the wire format. Rollback requires: (a) stop all gateways,
  (b) redeploy v1 schema everywhere, (c) restart. Keep the v1 headers and
  binaries pinned in the container registry for 30 days post-cutover.

## Timeline

- Week 1: PR 1 (schema) + PR 2 (engine partitioning)
- Week 2: PR 3 (producers) + PR 4 (risk gate)
- Week 3: PR 5 (web) + hardening + full-stack mock-exchange test
- Week 4: Latency benchmark sweep, docs, cutover
- Week 5–6: PR 6 (supervisor) — only if a paying Pro customer exists
