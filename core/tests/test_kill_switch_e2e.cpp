#include <gtest/gtest.h>
#include <risk/KillSwitch.h>
#include <risk/RiskEngine.h>
#include <mach_zero_market_data/OrderRequest.h>
#include <mach_zero_market_data/MessageHeader.h>
#include <mach_zero_market_data/Side.h>
#include <mach_zero_market_data/Venue.h>
#include <mach_zero_market_data/OrderType.h>
#include <mach_zero_market_data/TimeInForce.h>
#include <mach_zero_market_data/RejectReason.h>
#include <infra/tuning/LatencyBench.h>
#include <chrono>
#include <cstring>
#include <thread>
#include <atomic>

using namespace mach_zero::risk;
using namespace mach_zero::market_data;
using namespace mach_zero::tuning;

static OrderRequest makeTestOrder(char* buf, size_t bufSize, uint32_t tenantId = 1) {
    std::memset(buf, 0, bufSize);   // defensive — SBE reads raw bytes
    OrderRequest req;
    req.wrapAndApplyHeader(buf, 0, bufSize);
    req.orderId(1).clientOrderId(1).symbolId(1)
       .side(Side::Value::Buy).price(5000000000000LL).quantity(100000000ULL)
       .orderType(OrderType::Limit).timeInForce(TimeInForce::GTC)
       .venue(Venue::Binance).timestamp(1000000000ULL)
       .tenantId(tenantId);

    MessageHeader hdr(buf, bufSize, MessageHeader::sbeSchemaVersion());
    OrderRequest decoded;
    decoded.wrapForDecode(buf, MessageHeader::encodedLength(),
                          hdr.blockLength(), hdr.version(), bufSize);
    return decoded;
}

TEST(KillSwitchE2E, HaltsOrderFlow) {
    RiskEngine engine;

    // Orders should pass normally
    char buf[256];
    auto order = makeTestOrder(buf, sizeof(buf));
    auto result = engine.validate(order);
    EXPECT_TRUE(result.passed);

    // Activate kill switch for this tenant
    engine.killSwitch().activate(1);

    // Orders should now be rejected
    char buf2[256];
    auto order2 = makeTestOrder(buf2, sizeof(buf2));
    auto result2 = engine.validate(order2);
    EXPECT_FALSE(result2.passed);
    EXPECT_EQ(result2.reason, RejectReason::KillSwitch);

    // Deactivate
    engine.killSwitch().deactivate(1);

    // Orders should pass again
    char buf3[256];
    auto order3 = makeTestOrder(buf3, sizeof(buf3));
    auto result3 = engine.validate(order3);
    EXPECT_TRUE(result3.passed);
}

TEST(KillSwitchE2E, ActivationLatency) {
    KillSwitch ks;
    LatencyBench bench;

    constexpr int ITERATIONS = 100000;
    for (int i = 0; i < ITERATIONS; ++i) {
        ks.deactivate(1);

        auto start = LatencyBench::now();
        ks.activate(1);
        bool triggered = ks.isActive(1);
        auto end = LatencyBench::now();

        bench.record(end - start);
        EXPECT_TRUE(triggered);
    }

    auto stats = bench.compute();
    std::cout << bench.report("KillSwitch Activation") << std::endl;

    // Kill switch must activate within 1 microsecond
    EXPECT_LT(stats.p99, 1000u) << "Kill switch activation p99 exceeded 1us: "
                                 << stats.p99 << " ns";
}

TEST(KillSwitchE2E, CrossThreadVisibility) {
    KillSwitch ks;
    std::atomic<bool> seenActivation{false};
    std::atomic<bool> done{false};

    std::thread reader([&]() {
        while (!done.load(std::memory_order_relaxed)) {
            if (ks.isActive(1)) {
                seenActivation.store(true);
                return;
            }
        }
    });

    std::this_thread::sleep_for(std::chrono::milliseconds(1));

    ks.activate(1);

    auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(1);
    while (!seenActivation.load() && std::chrono::steady_clock::now() < deadline) {
        std::this_thread::sleep_for(std::chrono::microseconds(10));
    }

    done.store(true);
    reader.join();

    EXPECT_TRUE(seenActivation.load()) << "Reader thread did not see kill switch activation";
}

// --- Per-tenant kill switch tests ---

TEST(KillSwitchE2E, PerTenantKillDoesNotAffectOtherTenant) {
    RiskEngine engine;

    engine.killSwitch().activate(1);   // kill tenant 1 only

    // Tenant 1 order rejected
    char buf1[256];
    auto order1 = makeTestOrder(buf1, sizeof(buf1), /*tenantId=*/1);
    auto result1 = engine.validate(order1);
    EXPECT_FALSE(result1.passed);
    EXPECT_EQ(result1.reason, RejectReason::KillSwitch);

    // Tenant 2 order accepted
    char buf2[256];
    auto order2 = makeTestOrder(buf2, sizeof(buf2), /*tenantId=*/2);
    auto result2 = engine.validate(order2);
    EXPECT_TRUE(result2.passed);
}

TEST(KillSwitchE2E, GlobalKillStopsAllTenants) {
    RiskEngine engine;

    engine.killSwitch().activate(0);   // global kill at engineId=0

    // Tenants 1, 2, 3 all rejected
    for (uint32_t t : {1u, 2u, 3u}) {
        char buf[256];
        auto order = makeTestOrder(buf, sizeof(buf), t);
        auto result = engine.validate(order);
        EXPECT_FALSE(result.passed) << "tenant " << t << " should be halted by global kill";
        EXPECT_EQ(result.reason, RejectReason::KillSwitch);
    }
}

TEST(KillSwitchE2E, DeactivateClearsOnlyTargetedTenant) {
    RiskEngine engine;

    engine.killSwitch().activate(1);
    engine.killSwitch().activate(2);
    engine.killSwitch().deactivate(1);

    char buf1[256];
    auto order1 = makeTestOrder(buf1, sizeof(buf1), 1);
    EXPECT_TRUE(engine.validate(order1).passed);

    char buf2[256];
    auto order2 = makeTestOrder(buf2, sizeof(buf2), 2);
    EXPECT_FALSE(engine.validate(order2).passed);
}

TEST(KillSwitchE2E, GlobalKillTrumpsPerTenantClear) {
    RiskEngine engine;

    engine.killSwitch().activate(0);      // global
    engine.killSwitch().deactivate(1);    // try to clear tenant 1

    char buf[256];
    auto order = makeTestOrder(buf, sizeof(buf), 1);
    auto result = engine.validate(order);
    EXPECT_FALSE(result.passed) << "Global kill should override per-tenant clear";
}
