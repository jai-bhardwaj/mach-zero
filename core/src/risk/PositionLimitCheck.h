#pragma once

#include "RiskCheck.h"
#include <mach_zero_market_data/Side.h>
#include <cstdlib>

namespace mach_zero::risk {

// Rejects orders that would cause the tenant's net position on a symbol
// to exceed the configured limit. Position is accounted per (tenantId,
// symbolId), so tenants are isolated.
class PositionLimitCheck : public RiskCheck {
public:
    explicit PositionLimitCheck(int64_t maxPosition = 1000000000LL) // 10.0 in fixed-point
        : maxPosition_(maxPosition) {}

    RiskResult validate(const OrderRequest& order, const RiskState& state) const override {
        int64_t currentPos = state.getPosition(order.tenantId(), order.symbolId());
        int64_t orderQty = static_cast<int64_t>(order.quantity());

        int64_t newPos = currentPos;
        if (order.side() == Side::Value::Buy) {
            newPos += orderQty;
        } else {
            newPos -= orderQty;
        }

        if (std::abs(newPos) > maxPosition_) {
            return {false, RejectReason::PositionLimit};
        }
        return {true, RejectReason::None};
    }

    std::string_view name() const override { return "PositionLimitCheck"; }

private:
    int64_t maxPosition_;
};

} // namespace mach_zero::risk
