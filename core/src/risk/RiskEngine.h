#pragma once

#include "RiskCheck.h"
#include "RiskState.h"
#include "KillSwitch.h"
#include "PriceBandCheck.h"
#include "PositionLimitCheck.h"
#include "OrderRateCheck.h"
#include "MaxOrderSizeCheck.h"
#include <mach_zero_market_data/OrderRequest.h>
#include <mach_zero_market_data/OrderReject.h>
#include <mach_zero_market_data/RejectReason.h>
#include <mach_zero_market_data/Trade.h>
#include <mach_zero_market_data/MessageHeader.h>
#include <vector>
#include <memory>
#include <chrono>

namespace mach_zero::risk {

using namespace mach_zero::market_data;

// Pre-trade risk validation pipeline.
// Chains multiple RiskCheck instances. If any check fails, the order is rejected.
class RiskEngine {
public:
    RiskEngine() {
        // Kill switch is always first (fastest check)
        killSwitch_ = std::make_shared<KillSwitch>();
        checks_.push_back(killSwitch_);
        checks_.push_back(std::make_shared<PriceBandCheck>());
        checks_.push_back(std::make_shared<PositionLimitCheck>());
        checks_.push_back(std::make_shared<OrderRateCheck>());
        checks_.push_back(std::make_shared<MaxOrderSizeCheck>());
    }

    // Validate an order against all risk checks.
    // Returns true if passed, false if rejected (sets rejectReason).
    RiskResult validate(const OrderRequest& order) {
        for (const auto& check : checks_) {
            auto result = check->validate(order, state_);
            if (!result.passed) {
                return result;
            }
        }
        // Update state for tracking
        state_.incrementOrderCount(order.symbolId());
        return {true, RejectReason::None};
    }

    // Create an SBE OrderReject message
    size_t createReject(const OrderRequest& order, RejectReason::Value reason,
                        char* outBuf, size_t outBufLen) {
        OrderReject reject;
        reject.wrapAndApplyHeader(outBuf, 0, static_cast<uint64_t>(outBufLen));
        reject.orderId(order.orderId())
            .clientOrderId(order.clientOrderId())
            .rejectReason(reason)
            .venue(order.venue())
            .timestamp(static_cast<uint64_t>(
                std::chrono::duration_cast<std::chrono::nanoseconds>(
                    std::chrono::system_clock::now().time_since_epoch()).count()));
        return OrderReject::sbeBlockAndHeaderLength();
    }

    // Update last price from market data (for price band checks)
    void onTrade(const Trade& trade) {
        state_.setLastPrice(trade.symbolId(), trade.price());
    }

    // Access the kill switch
    KillSwitch& killSwitch() { return *killSwitch_; }
    const KillSwitch& killSwitch() const { return *killSwitch_; }

    // Access risk state
    RiskState& state() { return state_; }
    const RiskState& state() const { return state_; }

    // Reset order rate counters (call on a timer)
    void resetRateCounters() { state_.resetOrderCounts(); }

private:
    std::vector<std::shared_ptr<RiskCheck>> checks_;
    std::shared_ptr<KillSwitch> killSwitch_;
    RiskState state_;
};

} // namespace mach_zero::risk
