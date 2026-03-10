#pragma once

#include <cstdint>
#include <atomic>

namespace mach_zero::ipc {

// Shared memory layout for zero-copy C++/Python bridge.
// Written by C++ (single writer), read by Python via numpy memmap.
// Uses atomic sequence numbers for lock-free consistency.

static constexpr size_t SHM_MAX_SYMBOLS = 256;

// Per-symbol state in shared memory
struct alignas(64) SymbolState {
    std::atomic<uint64_t> sequence{0};  // Incremented on each update (even=stable, odd=updating)

    // Market data
    int64_t  lastPrice{0};
    uint64_t lastQuantity{0};
    int64_t  bidPrice{0};
    uint64_t bidQuantity{0};
    int64_t  askPrice{0};
    uint64_t askQuantity{0};
    int64_t  vwap{0};
    uint64_t volume24h{0};

    // Position / risk
    int64_t  position{0};
    int64_t  unrealizedPnl{0};
    int64_t  realizedPnl{0};
    uint64_t orderCount{0};
    uint64_t fillCount{0};

    // Timestamps (nanos since epoch)
    uint64_t lastTradeTimestamp{0};
    uint64_t lastUpdateTimestamp{0};

    // Padding to fill cache line
    uint8_t  _pad[8]{};

    void beginWrite() { sequence.fetch_add(1, std::memory_order_release); }
    void endWrite()   { sequence.fetch_add(1, std::memory_order_release); }
};

// Header at the start of the shared memory region
struct ShmHeader {
    uint64_t magic{0x4D41434830};       // "MACH0"
    uint64_t version{1};
    uint64_t numSymbols{SHM_MAX_SYMBOLS};
    uint64_t symbolStateOffset{sizeof(ShmHeader)};
    uint64_t symbolStateSize{sizeof(SymbolState)};
    uint64_t createdTimestamp{0};
    uint64_t _reserved[10]{};
};

// Total shared memory size
static constexpr size_t SHM_TOTAL_SIZE = sizeof(ShmHeader) + sizeof(SymbolState) * SHM_MAX_SYMBOLS;

} // namespace mach_zero::ipc
