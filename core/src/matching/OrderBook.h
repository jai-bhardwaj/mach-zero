#pragma once

#include "PriceLevel.h"
#include "PoolAllocator.h"
#include <mach_zero_market_data/Quote.h>
#include <mach_zero_market_data/Trade.h>
#include <mach_zero_market_data/Side.h>
#include <map>
#include <cstdint>
#include <functional>

namespace mach_zero::matching {

// L2 (price-level aggregated) order book.
// Bids sorted descending (highest first), asks sorted ascending (lowest first).
// O(1) best bid/ask, O(log n) insert/delete.
// Uses pool allocator for PriceLevel objects to avoid heap allocation on hot path.
class OrderBook {
public:
    static constexpr size_t MAX_LEVELS = 4096;

    explicit OrderBook(uint64_t symbolId = 0) : symbolId_(symbolId) {}

    uint64_t symbolId() const { return symbolId_; }

    // Apply a Quote update (replaces quantity at given price levels)
    void applyQuote(const market_data::Quote& quote) {
        if (quote.bidPrice() != 0) {
            updateLevel(bids_, quote.bidPrice(), quote.bidQuantity());
        }
        if (quote.askPrice() != 0) {
            updateLevel(asks_, quote.askPrice(), quote.askQuantity());
        }
    }

    // Apply a full bid/ask level update
    void setBid(int64_t price, uint64_t qty, uint32_t count = 1) {
        updateLevel(bids_, price, qty, count);
    }

    void setAsk(int64_t price, uint64_t qty, uint32_t count = 1) {
        updateLevel(asks_, price, qty, count);
    }

    // Best bid (highest bid price). Returns {0,0,0} if empty.
    PriceLevel bestBid() const {
        if (bids_.empty()) return {};
        return bids_.rbegin()->second; // std::map ascending, highest = rbegin
    }

    // Best ask (lowest ask price). Returns {0,0,0} if empty.
    PriceLevel bestAsk() const {
        if (asks_.empty()) return {};
        return asks_.begin()->second; // std::map ascending, lowest = begin
    }

    int64_t midPrice() const {
        auto bid = bestBid();
        auto ask = bestAsk();
        if (bid.price == 0 || ask.price == 0) return 0;
        return (bid.price + ask.price) / 2;
    }

    int64_t spread() const {
        auto bid = bestBid();
        auto ask = bestAsk();
        if (bid.price == 0 || ask.price == 0) return 0;
        return ask.price - bid.price;
    }

    // Get bid level at given depth (0 = best). Returns empty if depth > available.
    PriceLevel getBidLevel(size_t depth) const {
        if (depth >= bids_.size()) return {};
        auto it = bids_.rbegin();
        std::advance(it, depth);
        return it->second;
    }

    // Get ask level at given depth (0 = best). Returns empty if depth > available.
    PriceLevel getAskLevel(size_t depth) const {
        if (depth >= asks_.size()) return {};
        auto it = asks_.begin();
        std::advance(it, depth);
        return it->second;
    }

    size_t bidLevels() const { return bids_.size(); }
    size_t askLevels() const { return asks_.size(); }

    void clear() {
        bids_.clear();
        asks_.clear();
    }

private:
    void updateLevel(std::map<int64_t, PriceLevel>& side, int64_t price, uint64_t qty, uint32_t count = 1) {
        if (qty == 0) {
            side.erase(price);
        } else {
            auto& level = side[price];
            level.price = price;
            level.quantity = qty;
            level.orderCount = count;
        }
    }

    uint64_t symbolId_;
    std::map<int64_t, PriceLevel> bids_;  // ascending order, rbegin = best
    std::map<int64_t, PriceLevel> asks_;  // ascending order, begin = best
};

} // namespace mach_zero::matching
