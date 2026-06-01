#include <gtest/gtest.h>
#include <infra/tuning/LatencyBench.h>
#include <common/memory/ArenaAllocator.h>
#include <risk/RiskEngine.h>
#include <matching/OrderBook.h>
#include <mach_zero_market_data/Trade.h>
#include <mach_zero_market_data/Quote.h>
#include <mach_zero_market_data/OrderRequest.h>
#include <mach_zero_market_data/MessageHeader.h>
#include <mach_zero_market_data/Side.h>
#include <mach_zero_market_data/Venue.h>
#include <mach_zero_market_data/OrderType.h>
#include <mach_zero_market_data/TimeInForce.h>

using namespace mach_zero::tuning;
using namespace mach_zero::risk;
using namespace mach_zero::matching;
using namespace mach_zero::market_data;

// --- Risk Engine Latency Regression ---

TEST(LatencyRegression, RiskGateP99Under5us) {
    RiskEngine engine;
    LatencyBench bench;

    // Warm up
    for (int i = 0; i < 1000; ++i) {
        char buf[256];
        OrderRequest req;
        req.wrapAndApplyHeader(buf, 0, sizeof(buf));
        req.orderId(i).clientOrderId(i).symbolId(1)
           .side(Side::Value::Buy).price(5000000000000LL).quantity(100000000ULL)
           .orderType(OrderType::Limit).timeInForce(TimeInForce::GTC)
           .venue(Venue::Binance).timestamp(1000000000ULL).tenantId(1);

        MessageHeader hdr(buf, sizeof(buf), MessageHeader::sbeSchemaVersion());
        OrderRequest decoded;
        decoded.wrapForDecode(buf, MessageHeader::encodedLength(),
                              hdr.blockLength(), hdr.version(), sizeof(buf));
        engine.validate(decoded);
    }

    // Benchmark
    constexpr int ITERATIONS = 100000;
    for (int i = 0; i < ITERATIONS; ++i) {
        char buf[256];
        OrderRequest req;
        req.wrapAndApplyHeader(buf, 0, sizeof(buf));
        req.orderId(i).clientOrderId(i).symbolId(1)
           .side(Side::Value::Buy).price(5000000000000LL).quantity(100000000ULL)
           .orderType(OrderType::Limit).timeInForce(TimeInForce::GTC)
           .venue(Venue::Binance).timestamp(1000000000ULL).tenantId(1);

        MessageHeader hdr(buf, sizeof(buf), MessageHeader::sbeSchemaVersion());
        OrderRequest decoded;
        decoded.wrapForDecode(buf, MessageHeader::encodedLength(),
                              hdr.blockLength(), hdr.version(), sizeof(buf));

        auto start = LatencyBench::now();
        auto result = engine.validate(decoded);
        auto end = LatencyBench::now();

        bench.record(end - start);
        (void)result;
    }

    auto stats = bench.compute();
    std::cout << bench.report("RiskGate") << std::endl;

    // Regression: p99 must be under 5 microseconds
    EXPECT_LT(stats.p99, 5000u) << "Risk gate p99 exceeded 5us target: "
                                 << stats.p99 << " ns";
}

// Multi-tenant regression: 4 tenants round-robin. Budget same 5us ceiling
// as single-tenant. If regression pushes multi-tenant above budget, the
// first place to look is RiskState's cache layout.
TEST(LatencyRegression, MultiTenantRiskGateP99) {
    RiskEngine engine;
    LatencyBench bench;

    auto makeOrderForTenant = [&](char* buf, size_t bufLen, uint64_t id, uint32_t tenantId) {
        OrderRequest req;
        req.wrapAndApplyHeader(buf, 0, bufLen);
        req.orderId(id).clientOrderId(id).symbolId(1)
           .side(Side::Value::Buy).price(5000000000000LL).quantity(100000000ULL)
           .orderType(OrderType::Limit).timeInForce(TimeInForce::GTC)
           .venue(Venue::Binance).timestamp(1000000000ULL).tenantId(tenantId);
    };

    // Warm up across 4 tenants
    for (int i = 0; i < 1000; ++i) {
        char buf[256];
        uint32_t tenantId = static_cast<uint32_t>((i % 4) + 1);
        makeOrderForTenant(buf, sizeof(buf), i, tenantId);
        MessageHeader hdr(buf, sizeof(buf), MessageHeader::sbeSchemaVersion());
        OrderRequest decoded;
        decoded.wrapForDecode(buf, MessageHeader::encodedLength(),
                              hdr.blockLength(), hdr.version(), sizeof(buf));
        engine.validate(decoded);
    }

    constexpr int ITERATIONS = 100000;
    for (int i = 0; i < ITERATIONS; ++i) {
        char buf[256];
        uint32_t tenantId = static_cast<uint32_t>((i % 4) + 1);
        makeOrderForTenant(buf, sizeof(buf), i, tenantId);
        MessageHeader hdr(buf, sizeof(buf), MessageHeader::sbeSchemaVersion());
        OrderRequest decoded;
        decoded.wrapForDecode(buf, MessageHeader::encodedLength(),
                              hdr.blockLength(), hdr.version(), sizeof(buf));

        auto start = LatencyBench::now();
        auto result = engine.validate(decoded);
        auto end = LatencyBench::now();

        bench.record(end - start);
        (void)result;
    }

    auto stats = bench.compute();
    std::cout << bench.report("MultiTenantRiskGate (4 tenants)") << std::endl;

    EXPECT_LT(stats.p99, 5000u)
        << "Multi-tenant risk gate p99 exceeded 5us target: " << stats.p99 << " ns";
}

