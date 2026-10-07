# Mach-Zero

Ultra-low latency algorithmic trading system. C++20 core engine with a Next.js 16 web dashboard. Targets **Binance** (crypto) and **NSE** (India equity) with sub-microsecond risk validation and nanosecond-precision message encoding.

## How this was built

One engineer, built with heavy AI assistance (Claude Code) across design, implementation and review.
I made the architectural calls — Aeron for IPC, SBE for the wire format, a pre-trade risk gate on the
hot path, QuestDB for the time series — and drove the system to a working end-to-end state.

Size, counted honestly from tracked source:

| | Files | Lines |
|---|---|---|
| C++ core, hand-written | 85 | ~11,100 |
| C++ SBE codecs, generated from schema | 18 | ~8,500 |
| TypeScript / React dashboard | 228 | ~24,300 |
| **Tests** | **20** | **173 gtest cases** |

Stating the provenance plainly because it is the interesting part. Deciding *what* to build at this
scale, keeping a latency budget honest, and knowing which generated code to throw away is the skill
the tooling does not replace.


## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Vercel (Web)                               │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Next.js 16 Dashboard                                       │   │
│  │  Auth (NextAuth) · Strategies · Risk · Marketplace          │   │
│  └──────────────────────┬───────────────────────────────────────┘   │
│                         │ REST + WebSocket                          │
├─────────────────────────┼───────────────────────────────────────────┤
│                         │                                           │
│  ┌──────────────────────▼───────────────────────────────────────┐   │
│  │              Oracle Cloud VM (ARM, 4 CPU, 24 GB)            │   │
│  │                                                              │   │
│  │  ┌───────────┐   Aeron IPC Bus   ┌──────────────┐           │   │
│  │  │ Binance   │──────────────────▶│ Strategy     │           │   │
│  │  │ WebSocket │    ┌──────────┐   │ Engine       │           │   │
│  │  └───────────┘    │ Risk     │   └──────┬───────┘           │   │
│  │                   │ Gate     │◀─────────┘                   │   │
│  │  ┌───────────┐    │ (<100ns) │   ┌──────────────┐           │   │
│  │  │ NSE ITCH  │────┤          ├──▶│ Binance REST │──▶ Exch.  │   │
│  │  │ Gateway   │    └──────────┘   └──────────────┘           │   │
│  │  └───────────┘         │                                     │   │
│  │                   ┌────▼─────┐   ┌──────────────┐           │   │
│  │                   │ QuestDB  │   │ Python       │           │   │
│  │                   │ (TSDB)   │   │ Bridge (SHM) │           │   │
│  │                   └──────────┘   └──────────────┘           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  PostgreSQL (Aiven) ─── User/strategy/account config               │
└─────────────────────────────────────────────────────────────────────┘
```

## Performance

**These numbers have been withdrawn. The benchmark was invalid and I would rather say so than
ship figures I cannot defend.**

The harness in `infra/tuning/LatencyBench.h` timed a *single* operation between two
`steady_clock` reads. On Apple silicon that clock is backed by `mach_absolute_time` with a
125/3 timebase — **41.667 ns per tick** — so it can only ever return multiples of ~41.7 ns.
Measured on this machine, the smallest non-zero deltas between two consecutive clock reads are
exactly `41, 42, 83, 84, 125, 166, 167, 208` ns.

The five figures previously published here were 83, 83, 42, 42 and 42 ns — that is, **one or
two ticks of the clock, every one of them.** An empty function timed the same way yields 42 ns.
The table was measuring the resolution of the instrument, not the cost of the code.

Re-measuring it properly means bracketing a loop of many thousands of iterations with a single
pair of clock reads and dividing, with a compiler barrier so the body is not elided, and
reporting a median across repetitions rather than a single shot. Measured that way the interval
is milliseconds wide and the clock's 41.7 ns granularity stops mattering. These components will
be re-benchmarked that way before any latency claim reappears here.

`infra/tuning/clock_resolution_probe.cpp` prints the timebase and the smallest resolvable
interval on whatever machine you run it on.

173 gtest cases across 20 test files.

## Project Structure

```
mach-zero/
├── apps/
│   ├── web/                       # Next.js 16 web dashboard
│   │   ├── app/                   # App Router (pages, API routes)
│   │   ├── components/            # React components
│   │   ├── prisma/                # Schema + migrations + seed
│   │   └── types/                 # Shared TypeScript types
│   ├── engine/                    # C++ strategy engine process
│   ├── gateways/
│   │   ├── binance-ws/            # Binance WebSocket market data
│   │   ├── binance-rest/          # Binance REST order entry
│   │   ├── nse-md-itch/           # NSE ITCH market data (simulator)
│   │   └── nse-oe-sbe/            # NSE SBE order entry (simulator)
│   ├── persistence/               # QuestDB persistence service
│   └── risk-monitor/              # Terminal dashboard + HTTP kill switch API
├── common/
│   ├── clock/                     # Clock abstraction (ManualClock for testing)
│   ├── ipc/                       # Aeron publisher/subscriber, shared memory bridge
│   ├── logger/                    # Lock-free ring buffer logger
│   ├── memory/                    # Arena allocator, huge page allocator
│   ├── metrics/                   # Lock-free counters, histograms, Prometheus export
│   └── schemas/                   # SBE message schema (market_data.xml)
├── core/
│   ├── include/mach_zero_market_data/  # Generated SBE headers
│   ├── src/
│   │   ├── matching/              # L2 order book, price levels, pool allocator
│   │   ├── risk/                  # Risk engine, 5 pre-trade checks, kill switch
│   │   ├── strategy/              # Strategy engine, spread + momentum strategies
│   │   └── transport/             # QuestDB sink, reconnection, audit logger
│   └── tests/                     # 117 Google Test cases
├── research/
│   ├── backtesting/               # Backtest engine, simulated exchange
│   ├── bridge/                    # Python shared memory reader
│   └── notebooks/                 # Jupyter analysis notebooks
└── infra/
    ├── docker/                    # Dockerfiles (gateway, engine, risk)
    ├── schema/                    # QuestDB DDL
    └── tuning/                    # CPU affinity, Aeron config, latency bench
