#pragma once

#include "RiskCheck.h"
#include <atomic>

namespace mach_zero::risk {

// Global halt mechanism. When triggered, rejects ALL orders instantly.
// Uses an atomic boolean for lock-free, sub-nanosecond check.
class KillSwitch : public RiskCheck {
public:
    RiskResult validate(const OrderRequest& /*order*/, const RiskState& /*state*/) const override {
        if (active_.load(std::memory_order_acquire)) {
            return {false, RejectReason::KillSwitch};
        }
        return {true, RejectReason::None};
    }

    std::string_view name() const override { return "KillSwitch"; }

    void activate() { active_.store(true, std::memory_order_release); }
    void deactivate() { active_.store(false, std::memory_order_release); }
    bool isActive() const { return active_.load(std::memory_order_acquire); }

private:
    std::atomic<bool> active_{false};
};

} // namespace mach_zero::risk