// --- Order Book Update Latency Regression ---

TEST(LatencyRegression, OrderBookUpdateP99Under500ns) {
    OrderBook book;
    LatencyBench bench;

    // Warm up
    for (int i = 0; i < 1000; ++i) {
        book.setBid(50000 * 100000000LL + i * 100000000LL, 100, 1);
    }
    book.clear();

    // Benchmark
    constexpr int ITERATIONS = 100000;
    for (int i = 0; i < ITERATIONS; ++i) {
        int64_t price = 50000 * 100000000LL + (i % 100) * 100000000LL;

        auto start = LatencyBench::now();
        book.setBid(price, 100 + i, 1);
        auto end = LatencyBench::now();

        bench.record(end - start);
    }

    auto stats = bench.compute();
    std::cout << bench.report("OrderBookUpdate") << std::endl;

    // Regression: p99 must be under 500 nanoseconds
    EXPECT_LT(stats.p99, 500u) << "Order book update p99 exceeded 500ns target: "
                                << stats.p99 << " ns";
}

// --- Arena Allocator Latency ---

TEST(LatencyRegression, ArenaAllocatorZeroOverhead) {
    using namespace mach_zero::memory;
    ArenaAllocator arena(1024 * 1024); // 1MB
    LatencyBench bench;

    constexpr int ITERATIONS = 100000;
    for (int i = 0; i < ITERATIONS; ++i) {
        auto start = LatencyBench::now();
        void* ptr = arena.allocate(64);
        auto end = LatencyBench::now();

        bench.record(end - start);
        (void)ptr;

        if (arena.remaining() < 128) {
            arena.reset();
        }
    }

    auto stats = bench.compute();
    std::cout << bench.report("ArenaAllocate") << std::endl;

    // Arena allocation should be nearly free - under 100ns p99
    EXPECT_LT(stats.p99, 100u) << "Arena allocation p99 exceeded 100ns: "
                                << stats.p99 << " ns";
}

// --- SBE Encode/Decode Latency ---

TEST(LatencyRegression, SBERoundtripLatency) {
    LatencyBench bench;

    constexpr int ITERATIONS = 100000;
    for (int i = 0; i < ITERATIONS; ++i) {
        char buf[256];

        auto start = LatencyBench::now();

        // Encode
        Trade trade;
        trade.wrapAndApplyHeader(buf, 0, sizeof(buf));
        trade.symbolId(1)
             .price(5000000000000LL)
             .quantity(100000000ULL)
             .side(Side::Value::Buy)
             .venue(Venue::Binance)
             .timestamp(1000000000ULL);

        // Decode
        MessageHeader hdr(buf, sizeof(buf), MessageHeader::sbeSchemaVersion());
        Trade decoded;
        decoded.wrapForDecode(buf, MessageHeader::encodedLength(),
                              hdr.blockLength(), hdr.version(), sizeof(buf));
        volatile int64_t p = decoded.price();

        auto end = LatencyBench::now();
        bench.record(end - start);
        (void)p;
    }

    auto stats = bench.compute();
    std::cout << bench.report("SBE Roundtrip") << std::endl;

    // SBE roundtrip should be under 200ns p99
    EXPECT_LT(stats.p99, 200u) << "SBE roundtrip p99 exceeded 200ns: "
                                << stats.p99 << " ns";
}
