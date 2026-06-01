// Cross-tenant isolation invariants for a financially-critical system.
// Any failure here is a potential cross-tenant leak — treat as a P0 bug.

#include <gtest/gtest.h>
#include <risk/RiskEngine.h>
#include <risk/TenantLimits.h>
#include <mach_zero_market_data/OrderRequest.h>
#include <mach_zero_market_data/MessageHeader.h>
#include <mach_zero_market_data/Side.h>
#include <mach_zero_market_data/Venue.h>
#include <mach_zero_market_data/OrderType.h>
#include <mach_zero_market_data/TimeInForce.h>
#include <mach_zero_market_data/RejectReason.h>
#include <array>
#include <cstring>
#include <random>
#include <unordered_map>

using namespace mach_zero::risk;
using namespace mach_zero::market_data;

namespace {

OrderRequest makeOrder(char* buf, size_t bufSize,
                       uint64_t orderId, uint32_t tenantId, uint64_t symbolId,
                       Side::Value side, int64_t price, uint64_t qty,
                       Venue::Value venue = Venue::Binance) {
    std::memset(buf, 0, bufSize);
    OrderRequest req;
    req.wrapAndApplyHeader(buf, 0, bufSize);
    req.orderId(orderId).clientOrderId(orderId).symbolId(symbolId)
       .side(side).price(price).quantity(qty)
       .orderType(OrderType::Limit).timeInForce(TimeInForce::GTC)
       .venue(venue).timestamp(1000000000ULL).tenantId(tenantId);

    MessageHeader hdr(buf, bufSize, MessageHeader::sbeSchemaVersion());
    OrderRequest decoded;
    decoded.wrapForDecode(buf, MessageHeader::encodedLength(),
                          hdr.blockLength(), hdr.version(), bufSize);
    return decoded;
}

} // namespace

TEST(TenantIsolation, PerTenantKillSwitchDoesNotCrossLeak) {
    RiskEngine engine;
    engine.killSwitch().activate(1);   // kill only tenant 1

    char b1[256], b2[256];
    auto o1 = makeOrder(b1, sizeof(b1), 100, /*tenant=*/1, 1,
                        Side::Value::Buy, 5000000000000LL, 100000000ULL);
    auto o2 = makeOrder(b2, sizeof(b2), 200, /*tenant=*/2, 1,
                        Side::Value::Buy, 5000000000000LL, 100000000ULL);

    EXPECT_FALSE(engine.validate(o1).passed);
    EXPECT_TRUE(engine.validate(o2).passed);
}

TEST(TenantIsolation, GlobalKillAtTenantZeroStopsEveryone) {
    RiskEngine engine;
    engine.killSwitch().activate(0);   // global

    for (uint32_t t : {1u, 2u, 3u, 5u, 99u}) {
        char buf[256];
        auto order = makeOrder(buf, sizeof(buf), 1, t, 1,
                               Side::Value::Buy, 5000000000000LL, 100000000ULL);
        auto result = engine.validate(order);
        EXPECT_FALSE(result.passed) << "tenant " << t << " should be halted";
        EXPECT_EQ(result.reason, RejectReason::KillSwitch);
    }
}

TEST(TenantIsolation, PerTenantPositionsDoNotShare) {
    RiskEngine engine;

    // Tenant 1 opens a position; tenant 2's position must remain 0.
    engine.state().setPosition(/*tenantId=*/1, /*symbolId=*/1, 500000000LL);
    EXPECT_EQ(engine.state().getPosition(1, 1), 500000000LL);
    EXPECT_EQ(engine.state().getPosition(2, 1), 0);
    EXPECT_EQ(engine.state().getPosition(99, 1), 0);
}

TEST(TenantIsolation, OrderCountsDoNotShare) {
    RiskEngine engine;

    for (int i = 0; i < 10; ++i) {
        engine.state().incrementOrderCount(1, 1);
    }
    EXPECT_EQ(engine.state().getOrderCount(1, 1), 10u);
    EXPECT_EQ(engine.state().getOrderCount(2, 1), 0u);

    // Reset one tenant's counter; the other should be untouched.
    engine.state().resetOrderCounts(1);
    EXPECT_EQ(engine.state().getOrderCount(1, 1), 0u);

    for (int i = 0; i < 5; ++i) {
        engine.state().incrementOrderCount(2, 1);
    }
    EXPECT_EQ(engine.state().getOrderCount(2, 1), 5u);
    EXPECT_EQ(engine.state().getOrderCount(1, 1), 0u);
}

TEST(TenantIsolation, OrderWithTenantIdZeroIsRejectedInvalidTenant) {
    RiskEngine engine;
    char buf[256];
    auto order = makeOrder(buf, sizeof(buf), 1, /*tenant=*/0, 1,
                           Side::Value::Buy, 5000000000000LL, 100000000ULL);
    auto result = engine.validate(order);
    EXPECT_FALSE(result.passed);
    EXPECT_EQ(result.reason, RejectReason::InvalidTenant)
        << "tenantId=0 is reserved for the global kill channel; orders must be rejected.";
}

