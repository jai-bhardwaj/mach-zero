# Mach-Zero

Ultra-low latency algorithmic trading system built in C++20. Targets **Binance** (crypto) and **NSE** (India equity) with sub-microsecond risk validation and nanosecond-precision message encoding.

## Architecture

```
                        Aeron IPC Bus
                  ┌──────────────────────────┐
                  │                          │
  ┌───────────┐   │  ┌──────────┐  ┌──────┐  │  ┌──────────────┐
  │ Binance   │───┼─>│ Strategy │─>│ Risk │──┼─>│ Binance REST │──> Exchange
  │ WebSocket │   │  │ Engine   │  │ Gate │  │  │ Gateway      │
  └───────────┘   │  └──────────┘  └──────┘  │  └──────────────┘
                  │       │           │      │
  ┌───────────┐   │       │           │      │  ┌──────────────┐
  │ NSE ITCH  │───┤       │           │      ├─>│ NSE OE       │──> Exchange
  │ Gateway   │   │       │           │      │  │ Gateway      │
  └───────────┘   │       v           v      │  └──────────────┘
                  │  ┌──────────┐  ┌──────┐  │
                  │  │ QuestDB  │  │ Risk │  │
                  │  │ Sink     │  │ Mon. │  │
                  │  └──────────┘  └──────┘  │
                  └──────────────────────────┘
```

All inter-process communication uses [Aeron](https://github.com/real-logic/aeron) IPC with [SBE](https://github.com/real-logic/simple-binary-encoding) (Simple Binary Encoding) for zero-copy, fixed-size messages on shared memory.

## Performance

| Component | p99 Latency | Measured On |
|---|---|---|
| Risk gate validation (5 checks) | 83 ns | Apple M-series |
| Order book update | 83 ns | Apple M-series |
| SBE encode + decode roundtrip | 42 ns | Apple M-series |
| Kill switch activation | 42 ns | Apple M-series |
| Arena allocator | 42 ns | Apple M-series |

117 unit/integration/regression tests, all passing.

## Project Structure

```
mach-zero/
├── apps/
│   ├── engine/                  # Strategy engine process
│   ├── gateways/
│   │   ├── binance-ws/          # Binance WebSocket market data
│   │   ├── binance-rest/        # Binance REST order entry
│   │   ├── nse-md-itch/         # NSE ITCH market data (simulator)
│   │   └── nse-oe-sbe/          # NSE SBE order entry (simulator)
│   ├── persistence/             # QuestDB persistence service
│   └── risk-monitor/            # Terminal dashboard + HTTP kill switch API
├── common/
│   ├── clock/                   # Clock abstraction (ManualClock for testing)
│   ├── ipc/                     # Aeron publisher/subscriber, shared memory bridge
│   ├── logger/                  # Lock-free ring buffer logger
│   ├── memory/                  # Arena allocator, huge page allocator
│   ├── metrics/                 # Lock-free counters, histograms, Prometheus export
│   └── schemas/                 # SBE message schema (market_data.xml)
├── core/
│   ├── include/mach_zero_market_data/  # Generated SBE headers
│   ├── src/
│   │   ├── matching/            # L2 order book, price levels, pool allocator
│   │   ├── risk/                # Risk engine, 5 pre-trade checks, kill switch
│   │   ├── strategy/            # Strategy engine, spread + momentum strategies
│   │   └── transport/           # QuestDB sink, reconnection, audit logger
│   └── tests/                   # 117 Google Test cases
├── research/
│   ├── backtesting/             # Backtest engine, simulated exchange
│   ├── bridge/                  # Python shared memory reader
│   └── notebooks/               # Jupyter analysis notebooks
└── infra/
    ├── docker/                  # Dockerfiles (gateway, engine, risk)
    ├── schema/                  # QuestDB DDL
    ├── terraform/               # AWS bare-metal instance config
    ├── tools/                   # Audit log reader (Python)
    └── tuning/                  # CPU affinity, Aeron config, latency bench
```

## Building

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
# Or directly:
./build/core/tests/mach_zero_tests
```

### Run Latency Benchmarks

```bash
./build/core/tests/mach_zero_tests --gtest_filter="LatencyRegression.*"
```

## Components

### SBE Messages

All messages are defined in `common/schemas/market_data.xml` and encoded with SBE for zero-allocation, fixed-size serialization:

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

- **KillSwitch** -- Atomic boolean global halt, cross-thread visible in <50ns
- **PriceBandCheck** -- Rejects orders outside configurable % from last traded price
- **PositionLimitCheck** -- Net position limits per symbol
- **OrderRateCheck** -- Sliding window rate limiting
- **MaxOrderSizeCheck** -- Single order size cap

### Strategies

- **SimpleSpreadStrategy** -- Market-making: limit orders at configurable offsets from mid price
- **MomentumStrategy** -- VWAP deviation signals with configurable lookback window

### Backtesting

```cpp
BacktestEngine engine;
engine.addStrategy(std::make_shared<SimpleSpreadStrategy>(cfg));
auto results = engine.run(events);  // Returns P&L, Sharpe, drawdown, win rate
```

Integrates strategy engine, risk engine, and simulated exchange with deterministic replay.

### Python Bridge

Zero-copy shared memory bridge for research notebooks:

```python
from bridge.shm_reader import MachZeroReader

reader = MachZeroReader()
state = reader.read_symbol(1)  # BTCUSDT
print(f"Bid: {state['bid_price']}, Ask: {state['ask_price']}")
```

### Kill Switch Dashboard

HTTP API + web UI at port 8080:

```
GET  /status          # {"killSwitch": false}
POST /kill-switch/on  # Activate -- halts all order flow
POST /kill-switch/off # Deactivate -- resume trading
GET  /                # Web dashboard with toggle button
```

## Docker

```bash
cd infra
docker compose up -d
```

Brings up QuestDB, gateway, engine, risk monitor, and persistence service. All trading processes share `/dev/shm` for Aeron IPC.

## Running the System

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

Key settings:
- Isolate CPU cores for trading hot path
- Pre-allocate 2MB huge pages for order book and risk state
- Pin Aeron media driver to dedicated core with busy-spin idle strategy
- Use `SCHED_FIFO` real-time scheduling for strategy/risk threads

## Dependencies

All fetched automatically via CMake FetchContent:

| Library | Version | Purpose |
|---|---|---|
| [Aeron](https://github.com/real-logic/aeron) | 1.44.1 | IPC transport |
| [simdjson](https://github.com/simdjson/simdjson) | 3.10.1 | JSON parsing |
| [IXWebSocket](https://github.com/machinezone/IXWebSocket) | 11.4.5 | WebSocket client |
| [Google Test](https://github.com/google/googletest) | 1.14.0 | Testing |

## License

Proprietary. All rights reserved.
