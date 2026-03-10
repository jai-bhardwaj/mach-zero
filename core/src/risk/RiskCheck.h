#pragma once

#include <mach_zero_market_data/OrderRequest.h>
#include <mach_zero_market_data/RejectReason.h>
#include "RiskState.h"
#include <string_view>

namespace mach_zero::risk {

using namespace mach_zero::market_data;

// Abstract interface for a single risk check.
struct RiskResult {
    bool passed;
    RejectReason::Value reason;
};

class RiskCheck {
public:
    virtual ~RiskCheck() = default;
    virtual RiskResult validate(const OrderRequest& order, const RiskState& state) const = 0;
    virtual std::string_view name() const = 0;
};

} // namespace mach_zero::risk
