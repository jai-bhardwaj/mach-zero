#pragma once

#include "RiskCheck.h"

namespace mach_zero::risk {

// Rejects if order rate per symbol exceeds N orders per window.
// Uses a simple per-symbol counter (reset externally on a timer).
class OrderRateCheck : public RiskCheck {
public:
    explicit OrderRateCheck(uint64_t maxOrdersPerWindow = 100)
        : maxOrders_(maxOrdersPerWindow) {}

    RiskResult validate(const OrderRequest& order, const RiskState& state) const override {
        uint64_t count = state.getOrderCount(order.symbolId());
        if (count >= maxOrders_) {
            return {false, RejectReason::OrderRate};
        }
        return {true, RejectReason::None};
    }

    std::string_view name() const override { return "OrderRateCheck"; }

private:
    uint64_t maxOrders_;
};

} // namespace mach_zero::risk