TEST(TenantIsolation, OrderWithOutOfRangeTenantIdRejected) {
    RiskEngine engine;
    char buf[256];
    auto order = makeOrder(buf, sizeof(buf), 1,
                           /*tenant=*/static_cast<uint32_t>(RiskState::MAX_TENANTS + 5),
                           1, Side::Value::Buy, 5000000000000LL, 100000000ULL);
    auto result = engine.validate(order);
    EXPECT_FALSE(result.passed);
    EXPECT_EQ(result.reason, RejectReason::InvalidTenant);
}

TEST(TenantIsolation, UnknownTenantRejectedWhenRegistrySet) {
    TenantLimitsRegistry reg;
    TenantLimits lim;
    reg.set(1, lim);
    reg.set(2, lim);
    // Tenants 3..N deliberately not configured.

    RiskEngine engine;
    engine.setLimitsRegistry(&reg);

    char buf1[256], buf99[256];
    auto ok   = makeOrder(buf1, sizeof(buf1), 1, 1, 1,
                          Side::Value::Buy, 5000000000000LL, 100000000ULL);
    auto bad  = makeOrder(buf99, sizeof(buf99), 1, 99, 1,
                          Side::Value::Buy, 5000000000000LL, 100000000ULL);
    EXPECT_TRUE(engine.validate(ok).passed);
    auto result = engine.validate(bad);
    EXPECT_FALSE(result.passed);
    EXPECT_EQ(result.reason, RejectReason::InvalidTenant);
}

TEST(TenantIsolation, RejectCarriesOriginatingTenantId) {
    RiskEngine engine;
    char buf[256];
    auto order = makeOrder(buf, sizeof(buf), 42, /*tenant=*/17, 1,
                           Side::Value::Buy, 5000000000000LL, 100000000ULL);

    char rejectBuf[256];
    engine.createReject(order, RejectReason::PriceBand, rejectBuf, sizeof(rejectBuf));

    MessageHeader hdr(rejectBuf, sizeof(rejectBuf), MessageHeader::sbeSchemaVersion());
    OrderReject reject;
    reject.wrapForDecode(rejectBuf, MessageHeader::encodedLength(),
                         hdr.blockLength(), hdr.version(), sizeof(rejectBuf));
    EXPECT_EQ(reject.tenantId(), 17u);
}

// Fuzz test with a fixed seed so any failure is exactly reproducible.
// Runs N random orders across M tenants and asserts that the engine's
// per-tenant position matches an independently tracked expectation.
// Any divergence = cross-tenant state leak.
TEST(TenantIsolation, CrossTenantPositionInvariantUnderRandomLoad) {
    constexpr uint32_t NUM_TENANTS = 10;
    constexpr uint64_t NUM_SYMBOLS = 5;
    constexpr int NUM_ORDERS_PER_TENANT = 200;

    std::mt19937 rng(0xDEADBEEF);  // fixed seed → reproducible
    std::uniform_int_distribution<uint32_t> tenantDist(1, NUM_TENANTS);
    std::uniform_int_distribution<uint64_t> symbolDist(1, NUM_SYMBOLS);
    std::uniform_int_distribution<uint32_t> sideDist(0, 1);
    std::uniform_int_distribution<uint64_t> qtyDist(1, 50);

    RiskEngine engine;

    // Expected[tenantId][symbolId] = sum of signed qtys
    std::unordered_map<uint64_t, int64_t> expected;  // key = tenantId << 32 | symbolId

    for (int i = 0; i < NUM_ORDERS_PER_TENANT * NUM_TENANTS; ++i) {
        uint32_t t = tenantDist(rng);
        uint64_t s = symbolDist(rng);
        auto side = sideDist(rng) ? Side::Value::Buy : Side::Value::Sell;
        uint64_t qty = qtyDist(rng);
        int64_t signed_qty = (side == Side::Value::Buy) ? int64_t(qty) : -int64_t(qty);

        // Apply to expected-state map
        uint64_t key = (static_cast<uint64_t>(t) << 32) | s;
        expected[key] += signed_qty;

        // Apply to engine-state directly — we're testing the state
        // partitioning invariant, not the validator path.
        engine.state().updatePosition(t, s, signed_qty);
    }

    // Verify: every expected entry matches, and the engine has no
    // surprise non-zero entries that weren't written.
    for (const auto& [key, expectedPos] : expected) {
        uint32_t t = static_cast<uint32_t>(key >> 32);
        uint64_t s = key & 0xFFFFFFFFu;
        EXPECT_EQ(engine.state().getPosition(t, s), expectedPos)
            << "Position mismatch for tenant=" << t << " symbol=" << s;
    }

    // Sanity: tenants not touched by random traffic have 0 across all
    // symbols they weren't assigned (proves no cross-tenant writes).
    for (uint32_t t = NUM_TENANTS + 1; t <= NUM_TENANTS + 5; ++t) {
        for (uint64_t s = 1; s <= NUM_SYMBOLS; ++s) {
            EXPECT_EQ(engine.state().getPosition(t, s), 0)
                << "Untouched tenant " << t << " symbol " << s << " got nonzero position";
        }
    }
}
