#pragma once

#include <mach_zero_market_data/Venue.h>
#include <string>
#include <unordered_map>
#include <vector>
#include <cstdint>

namespace mach_zero::strategy {

using namespace mach_zero::market_data;

struct SymbolInfo {
    uint64_t symbolId{0};
    std::string name;             // e.g. "BTCUSDT", "RELIANCE"
    Venue::Value venue{Venue::Unknown};
    int64_t tickSize{1};          // Minimum price increment (fixed-point)
    uint64_t lotSize{1};          // Minimum order quantity (fixed-point)
    uint64_t maxOrderSize{0};     // Max single order size
    int64_t priceBandPct{500};    // Price band in basis points (500 = 5%)
    bool tradeable{true};
};

// Central registry for all tradeable symbols across venues.
class SymbolRegistry {
public:
    void registerSymbol(const SymbolInfo& info) {
        byId_[info.symbolId] = info;
        byName_[info.name] = info.symbolId;
    }

    const SymbolInfo* getById(uint64_t id) const {
        auto it = byId_.find(id);
        return (it != byId_.end()) ? &it->second : nullptr;
    }

    const SymbolInfo* getByName(const std::string& name) const {
        auto it = byName_.find(name);
        if (it == byName_.end()) return nullptr;
        return getById(it->second);
    }

    uint64_t getSymbolId(const std::string& name) const {
        auto it = byName_.find(name);
        return (it != byName_.end()) ? it->second : 0;
    }

    std::vector<uint64_t> getSymbolsByVenue(Venue::Value venue) const {
        std::vector<uint64_t> result;
        for (const auto& [id, info] : byId_) {
            if (info.venue == venue) result.push_back(id);
        }
        return result;
    }

    size_t size() const { return byId_.size(); }

    // Pre-populate with default symbols
    void loadDefaults() {
        // Binance symbols
        registerSymbol({1, "BTCUSDT", Venue::Binance,
                        100000000LL,   // tick: 1.0
                        1000000ULL,    // lot: 0.01 BTC
                        10000000000ULL, // max: 100 BTC
                        500, true});
        registerSymbol({2, "ETHUSDT", Venue::Binance,
                        1000000LL,     // tick: 0.01
                        10000000ULL,   // lot: 0.1 ETH
                        100000000000ULL, // max: 1000 ETH
                        500, true});

        // NSE symbols
        registerSymbol({100, "RELIANCE", Venue::NSE,
                        500000LL,      // tick: 0.005 (5 paise)
                        100000000ULL,  // lot: 1 share
                        50000000000ULL, // max: 500 shares
                        1000, true});
        registerSymbol({101, "TCS", Venue::NSE,
                        500000LL,
                        100000000ULL,
                        50000000000ULL,
                        1000, true});
        registerSymbol({102, "INFY", Venue::NSE,
                        500000LL,
                        100000000ULL,
                        50000000000ULL,
                        1000, true});
    }

private:
    std::unordered_map<uint64_t, SymbolInfo> byId_;
    std::unordered_map<std::string, uint64_t> byName_;
};

} // namespace mach_zero::strategy
