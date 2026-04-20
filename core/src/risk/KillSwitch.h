#pragma once

#include "RiskCheck.h"
#include "RiskState.h"
#include <atomic>
#include <array>

namespace mach_zero::risk {

// Per-tenant halt mechanism.
//
// flags_[0]         — GLOBAL admin kill switch. When set, halts every
//                     tenant's order flow. Reserved for SUPER_ADMIN.
// flags_[1..N-1]    — per-tenant kill switches. Set independently.
//
// isActive(engineId) returns true if either the global flag OR the
// tenant's own flag is set. The check is three atomic loads (acquire
// ordering) — fits comfortably in the < 50ns kill-switch budget.
//
// Pre-allocated fixed-size array (MAX_TENANTS atomics = 1024 bytes) —
// no runtime map growth, no rehash race on the hot path.
class KillSwitch : public RiskCheck {
public:
    KillSwitch() {
        // Explicit init. C++20 value-initializes std::atomic<bool> to false,
        // but we set it explicitly as a defensive precaution for older
        // toolchains and to document intent.
        for (auto& flag : flags_) flag.store(false, std::memory_order_relaxed);
    }

    RiskResult validate(const OrderRequest& order, const RiskState&) const override {
        // order.tenantId() was already bounds-checked by RiskEngine's entry
        // check. Accessing flags_ at that index is safe.
        if (flags_[0].load(std::memory_order_acquire)) {
            return {false, RejectReason::KillSwitch};   // global kill
        }
        if (flags_[order.tenantId()].load(std::memory_order_acquire)) {
            return {false, RejectReason::KillSwitch};   // per-tenant kill
        }
        return {true, RejectReason::None};
    }

    std::string_view name() const override { return "KillSwitch"; }

    // --- Per-tenant API ---

    void activate(uint32_t engineId) {
        if (engineId >= RiskState::MAX_TENANTS) return;
        flags_[engineId].store(true, std::memory_order_release);
    }

    void deactivate(uint32_t engineId) {
        if (engineId >= RiskState::MAX_TENANTS) return;
        flags_[engineId].store(false, std::memory_order_release);
    }

    // True if the given tenant would be blocked (either by own flag or
    // by the global kill at engineId=0).
    bool isActive(uint32_t engineId) const {
        if (engineId >= RiskState::MAX_TENANTS) return true;  // fail-closed
        if (flags_[0].load(std::memory_order_acquire)) return true;
        return flags_[engineId].load(std::memory_order_acquire);
    }

    // --- Legacy no-arg API (preserved for existing callers/tests). ---
    // These target the global admin kill (engineId=0). Kept so existing
    // single-tenant callers continue to work during migration.
    void activate()       { activate(0); }
    void deactivate()     { deactivate(0); }
    bool isActive() const { return flags_[0].load(std::memory_order_acquire); }

private:
    std::array<std::atomic<bool>, RiskState::MAX_TENANTS> flags_;
};

} // namespace mach_zero::risk
