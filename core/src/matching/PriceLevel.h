#pragma once

#include <cstdint>

namespace mach_zero::matching {

struct PriceLevel {
    int64_t price = 0;        // Fixed-point (8 decimals)
    uint64_t quantity = 0;    // Aggregated quantity at this price
    uint32_t orderCount = 0;  // Number of orders at this level

    bool empty() const { return quantity == 0; }
};

} // namespace mach_zero::matching
