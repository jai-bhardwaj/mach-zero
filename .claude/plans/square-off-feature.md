# Square-Off Feature — Strategy-wise & Tenant-wise

## Overview
Add the ability to "square off" (close all open positions) at two scopes:
1. **Strategy-level** — close positions for a single strategy's symbol, pause the strategy
2. **Tenant-level** — close ALL positions across all symbols, pause all strategies, activate kill switch

## Architecture

### Current Order Flow
```
Strategy Engine → ORDER_STREAM (1002)
    → RiskEngine validates → VALIDATED_ORDER_STREAM (1005)
        → Exchange Gateway (mock or real) → ACK_STREAM (1006)
```

### Square-Off Flow (NEW)
```
Web API POST /api/square-off
    → HTTP proxy to C++ Risk Monitor POST /square-off
        → SquareOffManager reads positions from SharedMemory
        → Generates counter-order (market order, opposite side)
        → Publishes to VALIDATED_ORDER_STREAM (1005) — bypasses risk checks
        → Exchange fills the order via ACK_STREAM
    → Web API updates strategy status → PAUSED in PostgreSQL
    → (Tenant-level) Also activates kill switch via existing endpoint
```

---

## Implementation Steps

### Step 1: SBE Schema Extension
**File:** `common/schemas/market_data.xml`

- Add `SquareOffScope` enum: `Symbol = 0`, `All = 1`
- Add new message `SquareOffCommand` (id=21):
  - `symbolId: uint64` — which symbol to close (0 = all)
  - `scope: SquareOffScope` — symbol vs all
  - `venue: Venue` — target exchange
  - `timestamp: Timestamp`
- Regenerate SBE headers

### Step 2: C++ SquareOffManager
**New file:** `core/src/risk/SquareOffManager.h`

- Class that takes `const SharedMemoryWriter&` and `AeronPublisher&` (for VALIDATED_ORDER_STREAM)
- `squareOffSymbol(symbolId, venue)`:
  1. Read position from shared memory for symbolId
  2. If position == 0, return false (nothing to close)
  3. Generate market order: side = (position > 0 ? Sell : Buy), qty = abs(position)
  4. Build SBE `OrderRequest` message with orderId, IOC time-in-force
  5. Publish to VALIDATED_ORDER_STREAM
  6. Return true
- `squareOffAll(venue)`:
  1. Iterate all symbols 0..SHM_MAX_SYMBOLS
  2. Call `squareOffSymbol()` for each with non-zero position
  3. Return count of symbols squared off
- Thread-safe (reads from shared memory which uses atomic sequence numbers)

### Step 3: Extend C++ HttpServer
**File:** `core/src/risk/HttpServer.h`

Refactor the minimal HTTP server to support more routes:
- Add a `using RequestHandler = std::function<std::string(const std::string& body)>` type
- Add route registration: `addPostRoute(path, handler)`
- Keep existing `/status` and `/kill-switch/{on|off}` routes
- New endpoint: `POST /square-off` accepting JSON body:
  ```json
  {"symbolId": 123, "venue": 1}       // Strategy-level (venue 1=Binance)
  {"all": true, "venue": 1}            // Tenant-level
  ```
- Returns JSON:
  ```json
  {"success": true, "symbolsSquaredOff": 1, "details": [{"symbolId": 123, "position": -500, "closingSide": "Buy"}]}
  ```

### Step 4: Update Risk Monitor main.cpp
**File:** `apps/risk-monitor/main.cpp`

- Add `AeronPublisher` for `VALIDATED_ORDER_STREAM (1005)` (using shared Aeron instance)
- Create `SquareOffManager` instance with shared memory + publisher
- Wire up `POST /square-off` HTTP endpoint to call `SquareOffManager`
- Parse JSON body (simple string parsing, no library — matches existing pattern)

### Step 5: Web API Route
**New file:** `apps/web/app/api/square-off/route.ts`

**POST** handler:
```typescript
body: {
  scope: "strategy" | "tenant",
  strategyId?: string,     // Required for scope=strategy
  tenantId?: string,       // Required for scope=tenant
  activateKillSwitch?: boolean  // Auto-true for tenant
}
```

Logic:
1. **Strategy scope:**
   - Look up strategy from Prisma (get symbolId, venue, status)
   - Validate: must be RUNNING or PAUSED
   - Map venue name → venue number (Binance=1, NSE=2)
   - HTTP POST to C++ risk monitor `/square-off` with `{symbolId, venue}`
   - Update strategy status to PAUSED in Prisma
   - Return result

