#pragma once

#include <array>
#include <cstdint>
#include <atomic>

namespace mach_zero::risk {

// Mutable state maintained by the risk engine.
// All stored in cache-friendly flat arrays indexed by symbolId.
class RiskState {
public:
    static constexpr size_t MAX_SYMBOLS = 1024;

    int64_t getPosition(uint64_t symbolId) const {
        return (symbolId < MAX_SYMBOLS) ? positions_[symbolId] : 0;
    }

    void updatePosition(uint64_t symbolId, int64_t delta) {
        if (symbolId < MAX_SYMBOLS) positions_[symbolId] += delta;
    }

    void setPosition(uint64_t symbolId, int64_t pos) {
        if (symbolId < MAX_SYMBOLS) positions_[symbolId] = pos;
    }

    int64_t getLastPrice(uint64_t symbolId) const {
        return (symbolId < MAX_SYMBOLS) ? lastPrices_[symbolId] : 0;
    }

    void setLastPrice(uint64_t symbolId, int64_t price) {
        if (symbolId < MAX_SYMBOLS) lastPrices_[symbolId] = price;
    }

    uint64_t getOrderCount(uint64_t symbolId) const {
        return (symbolId < MAX_SYMBOLS) ? orderCounts_[symbolId] : 0;
    }

    void incrementOrderCount(uint64_t symbolId) {
        if (symbolId < MAX_SYMBOLS) ++orderCounts_[symbolId];
    }

    void resetOrderCounts() {
        orderCounts_.fill(0);
    }

    void reset() {
        positions_.fill(0);
        lastPrices_.fill(0);
        orderCounts_.fill(0);
    }

private:
    std::array<int64_t, MAX_SYMBOLS> positions_{};
    std::array<int64_t, MAX_SYMBOLS> lastPrices_{};
    std::array<uint64_t, MAX_SYMBOLS> orderCounts_{};
};

} // namespace mach_zero::risk
