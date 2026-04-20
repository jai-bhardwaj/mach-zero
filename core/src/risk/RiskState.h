#pragma once

#include <array>
#include <cstdint>
#include <cstddef>
#include <memory>

namespace mach_zero::risk {

// Reserved tenant IDs:
//   0 = global admin (kill switch control plane only; no real orders).
//   1..MAX_TENANTS-1 = real tenants, mapped from Prisma Tenant via engineId.
//
// Per-tenant accounting is flat 2D arrays indexed by (tenantId, symbolId)
// so the risk hot path stays cache-friendly — no std::unordered_map lookups.
// The Arrays struct is ~16MB, which exceeds typical 8MB stack limits, so it
// is heap-allocated via unique_ptr<Arrays>; RiskState itself is tiny.
//
// lastPrices is partitioned by venue (not tenant) because a single engine
// can serve mixed testnet + mainnet tenants, and BTCUSDT's price differs
// between those venues.
class RiskState {
public:
    static constexpr std::size_t MAX_SYMBOLS = 1024;
    static constexpr std::size_t MAX_TENANTS = 1024;
    static constexpr std::size_t NUM_VENUES  = 8;   // Venue enum has 4 today; headroom for BSE, future exchanges

    RiskState() : arr_(std::make_unique<Arrays>()) {}

    // --- Position accounting (per (tenantId, symbolId)) ---

    int64_t getPosition(uint32_t tenantId, uint64_t symbolId) const {
        if (tenantId >= MAX_TENANTS || symbolId >= MAX_SYMBOLS) return 0;
        return arr_->positions[tenantId][symbolId];
    }

    void updatePosition(uint32_t tenantId, uint64_t symbolId, int64_t delta) {
        if (tenantId >= MAX_TENANTS || symbolId >= MAX_SYMBOLS) return;
        arr_->positions[tenantId][symbolId] += delta;
    }

    void setPosition(uint32_t tenantId, uint64_t symbolId, int64_t pos) {
        if (tenantId >= MAX_TENANTS || symbolId >= MAX_SYMBOLS) return;
        arr_->positions[tenantId][symbolId] = pos;
    }

    // --- Last-price (per (venue, symbolId) — public market data) ---

    int64_t getLastPrice(uint8_t venue, uint64_t symbolId) const {
        if (venue >= NUM_VENUES || symbolId >= MAX_SYMBOLS) return 0;
        return arr_->lastPrices[venue][symbolId];
    }

    void setLastPrice(uint8_t venue, uint64_t symbolId, int64_t price) {
        if (venue >= NUM_VENUES || symbolId >= MAX_SYMBOLS) return;
        arr_->lastPrices[venue][symbolId] = price;
    }

    // --- Order rate counter (per (tenantId, symbolId)) ---

    uint64_t getOrderCount(uint32_t tenantId, uint64_t symbolId) const {
        if (tenantId >= MAX_TENANTS || symbolId >= MAX_SYMBOLS) return 0;
        return arr_->orderCounts[tenantId][symbolId];
    }

    void incrementOrderCount(uint32_t tenantId, uint64_t symbolId) {
        if (tenantId >= MAX_TENANTS || symbolId >= MAX_SYMBOLS) return;
        ++arr_->orderCounts[tenantId][symbolId];
    }

    // Targeted reset (periodic rate-counter rollover for one tenant)
    void resetOrderCounts(uint32_t tenantId) {
        if (tenantId >= MAX_TENANTS) return;
        arr_->orderCounts[tenantId].fill(0);
    }

    // Reset all tenants' order counts (used by the periodic timer)
    void resetAllOrderCounts() {
        for (auto& perTenant : arr_->orderCounts) perTenant.fill(0);
    }

    // Full reset (used only in tests). Allocates a fresh Arrays on heap.
    void reset() { arr_ = std::make_unique<Arrays>(); }

private:
    struct Arrays {
        std::array<std::array<int64_t,  MAX_SYMBOLS>, MAX_TENANTS> positions{};
        std::array<std::array<uint64_t, MAX_SYMBOLS>, MAX_TENANTS> orderCounts{};
        std::array<std::array<int64_t,  MAX_SYMBOLS>, NUM_VENUES>  lastPrices{};
    };

    std::unique_ptr<Arrays> arr_;
};

} // namespace mach_zero::risk
