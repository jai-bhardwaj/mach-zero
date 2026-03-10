#pragma once

#include <cstdint>
#include <string>
#include <string_view>
#include <unordered_map>

namespace mach_zero::gateway {

// Bidirectional mapping between exchange symbol strings (e.g., "BTCUSDT")
// and internal numeric symbol IDs used in SBE messages.
class SymbolMap {
public:
    SymbolMap() {
        // Pre-populate with well-known Binance pairs
        add("BTCUSDT",  1);
        add("ETHUSDT",  2);
        add("BNBUSDT",  3);
        add("SOLUSDT",  4);
        add("XRPUSDT",  5);
        add("DOGEUSDT", 6);
        add("ADAUSDT",  7);
        add("AVAXUSDT", 8);
        add("DOTUSDT",  9);
        add("MATICUSDT", 10);
    }

    void add(const std::string& symbol, uint64_t id) {
        nameToId_[symbol] = id;
        idToName_[id] = symbol;
    }

    uint64_t toId(std::string_view symbol) const {
        auto it = nameToId_.find(std::string(symbol));
        return (it != nameToId_.end()) ? it->second : 0;
    }

    std::string_view toName(uint64_t id) const {
        auto it = idToName_.find(id);
        return (it != idToName_.end()) ? std::string_view(it->second) : "";
    }

    bool contains(std::string_view symbol) const {
        return nameToId_.count(std::string(symbol)) > 0;
    }

private:
    std::unordered_map<std::string, uint64_t> nameToId_;
    std::unordered_map<uint64_t, std::string> idToName_;
};

} // namespace mach_zero::gateway
