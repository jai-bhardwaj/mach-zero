#pragma once

#include "RiskCheck.h"
#include "RiskState.h"
#include "TenantLimits.h"
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
//
// RiskState is heap-allocated because its ~16MB tenant-partitioned 2D arrays
// would overflow the typical 8MB thread stack.
class RiskEngine {
public:
    RiskEngine() : state_(std::make_unique<RiskState>()) {
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
        // Entry check: tenant must be in valid range.
        // tenantId=0 is reserved for the global admin kill-switch channel;
        // production orders must have engineId >= 1 && < MAX_TENANTS.
        uint32_t tenantId = order.tenantId();
        if (tenantId == 0 || tenantId >= RiskState::MAX_TENANTS) {
            return {false, RejectReason::InvalidTenant};
        }
        // If a limits registry is configured, reject unknown tenants —
        // fail-closed so a new Postgres tenant that hasn't landed in
        // limits.json yet can't place unlimited orders.
        if (limits_ && !limits_->isKnown(tenantId)) {
            return {false, RejectReason::InvalidTenant};
        }

        for (const auto& check : checks_) {
            auto result = check->validate(order, *state_);
            if (!result.passed) {
                return result;
            }
        }
        // Update state for tracking
        state_->incrementOrderCount(tenantId, order.symbolId());
        return {true, RejectReason::None};
    }

    // Wire up the per-tenant limits registry. Called at engine startup
    // after loading tenant_limits.json. Tests without a registry fall
    // back to the compile-time defaults in each RiskCheck.
    void setLimitsRegistry(const TenantLimitsRegistry* reg) { limits_ = reg; }

    // Create an SBE OrderReject message. tenantId is copied from the
    // originating order so the reject routes back to the correct tenant's
    // strategy instance.
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
                    std::chrono::system_clock::now().time_since_epoch()).count()))
            .tenantId(order.tenantId())
            .symbolId(order.symbolId())
            .strategyId(order.strategyId());
        return OrderReject::sbeBlockAndHeaderLength();
    }

    // Update last price from market data. Keyed by (venue, symbolId) —
    // public market data, shared across tenants but segregated by exchange.
    void onTrade(const Trade& trade) {
        state_->setLastPrice(trade.venueRaw(), trade.symbolId(), trade.price());
    }

    // Access the kill switch
    KillSwitch& killSwitch() { return *killSwitch_; }
    const KillSwitch& killSwitch() const { return *killSwitch_; }

    // Access risk state
    RiskState& state() { return *state_; }
    const RiskState& state() const { return *state_; }

    // Reset order rate counters across all tenants (call on a timer)
    void resetRateCounters() { state_->resetAllOrderCounts(); }

private:
    std::vector<std::shared_ptr<RiskCheck>> checks_;
    std::shared_ptr<KillSwitch> killSwitch_;
    std::unique_ptr<RiskState> state_;
    const TenantLimitsRegistry* limits_ = nullptr;  // Optional, set at startup
};

} // namespace mach_zero::risk
