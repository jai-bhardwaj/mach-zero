#pragma once

#include <cstdint>
#include <string>
#include <unordered_map>

namespace mach_zero::gateway {

// Maps NSE instrument tokens (uint32) to internal symbol IDs.
class NseSymbolMap {
public:
    NseSymbolMap() {
        // Pre-populate with common NSE instruments (token -> internal symbolId)
        add(2885,  101);  // RELIANCE
        add(3045,  102);  // SBIN
        add(11536, 103);  // TCS
        add(341249, 104); // HDFCBANK
        add(408065, 105); // INFY
        add(2953217, 106); // ICICIBANK
        add(969473, 107);  // KOTAKBANK
        add(3861249, 108); // HINDUNILVR
        add(60417, 109);   // AXISBANK
        add(779521, 110);  // ITC
    }

    void add(uint32_t token, uint64_t symbolId) {
        tokenToId_[token] = symbolId;
    }

    uint64_t toSymbolId(uint32_t token) const {
        auto it = tokenToId_.find(token);
        return (it != tokenToId_.end()) ? it->second : 0;
    }

private:
    std::unordered_map<uint32_t, uint64_t> tokenToId_;
};

} // namespace mach_zero::gateway
