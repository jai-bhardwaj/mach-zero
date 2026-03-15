"""
Shared memory service that wraps MachZeroReader and broadcasts
diff-based snapshots to WebSocket clients.
"""
import sys
import os
import json
import asyncio
from dataclasses import asdict
from typing import Optional

# Add the research/bridge directory to path so we can import MachZeroReader
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "research", "bridge"))

try:
    from shm_reader import MachZeroReader, SymbolSnapshot
    SHM_AVAILABLE = True
except ImportError:
    SHM_AVAILABLE = False

# Symbol ID → name mapping (matches SymbolRegistry.h defaults)
SYMBOL_MAP = {
    1: ("BTCUSDT", "Binance"),
    2: ("ETHUSDT", "Binance"),
    100: ("RELIANCE", "NSE"),
    101: ("TCS", "NSE"),
    102: ("INFY", "NSE"),
}


def snapshot_to_dict(snap: "SymbolSnapshot", symbol_id: int) -> dict:
    """Convert a SymbolSnapshot to a JSON-serializable dict."""
    name, venue = SYMBOL_MAP.get(symbol_id, (f"SYM-{symbol_id}", "Unknown"))
    return {
        "symbolId": symbol_id,
        "name": name,
        "venue": venue,
        "lastPrice": snap.last_price,
        "lastQuantity": snap.last_quantity,
        "bidPrice": snap.bid_price,
        "bidQuantity": snap.bid_quantity,
        "askPrice": snap.ask_price,
        "askQuantity": snap.ask_quantity,
        "vwap": snap.vwap,
        "volume24h": snap.volume_24h,
        "position": snap.position,
        "unrealizedPnl": snap.unrealized_pnl,
        "realizedPnl": snap.realized_pnl,
        "orderCount": snap.order_count,
        "fillCount": snap.fill_count,
        "spread": snap.spread,
        "lastTradeTimestamp": snap.last_trade_ts,
        "lastUpdateTimestamp": snap.last_update_ts,
    }


class ShmBroadcaster:
    """Reads shared memory and broadcasts snapshots to connected WebSocket clients."""

    def __init__(self, poll_interval: float = 0.2):
        self.poll_interval = poll_interval
        self.clients: set = set()
        self._reader: Optional["MachZeroReader"] = None
        self._task: Optional[asyncio.Task] = None

    async def start(self):
        if SHM_AVAILABLE:
            try:
                self._reader = MachZeroReader()
            except Exception as e:
                print(f"[bridge] Could not open shared memory: {e}")
                self._reader = None
        else:
            print("[bridge] shm_reader not available, running in demo mode")

        self._task = asyncio.create_task(self._broadcast_loop())

    async def stop(self):
        if self._task:
            self._task.cancel()
        if self._reader:
            self._reader.close()

    def add_client(self, ws):
        self.clients.add(ws)

    def remove_client(self, ws):
        self.clients.discard(ws)

    def _read_snapshot(self) -> list[dict]:
        if self._reader is None:
            return self._demo_data()

        symbols = []
        active = self._reader.read_all_active()
        for snap in active:
            symbols.append(snapshot_to_dict(snap, snap.symbol_id))
        return symbols

    def _demo_data(self) -> list[dict]:
        """Return demo data when shared memory is not available."""
        import random
        import time

        base_prices = {
            1: 65234.50, 2: 3456.78,
            100: 2890.15, 101: 3567.80, 102: 1456.25,
        }

        symbols = []
        for sid, (name, venue) in SYMBOL_MAP.items():
            base = base_prices[sid]
            jitter = base * random.uniform(-0.001, 0.001)
            price = base + jitter
            spread = base * 0.0001
            symbols.append({
                "symbolId": sid,
                "name": name,
                "venue": venue,
                "lastPrice": round(price, 2),
                "lastQuantity": round(random.uniform(0.01, 10), 4),
                "bidPrice": round(price - spread, 2),
                "bidQuantity": round(random.uniform(1, 100), 4),
                "askPrice": round(price + spread, 2),
                "askQuantity": round(random.uniform(1, 100), 4),
                "vwap": round(price * 0.999, 2),
                "volume24h": round(random.uniform(100, 10000), 2),
                "position": round(random.uniform(-5, 5), 4),
                "unrealizedPnl": round(random.uniform(-1000, 1000), 2),
                "realizedPnl": round(random.uniform(-5000, 5000), 2),
                "orderCount": random.randint(50, 500),
                "fillCount": random.randint(20, 200),
                "spread": round(spread * 2, 4),
                "lastTradeTimestamp": int(time.time() * 1e9),
                "lastUpdateTimestamp": int(time.time() * 1e9),
            })
        return symbols

    async def _broadcast_loop(self):
        while True:
            try:
                symbols = self._read_snapshot()
                message = json.dumps({"type": "snapshot", "symbols": symbols})

                dead = set()
                for ws in self.clients:
                    try:
                        await ws.send_text(message)
                    except Exception:
                        dead.add(ws)

                self.clients -= dead
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[bridge] broadcast error: {e}")

            await asyncio.sleep(self.poll_interval)


broadcaster = ShmBroadcaster()
