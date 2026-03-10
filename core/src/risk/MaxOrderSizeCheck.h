#pragma once

#include "RiskCheck.h"

namespace mach_zero::risk {

// Rejects single orders exceeding a configurable quantity threshold.
class MaxOrderSizeCheck : public RiskCheck {
public:
    explicit MaxOrderSizeCheck(uint64_t maxQuantity = 10000000000ULL) // 100.0 in fixed-point
        : maxQuantity_(maxQuantity) {}

    RiskResult validate(const OrderRequest& order, const RiskState& /*state*/) const override {
        if (order.quantity() > maxQuantity_) {
            return {false, RejectReason::MaxOrderSize};
        }
        return {true, RejectReason::None};
    }

    std::string_view name() const override { return "MaxOrderSizeCheck"; }

private:
    uint64_t maxQuantity_;
};

} // namespace mach_zero::risk
