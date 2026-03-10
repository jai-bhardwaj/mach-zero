#include <gtest/gtest.h>
#include <risk/KillSwitch.h>
#include <risk/RiskEngine.h>
#include <mach_zero_market_data/OrderRequest.h>
#include <mach_zero_market_data/MessageHeader.h>
#include <mach_zero_market_data/Side.h>
#include <mach_zero_market_data/Venue.h>
#include <mach_zero_market_data/OrderType.h>
#include <mach_zero_market_data/TimeInForce.h>
#include <infra/tuning/LatencyBench.h>
#include <chrono>
#include <thread>
#include <atomic>

using namespace mach_zero::risk;
using namespace mach_zero::market_data;
using namespace mach_zero::tuning;

static OrderRequest makeTestOrder(char* buf, size_t bufSize) {
    OrderRequest req;
    req.wrapAndApplyHeader(buf, 0, bufSize);
    req.orderId(1).clientOrderId(1).symbolId(1)
       .side(Side::Value::Buy).price(5000000000000LL).quantity(100000000ULL)
       .orderType(OrderType::Limit).timeInForce(TimeInForce::GTC)
       .venue(Venue::Binance).timestamp(1000000000ULL);

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

    // Activate kill switch
    engine.killSwitch().activate();

    // Orders should now be rejected
    char buf2[256];
    auto order2 = makeTestOrder(buf2, sizeof(buf2));
    auto result2 = engine.validate(order2);
    EXPECT_FALSE(result2.passed);

    // Deactivate
    engine.killSwitch().deactivate();

    // Orders should pass again
    char buf3[256];
    auto order3 = makeTestOrder(buf3, sizeof(buf3));
    auto result3 = engine.validate(order3);
    EXPECT_TRUE(result3.passed);
}

TEST(KillSwitchE2E, ActivationLatency) {
    KillSwitch ks;
    LatencyBench bench;

    // Measure kill switch activation latency
    constexpr int ITERATIONS = 100000;
    for (int i = 0; i < ITERATIONS; ++i) {
        ks.deactivate();

        auto start = LatencyBench::now();
        ks.activate();
        bool triggered = ks.isActive();
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

    // Reader thread: poll until kill switch is seen
    std::thread reader([&]() {
        while (!done.load(std::memory_order_relaxed)) {
            if (ks.isActive()) {
                seenActivation.store(true);
                return;
            }
        }
    });

    // Give reader thread time to start
    std::this_thread::sleep_for(std::chrono::milliseconds(1));

    // Activate from main thread
    ks.activate();

    // Wait for reader to see it (with timeout)
    auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(1);
    while (!seenActivation.load() && std::chrono::steady_clock::now() < deadline) {
        std::this_thread::sleep_for(std::chrono::microseconds(10));
    }

    done.store(true);
    reader.join();

    EXPECT_TRUE(seenActivation.load()) << "Reader thread did not see kill switch activation";
}