```

## Deployment

### Infrastructure (all free tier)

| Component | Host | Details |
|---|---|---|
| Web dashboard | [Vercel](https://vercel.com) | Next.js 16, auto-deploy from GitHub |
| PostgreSQL | [Aiven](https://aiven.io) | 1 GB free, Asia Pacific region |
| C++ engine + QuestDB | [Oracle Cloud](https://cloud.oracle.com) | 4 ARM cores, 24 GB RAM, 200 GB |

### Quick Deploy

**Web app (Vercel):**
```bash
cd apps/web
npx vercel --yes --prod
```

**Backend (Oracle VM):**
```bash
ssh ubuntu@YOUR_VM_IP
cd ~/mach-zero && docker compose up -d
```

### Environment Variables (Vercel)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Aiven PostgreSQL connection string |
| `DIRECT_DATABASE_URL` | Same (no pooler needed for Aiven) |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `SUPER_ADMIN_EMAILS` | Comma-separated admin emails |
| `QUESTDB_URL` | `http://VM_IP:9000` |
| `NEXT_PUBLIC_BRIDGE_WS_URL` | `ws://VM_IP:3002/ws/live` |

## Building the C++ Engine

### Prerequisites

- CMake 3.18+
- C++20 compiler (GCC 11+, Clang 14+, Apple Clang 15+)
- Java 11+ (for Aeron media driver)
- OpenSSL and zlib development headers

### Build

```bash
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j$(nproc)
```

### Run Tests

```bash
cd build && ctest --output-on-failure
```

### Run Latency Benchmarks

```bash
./build/core/tests/mach_zero_tests --gtest_filter="LatencyRegression.*"
```

## Web Dashboard

### Setup

```bash
cd apps/web
cp .env.example .env.local    # Fill in your env vars
npm install --legacy-peer-deps
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```

### Features

- **Dashboard** — Live market data, P&L, positions via WebSocket
- **Strategies** — Create, configure, start/stop strategies with mock/live modes
- **Marketplace** — Pre-built strategy templates with backtest metrics
- **Risk Management** — Kill switch, square-off, risk event monitoring
- **Accounts** — Exchange connections (Binance API keys, NSE broker credentials)
- **Capital Management** — Pool-based capital allocation per strategy
- **Settings** — Theme, workspace config

### Tech Stack

