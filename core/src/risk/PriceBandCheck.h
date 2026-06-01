#pragma once

#include "RiskCheck.h"
#include <cstdlib>

namespace mach_zero::risk {

// Rejects orders where the price deviates more than a configurable
// percentage from the last traded price on the same venue.
// lastPrices is venue-scoped so mixed testnet/mainnet tenants on one
// engine don't contaminate each other's band checks.
class PriceBandCheck : public RiskCheck {
public:
    explicit PriceBandCheck(double maxDeviationPct = 5.0)
        : maxDeviation_(maxDeviationPct / 100.0) {}

    RiskResult validate(const OrderRequest& order, const RiskState& state) const override {
        int64_t lastPrice = state.getLastPrice(order.venueRaw(), order.symbolId());
        if (lastPrice == 0) return {true, RejectReason::None}; // No reference price yet

        int64_t orderPrice = order.price();
        double deviation = std::abs(static_cast<double>(orderPrice - lastPrice)) /
                          static_cast<double>(lastPrice);

        if (deviation > maxDeviation_) {
            return {false, RejectReason::PriceBand};
        }
        return {true, RejectReason::None};
    }

    std::string_view name() const override { return "PriceBandCheck"; }

private:
    double maxDeviation_;
};

} // namespace mach_zero::risk
