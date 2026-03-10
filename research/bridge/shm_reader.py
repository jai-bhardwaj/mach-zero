"""
Shared memory reader for Mach-Zero C++/Python bridge.
Reads the memory-mapped file written by SharedMemoryWriter.
Uses numpy memmap for zero-copy access.
"""

import numpy as np
import mmap
import struct
import time
from dataclasses import dataclass
from typing import Optional

# Must match SharedMemoryLayout.h
SHM_MAX_SYMBOLS = 256
SHM_NAME = "/mach_zero_state"

# Header: magic(8) + version(8) + numSymbols(8) + offset(8) + stateSize(8) + created(8) + reserved(80)
HEADER_SIZE = 8 * 6 + 8 * 10  # 128 bytes
HEADER_MAGIC = 0x4D41434830  # "MACH0"

# SymbolState is 64-byte aligned; fields are:
# sequence(8), lastPrice(8), lastQty(8), bidPrice(8), bidQty(8),
# askPrice(8), askQty(8), vwap(8), volume24h(8),
# position(8), unrealizedPnl(8), realizedPnl(8), orderCount(8), fillCount(8),
# lastTradeTsNs(8), lastUpdateTsNs(8), pad(8)
# Total: 17 * 8 = 136 bytes, but aligned to 64 bytes -> 192 bytes (3 cache lines)
SYMBOL_STATE_SIZE = 192  # sizeof(SymbolState) with alignas(64)

SYMBOL_STATE_DTYPE = np.dtype([
    ('sequence', np.uint64),
    ('last_price', np.int64),
    ('last_quantity', np.uint64),
    ('bid_price', np.int64),
    ('bid_quantity', np.uint64),
    ('ask_price', np.int64),
    ('ask_quantity', np.uint64),
    ('vwap', np.int64),
    ('volume_24h', np.uint64),
    ('position', np.int64),
    ('unrealized_pnl', np.int64),
    ('realized_pnl', np.int64),
    ('order_count', np.uint64),
    ('fill_count', np.uint64),
    ('last_trade_ts', np.uint64),
    ('last_update_ts', np.uint64),
    ('_pad', np.uint64),
], align=True)

# Adjust itemsize to match C++ alignas(64)
# numpy might not pad to 192 automatically


@dataclass
class SymbolSnapshot:
    """Consistent snapshot of a symbol's state."""
    symbol_id: int
    sequence: int
    last_price: float
    last_quantity: float
    bid_price: float
    bid_quantity: float
    ask_price: float
    ask_quantity: float
    vwap: float
    volume_24h: float
    position: float
    unrealized_pnl: float
    realized_pnl: float
    order_count: int
    fill_count: int
    last_trade_ts_ns: int
    last_update_ts_ns: int

    @property
    def spread(self) -> float:
        if self.bid_price > 0 and self.ask_price > 0:
            return self.ask_price - self.bid_price
        return 0.0

    @property
    def mid_price(self) -> float:
        if self.bid_price > 0 and self.ask_price > 0:
            return (self.bid_price + self.ask_price) / 2.0
        return self.last_price


FIXED_POINT_DIVISOR = 100000000.0


class MachZeroReader:
    """
    Zero-copy shared memory reader for live trading state.

    Usage:
        reader = MachZeroReader()
        reader.open()
        snapshot = reader.read_symbol(1)  # Read symbol ID 1
        print(f"BTC price: {snapshot.last_price}")
        reader.close()
    """

    def __init__(self, shm_path: Optional[str] = None):
        self._path = shm_path or f"/dev/shm{SHM_NAME}"
        self._fd = None
        self._mm = None
        self._buf = None

    def open(self) -> bool:
        """Open shared memory for reading."""
        try:
            self._fd = open(self._path, 'rb')
            self._mm = mmap.mmap(self._fd.fileno(), 0, access=mmap.ACCESS_READ)

            # Verify magic
            magic = struct.unpack_from('<Q', self._mm, 0)[0]
            if magic != HEADER_MAGIC:
                self.close()
                return False

            return True
        except (FileNotFoundError, OSError):
            return False

    def close(self):
        """Close shared memory."""
        if self._mm:
            self._mm.close()
            self._mm = None
        if self._fd:
            self._fd.close()
            self._fd = None

    def read_symbol(self, symbol_id: int) -> Optional[SymbolSnapshot]:
        """
        Read a consistent snapshot of a symbol.
        Uses sequence number protocol: retry if sequence changes during read.
        Returns None if symbol has no data.
        """
        if not self._mm or symbol_id >= SHM_MAX_SYMBOLS:
            return None

        offset = HEADER_SIZE + symbol_id * SYMBOL_STATE_SIZE

        # Retry loop for consistency
        for _ in range(10):
            seq1 = struct.unpack_from('<Q', self._mm, offset)[0]
            if seq1 & 1:  # Odd = writer is updating
                continue

            # Read all fields
            fields = struct.unpack_from('<QqQqQqQqQqqqQQQQ', self._mm, offset)
            # fields: seq, lastPrice, lastQty, bidPrice, bidQty, askPrice, askQty,
            #         vwap, vol24h, position, unrealPnl, realPnl, orderCount, fillCount,
            #         lastTradeTsNs, lastUpdateTsNs

            seq2 = struct.unpack_from('<Q', self._mm, offset)[0]
            if seq1 == seq2:
                if fields[1] == 0:  # No data
                    return None
                return SymbolSnapshot(
                    symbol_id=symbol_id,
                    sequence=fields[0],
                    last_price=fields[1] / FIXED_POINT_DIVISOR,
                    last_quantity=fields[2] / FIXED_POINT_DIVISOR,
                    bid_price=fields[3] / FIXED_POINT_DIVISOR,
                    bid_quantity=fields[4] / FIXED_POINT_DIVISOR,
                    ask_price=fields[5] / FIXED_POINT_DIVISOR,
                    ask_quantity=fields[6] / FIXED_POINT_DIVISOR,
                    vwap=fields[7] / FIXED_POINT_DIVISOR,
                    volume_24h=fields[8] / FIXED_POINT_DIVISOR,
                    position=fields[9] / FIXED_POINT_DIVISOR,
                    unrealized_pnl=fields[10] / FIXED_POINT_DIVISOR,
                    realized_pnl=fields[11] / FIXED_POINT_DIVISOR,
                    order_count=fields[12],
                    fill_count=fields[13],
                    last_trade_ts_ns=fields[14],
                    last_update_ts_ns=fields[15],
                )

        return None  # Could not get consistent read

    def read_all_active(self) -> list:
        """Read all symbols with non-zero last_price."""
        symbols = []
        for i in range(SHM_MAX_SYMBOLS):
            snap = self.read_symbol(i)
            if snap is not None:
                symbols.append(snap)
        return symbols

    def __enter__(self):
        self.open()
        return self

    def __exit__(self, *args):
        self.close()


if __name__ == "__main__":
    import sys

    reader = MachZeroReader()
    if not reader.open():
        print("Could not open shared memory. Is the C++ system running?")
        sys.exit(1)

    print("Reading live state from shared memory...")
    try:
        while True:
            symbols = reader.read_all_active()
            if symbols:
                for s in symbols:
                    print(f"  [{s.symbol_id}] Price={s.last_price:.2f} "
                          f"Bid={s.bid_price:.2f} Ask={s.ask_price:.2f} "
                          f"Pos={s.position:.4f} Orders={s.order_count}")
            else:
                print("  (no active symbols)")
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        reader.close()