2. **Tenant scope:**
   - Look up all RUNNING/PAUSED strategies for tenant from Prisma
   - HTTP POST to C++ risk monitor `/square-off` with `{all: true}`
   - Activate kill switch via HTTP POST to `/kill-switch/on`
   - Update all strategies to PAUSED in Prisma
   - Return result

3. **Fallback** (no C++ connection):
   - Update strategy status to PAUSED in Prisma
   - Return `{success: true, source: "local", note: "Positions will be closed when C++ engine processes"}`

### Step 6: TypeScript Types
**File:** `apps/web/types/index.ts`

Add:
```typescript
interface SquareOffRequest {
  scope: "strategy" | "tenant";
  strategyId?: string;
  tenantId?: string;
  activateKillSwitch?: boolean;
}

interface SquareOffResult {
  success: boolean;
  symbolsSquaredOff: number;
  strategiesPaused: number;
  killSwitchActivated: boolean;
  details?: Array<{
    symbolId: number;
    position: number;
    closingSide: string;
  }>;
}
```

### Step 7: useSquareOff Hook
**New file:** `apps/web/hooks/useSquareOff.ts`

```typescript
export function useSquareOff() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SquareOffResult | null>(null);

  const squareOff = async (request: SquareOffRequest) => {
    setLoading(true);
    const res = await fetch("/api/square-off", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const data = await res.json();
    setResult(data);
    setLoading(false);
    return data;
  };

  return { squareOff, loading, result };
}
```

### Step 8: StrategyCard — Square Off Button
**File:** `apps/web/components/strategies/StrategyCard.tsx`

- Add `onSquareOff: (id: string) => void` callback to Props
- Add `"SQUARE_OFF"` to the confirmAction union type
- Show "Square Off" button when:
  - Strategy is RUNNING or PAUSED
  - Strategy has a non-zero position (`liveData?.position !== 0`)
- Confirmation message: "Close all positions for this strategy? A market order will be sent."
- Button style: `variant="danger"` with amber coloring

### Step 9: Strategies Page — Handler
**File:** `apps/web/app/strategies/page.tsx`

- Add `handleSquareOff(id: string)` handler that calls the API
- Pass `onSquareOff` prop to StrategyCard
- Show toast/notification on success/failure
- Refresh strategies + mode after square-off

### Step 10: Risk Page — Tenant Square Off
**File:** `apps/web/app/risk/page.tsx`

- Add `SquareOffPanel` component below KillSwitchPanel
- Shows "Square Off ALL Positions" button
- Includes warning: "This will close all positions, pause all strategies, and activate the kill switch"
- Strong confirmation dialog (type "SQUARE OFF" to confirm)
- Calls `/api/square-off` with `scope: "tenant"` and `activateKillSwitch: true`

### Step 11: SquareOffPanel Component
**New file:** `apps/web/components/risk/SquareOffPanel.tsx`

- Card with danger styling
- Shows current open positions count (from usePositions)
- "Square Off All" button with confirmation
- Result display after execution (symbols closed, etc.)
- Links to strategies page

### Step 12: Build & Test
1. **C++**: `cd build && cmake .. && cmake --build . --parallel`
2. **SBE**: Regenerate headers with `java -Dsbe.output.dir=core/include -Dsbe.target.language=Cpp -jar sbe-all.jar common/schemas/market_data.xml`
3. **C++ tests**: `cd build && ctest --output-on-failure`
4. **Web**: `cd apps/web && npm run build`

---

## Files Changed/Created

### New Files (5):
1. `core/src/risk/SquareOffManager.h` — C++ square-off logic
2. `apps/web/app/api/square-off/route.ts` — Web API endpoint
3. `apps/web/hooks/useSquareOff.ts` — React hook
4. `apps/web/components/risk/SquareOffPanel.tsx` — Tenant square-off UI

### Modified Files (7):
1. `common/schemas/market_data.xml` — SBE schema (new message)
2. `core/src/risk/HttpServer.h` — Extended with route handler support
3. `apps/risk-monitor/main.cpp` — Aeron publisher + square-off wiring
4. `apps/web/types/index.ts` — SquareOff types
5. `apps/web/components/strategies/StrategyCard.tsx` — Square Off button
6. `apps/web/app/strategies/page.tsx` — handleSquareOff handler
7. `apps/web/app/risk/page.tsx` — SquareOffPanel integration

### Regenerated (SBE headers):
- `core/include/mach_zero_market_data/SquareOffCommand.h`
- `core/include/mach_zero_market_data/SquareOffScope.h`