- Next.js 16 (App Router, Server Components)
- Tailwind CSS 4
- Prisma ORM + PostgreSQL
- NextAuth.js (Google OAuth + email)
- SWR for real-time polling
- Base UI components

## Components

### SBE Messages

All messages defined in `common/schemas/market_data.xml`, encoded with SBE for zero-allocation, fixed-size serialization:

| Message | ID | Fields |
|---|---|---|
| Trade | 1 | symbolId, price, quantity, side, venue, timestamp |
| Quote | 2 | symbolId, bid/ask price+qty, venue, seqNum, timestamp |
| OrderRequest | 10 | orderId, clientOrderId, symbolId, side, price, qty, type, TIF, venue |
| OrderAck | 11 | orderId, clientOrderId, symbolId, status, filledQty, avgPrice, venue |
| OrderReject | 12 | orderId, clientOrderId, symbolId, rejectReason, riskCheckName |
| CancelRequest | 13 | orderId, symbolId, venue |
| Heartbeat | 99 | sourceId, timestamp, sequenceNumber |
| RiskCommand | 20 | commandType, symbolId, value |

Prices use **fixed-point int64** with 8 decimal places (1.0 = 100,000,000).

### Aeron IPC Streams

| Stream | ID | Purpose |
|---|---|---|
| MARKET_DATA | 1001 | Trade + Quote from gateways |
| ORDER | 1002 | OrderRequest from strategy engine |
| RISK | 1003 | Risk events and commands |
| PERSISTENCE | 1004 | Messages for QuestDB |
| VALIDATED_ORDER | 1005 | Orders that passed risk checks |
| ACK | 1006 | OrderAck/Reject from exchange |

### Risk Engine

Pre-trade risk gate with 5 checks, all executing in <100ns p99:

- **KillSwitch** — Atomic boolean global halt, cross-thread visible in <50ns
- **PriceBandCheck** — Rejects orders outside configurable % from last traded price
- **PositionLimitCheck** — Net position limits per symbol
- **OrderRateCheck** — Sliding window rate limiting
- **MaxOrderSizeCheck** — Single order size cap

### Strategies

- **SimpleSpreadStrategy** — Market-making: limit orders at configurable offsets from mid price
- **MomentumStrategy** — VWAP deviation signals with configurable lookback window

### Backtesting

```cpp
BacktestEngine engine;
engine.addStrategy(std::make_shared<SimpleSpreadStrategy>(cfg));
auto results = engine.run(events);  // Returns P&L, Sharpe, drawdown, win rate
```

### Python Bridge

Zero-copy shared memory bridge for research notebooks:

```python
from bridge.shm_reader import MachZeroReader

reader = MachZeroReader()
state = reader.read_symbol(1)  # BTCUSDT
print(f"Bid: {state['bid_price']}, Ask: {state['ask_price']}")
```

### Kill Switch Dashboard

HTTP API at port 8080:

```
GET  /status          # {"killSwitch": false}
POST /kill-switch/on  # Activate — halts all order flow
POST /kill-switch/off # Deactivate — resume trading
```

## Running the Full System

1. **Start Aeron media driver:**
   ```bash
   ./infra/tuning/start_media_driver.sh
   ```

2. **Start components** (in separate terminals):
   ```bash
   ./build/apps/gateways/binance-ws/binance_gateway
   ./build/apps/engine/strategy_engine
   ./build/apps/risk-monitor/risk_monitor
   ./build/apps/persistence/persistence_service
   ```

3. **Query data in QuestDB:** Open `http://localhost:9000` and run:
   ```sql
   SELECT * FROM trades ORDER BY timestamp DESC LIMIT 100;
   ```

## Production Tuning

See `infra/tuning/tuning_guide.md` for Linux kernel tuning (isolcpus, nohz_full, huge pages, NUMA, IRQ affinity).

## Dependencies

All C++ deps fetched automatically via CMake FetchContent:

| Library | Version | Purpose |
|---|---|---|
| [Aeron](https://github.com/real-logic/aeron) | 1.44.1 | IPC transport |
| [simdjson](https://github.com/simdjson/simdjson) | 3.10.1 | JSON parsing |
| [IXWebSocket](https://github.com/machinezone/IXWebSocket) | 11.4.5 | WebSocket client |
| [Google Test](https://github.com/google/googletest) | 1.14.0 | Testing |

## License

Proprietary. All rights reserved.
