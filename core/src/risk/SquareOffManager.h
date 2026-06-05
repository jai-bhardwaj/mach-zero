#pragma once

#include <common/ipc/SharedMemoryWriter.h>
#include <common/ipc/AeronPublisher.h>
#include <common/clock/Clock.h>
#include <mach_zero_market_data/OrderRequest.h>
#include <mach_zero_market_data/MessageHeader.h>
#include <mach_zero_market_data/Side.h>
#include <mach_zero_market_data/OrderType.h>
#include <mach_zero_market_data/TimeInForce.h>
#include <mach_zero_market_data/Venue.h>

#include <cstdint>
#include <cstdlib>
#include <atomic>
#include <vector>
#include <string>
#include <sstream>

namespace mach_zero::risk {

using namespace mach_zero::market_data;
using namespace mach_zero::ipc;

// Result of a single symbol square-off
struct SquareOffDetail {
    uint64_t symbolId;
    int64_t  position;      // Position before square-off
    bool     closingSell;   // true = sent Sell, false = sent Buy
};

// Result of a square-off operation
struct SquareOffResult {
    bool success;
    int  symbolsSquaredOff;
    std::vector<SquareOffDetail> details;

    std::string toJson() const {
        std::ostringstream oss;
        oss << R"({"success":)" << (success ? "true" : "false")
            << R"(,"symbolsSquaredOff":)" << symbolsSquaredOff
            << R"(,"details":[)";
        for (size_t i = 0; i < details.size(); ++i) {
            if (i > 0) oss << ",";
            oss << R"({"symbolId":)" << details[i].symbolId
                << R"(,"position":)" << details[i].position
                << R"(,"closingSide":")" << (details[i].closingSell ? "Sell" : "Buy")
                << "\"}";
        }
        oss << "]}";
        return oss.str();
    }
};

// Generates counter-orders to close open positions.
// Reads positions from shared memory and publishes market orders to
// VALIDATED_ORDER_STREAM (bypassing risk checks).
//
// SHM is pinned to tenantId=1's view in the shared-tier rollout
// (see risk-monitor main.cpp). Square-off for tenantId!=1 returns a
// successful no-op: the multi-tenant SHM is a tracked follow-up.
// The emitted OrderRequest carries the caller's tenantId so it routes
// correctly downstream regardless of the shm limitation.
class SquareOffManager {
public:
    // tenantId that the shared-memory view represents. Commit 3 pins this
    // to 1 (the default tenant). Multi-tenant SHM is a follow-up.
    static constexpr uint32_t SHM_TENANT_ID = 1;

    SquareOffManager(const SharedMemoryWriter& shm, AeronPublisher& orderPub)
        : shm_(shm), orderPub_(orderPub) {}

    // Square off a single symbol's position for the given tenant.
    SquareOffResult squareOffSymbol(uint32_t tenantId, uint64_t symbolId, Venue::Value venue) {
        SquareOffResult result{true, 0, {}};

        // Shared-tier limitation: shm is tenantId=1-only. Other tenants
        // see no positions via this path.
        if (tenantId != SHM_TENANT_ID) return result;

        const auto* sym = shm_.getSymbol(symbolId);
        if (!sym || sym->position == 0) {
            return result;
        }

        int64_t pos = sym->position;
        auto side = pos > 0 ? Side::Value::Sell : Side::Value::Buy;
        uint64_t qty = static_cast<uint64_t>(std::abs(pos));

        if (emitCloseOrder(tenantId, symbolId, side, qty, venue)) {
            result.symbolsSquaredOff = 1;
            result.details.push_back({symbolId, pos, pos > 0});
        } else {
            result.success = false;
        }

        return result;
    }

    // Square off ALL non-zero positions for the given tenant.
    SquareOffResult squareOffAll(uint32_t tenantId, Venue::Value venue) {
        SquareOffResult result{true, 0, {}};

        if (tenantId != SHM_TENANT_ID) return result;

        for (uint64_t i = 0; i < SHM_MAX_SYMBOLS; ++i) {
            const auto* sym = shm_.getSymbol(i);
            if (!sym || sym->position == 0) continue;

            int64_t pos = sym->position;
            auto side = pos > 0 ? Side::Value::Sell : Side::Value::Buy;
            uint64_t qty = static_cast<uint64_t>(std::abs(pos));

            if (emitCloseOrder(tenantId, i, side, qty, venue)) {
                result.symbolsSquaredOff++;
                result.details.push_back({i, pos, pos > 0});
            }
        }

        return result;
    }

private:
    bool emitCloseOrder(uint32_t tenantId, uint64_t symbolId, Side::Value side,
                        uint64_t quantity, Venue::Value venue) {
        char buf[256];
        uint64_t orderId = nextOrderId_.fetch_add(1, std::memory_order_relaxed);
        uint64_t ts = static_cast<uint64_t>(
            std::chrono::duration_cast<std::chrono::nanoseconds>(
                std::chrono::system_clock::now().time_since_epoch()).count());

        OrderRequest req;
        req.wrapAndApplyHeader(buf, 0, sizeof(buf));
        req.orderId(orderId)
           .clientOrderId(orderId)
           .symbolId(symbolId)
           .side(side)
           .price(0)  // Market order — no price
           .quantity(quantity)
           .orderType(OrderType::Value::Market)
           .timeInForce(TimeInForce::Value::IOC)
           .venue(venue)
           .timestamp(ts)
           .tenantId(tenantId);

        // Square-off is a safety action (flattening positions); retry transient
        // Aeron back-pressure rather than spuriously failing on a term rotation.
        return orderPub_.publishReliable(buf, OrderRequest::sbeBlockAndHeaderLength());
    }

    const SharedMemoryWriter& shm_;
    AeronPublisher& orderPub_;
    std::atomic<uint64_t> nextOrderId_{900000};  // High range to avoid collisions with strategy orders
};

} // namespace mach_zero::risk
