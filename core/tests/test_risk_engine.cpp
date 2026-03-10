#include <gtest/gtest.h>
#include <risk/RiskEngine.h>
#include <risk/KillSwitch.h>
#include <risk/PriceBandCheck.h>
#include <risk/PositionLimitCheck.h>
#include <risk/OrderRateCheck.h>
#include <risk/MaxOrderSizeCheck.h>
#include <mach_zero_market_data/OrderRequest.h>
#include <mach_zero_market_data/Side.h>
#include <mach_zero_market_data/OrderType.h>
#include <mach_zero_market_data/TimeInForce.h>
#include <mach_zero_market_data/Venue.h>
#include <mach_zero_market_data/RejectReason.h>
#include <mach_zero_market_data/Trade.h>
#include <mach_zero_market_data/MessageHeader.h>
#include <chrono>

using namespace mach_zero::risk;
using namespace mach_zero::market_data;

namespace {

// Helper: create an SBE OrderRequest in a buffer
void makeOrder(char* buf, size_t bufLen, uint64_t orderId, uint64_t symbolId,
               Side::Value side, int64_t price, uint64_t quantity,
               Venue::Value venue = Venue::Binance) {
    OrderRequest req;
    req.wrapAndApplyHeader(buf, 0, bufLen);
    req.orderId(orderId)
       .clientOrderId(orderId)
       .symbolId(symbolId)
       .side(side)
       .price(price)
       .quantity(quantity)
       .orderType(OrderType::Limit)
       .timeInForce(TimeInForce::GTC)
       .venue(venue)
       .timestamp(1000000000ULL);
}

// Helper: decode an OrderRequest from a buffer (after header)
OrderRequest decodeOrder(char* buf, size_t len) {
    MessageHeader hdr(buf, len, MessageHeader::sbeSchemaVersion());
    OrderRequest req;
    req.wrapForDecode(buf, MessageHeader::encodedLength(),
                      hdr.blockLength(), hdr.version(), len);
    return req;
}

// Helper: create an SBE Trade in a buffer
void makeTrade(char* buf, size_t bufLen, uint64_t symbolId, int64_t price,
               uint64_t quantity) {
    Trade trade;
    trade.wrapAndApplyHeader(buf, 0, bufLen);
    trade.symbolId(symbolId)
         .price(price)
         .quantity(quantity)
         .side(Side::Value::Buy)
         .venue(Venue::Binance)
         .timestamp(1000000000ULL);
}

Trade decodeTrade(char* buf, size_t len) {
    MessageHeader hdr(buf, len, MessageHeader::sbeSchemaVersion());
    Trade trade;
    trade.wrapForDecode(buf, MessageHeader::encodedLength(),
                        hdr.blockLength(), hdr.version(), len);
    return trade;
}

} // namespace

// --- KillSwitch Tests ---

TEST(KillSwitch, InitiallyInactive) {
    KillSwitch ks;
    EXPECT_FALSE(ks.isActive());
}

TEST(KillSwitch, ActivateRejectsOrders) {
    KillSwitch ks;
    RiskState state;

    char buf[256];
    makeOrder(buf, sizeof(buf), 1, 1, Side::Value::Buy, 5000000000000LL, 100000000ULL);
    auto order = decodeOrder(buf, sizeof(buf));

    auto result = ks.validate(order, state);
    EXPECT_TRUE(result.passed);

    ks.activate();
    EXPECT_TRUE(ks.isActive());

    result = ks.validate(order, state);
    EXPECT_FALSE(result.passed);
    EXPECT_EQ(result.reason, RejectReason::KillSwitch);

    ks.deactivate();
    result = ks.validate(order, state);
    EXPECT_TRUE(result.passed);
}

// --- PriceBandCheck Tests ---

TEST(PriceBandCheck, PassesWithinBand) {
    PriceBandCheck check(5.0); // 5% band
    RiskState state;
    state.setLastPrice(1, 5000000000000LL); // 50000.0

    char buf[256];
    // Price within 5%: 50000 * 1.04 = 52000
    makeOrder(buf, sizeof(buf), 1, 1, Side::Value::Buy, 5200000000000LL, 100000000ULL);
    auto order = decodeOrder(buf, sizeof(buf));

    auto result = check.validate(order, state);
    EXPECT_TRUE(result.passed);
}

TEST(PriceBandCheck, RejectsOutsideBand) {
    PriceBandCheck check(5.0);
    RiskState state;
    state.setLastPrice(1, 5000000000000LL); // 50000.0

    char buf[256];
    // Price 10% away: 55000
    makeOrder(buf, sizeof(buf), 1, 1, Side::Value::Buy, 5500000000000LL, 100000000ULL);
    auto order = decodeOrder(buf, sizeof(buf));

    auto result = check.validate(order, state);
    EXPECT_FALSE(result.passed);
    EXPECT_EQ(result.reason, RejectReason::PriceBand);
}

TEST(PriceBandCheck, PassesWithNoReferencePrice) {
    PriceBandCheck check(5.0);
    RiskState state;
    // No last price set

    char buf[256];
    makeOrder(buf, sizeof(buf), 1, 1, Side::Value::Buy, 5000000000000LL, 100000000ULL);
    auto order = decodeOrder(buf, sizeof(buf));

    auto result = check.validate(order, state);
    EXPECT_TRUE(result.passed); // No reference = pass
}

// --- PositionLimitCheck Tests ---

TEST(PositionLimitCheck, PassesWithinLimit) {
    PositionLimitCheck check(1000000000LL); // max 10.0
    RiskState state;

    char buf[256];
    makeOrder(buf, sizeof(buf), 1, 1, Side::Value::Buy, 5000000000000LL, 500000000ULL); // 5.0
    auto order = decodeOrder(buf, sizeof(buf));

    auto result = check.validate(order, state);
    EXPECT_TRUE(result.passed);
}

TEST(PositionLimitCheck, RejectsExceedingLimit) {
    PositionLimitCheck check(1000000000LL); // max 10.0
    RiskState state;
    state.setPosition(1, 800000000LL); // Already at 8.0

    char buf[256];
    makeOrder(buf, sizeof(buf), 1, 1, Side::Value::Buy, 5000000000000LL, 500000000ULL); // +5.0 = 13.0
    auto order = decodeOrder(buf, sizeof(buf));

    auto result = check.validate(order, state);
    EXPECT_FALSE(result.passed);
    EXPECT_EQ(result.reason, RejectReason::PositionLimit);
}

TEST(PositionLimitCheck, SellReducesPosition) {
    PositionLimitCheck check(1000000000LL); // max 10.0
    RiskState state;
    state.setPosition(1, 800000000LL); // 8.0

    char buf[256];
    makeOrder(buf, sizeof(buf), 1, 1, Side::Value::Sell, 5000000000000LL, 500000000ULL); // -5.0 = 3.0
    auto order = decodeOrder(buf, sizeof(buf));

    auto result = check.validate(order, state);
    EXPECT_TRUE(result.passed);
}

// --- OrderRateCheck Tests ---

TEST(OrderRateCheck, PassesBelowLimit) {
    OrderRateCheck check(10); // max 10 orders
    RiskState state;

    char buf[256];
    makeOrder(buf, sizeof(buf), 1, 1, Side::Value::Buy, 5000000000000LL, 100000000ULL);
    auto order = decodeOrder(buf, sizeof(buf));

    auto result = check.validate(order, state);
    EXPECT_TRUE(result.passed);
}

TEST(OrderRateCheck, RejectsAtLimit) {
    OrderRateCheck check(3);
    RiskState state;
    // Simulate 3 orders already sent
    state.incrementOrderCount(1);
    state.incrementOrderCount(1);
    state.incrementOrderCount(1);

    char buf[256];
    makeOrder(buf, sizeof(buf), 1, 1, Side::Value::Buy, 5000000000000LL, 100000000ULL);
    auto order = decodeOrder(buf, sizeof(buf));

    auto result = check.validate(order, state);
    EXPECT_FALSE(result.passed);
    EXPECT_EQ(result.reason, RejectReason::OrderRate);
}

TEST(OrderRateCheck, ResetsCounters) {
    OrderRateCheck check(3);
    RiskState state;
    state.incrementOrderCount(1);
    state.incrementOrderCount(1);
    state.incrementOrderCount(1);

    state.resetOrderCounts();

    char buf[256];
    makeOrder(buf, sizeof(buf), 1, 1, Side::Value::Buy, 5000000000000LL, 100000000ULL);
    auto order = decodeOrder(buf, sizeof(buf));

    auto result = check.validate(order, state);
    EXPECT_TRUE(result.passed);
}

// --- MaxOrderSizeCheck Tests ---

TEST(MaxOrderSizeCheck, PassesBelowMax) {
    MaxOrderSizeCheck check(10000000000ULL); // max 100.0
    RiskState state;

    char buf[256];
    makeOrder(buf, sizeof(buf), 1, 1, Side::Value::Buy, 5000000000000LL, 5000000000ULL); // 50.0
    auto order = decodeOrder(buf, sizeof(buf));

    auto result = check.validate(order, state);
    EXPECT_TRUE(result.passed);
}

TEST(MaxOrderSizeCheck, RejectsOverMax) {
    MaxOrderSizeCheck check(10000000000ULL); // max 100.0
    RiskState state;

    char buf[256];
    makeOrder(buf, sizeof(buf), 1, 1, Side::Value::Buy, 5000000000000LL, 15000000000ULL); // 150.0
    auto order = decodeOrder(buf, sizeof(buf));

    auto result = check.validate(order, state);
    EXPECT_FALSE(result.passed);
    EXPECT_EQ(result.reason, RejectReason::MaxOrderSize);
}

// --- RiskEngine Integration Tests ---

TEST(RiskEngine, ValidOrderPasses) {
    RiskEngine engine;
    engine.state().setLastPrice(1, 5000000000000LL); // Set ref price

    char buf[256];
    makeOrder(buf, sizeof(buf), 1, 1, Side::Value::Buy, 5000000000000LL, 100000000ULL);
    auto order = decodeOrder(buf, sizeof(buf));

    auto result = engine.validate(order);
    EXPECT_TRUE(result.passed);
}

TEST(RiskEngine, KillSwitchRejectsFirst) {
    RiskEngine engine;
    engine.killSwitch().activate();

    char buf[256];
    makeOrder(buf, sizeof(buf), 1, 1, Side::Value::Buy, 5000000000000LL, 100000000ULL);
    auto order = decodeOrder(buf, sizeof(buf));

    auto result = engine.validate(order);
    EXPECT_FALSE(result.passed);
    EXPECT_EQ(result.reason, RejectReason::KillSwitch);
}

TEST(RiskEngine, PipelineChainRejects) {
    RiskEngine engine;
    engine.state().setLastPrice(1, 5000000000000LL);

    char buf[256];
    // Price 20% off = rejected by price band
    makeOrder(buf, sizeof(buf), 1, 1, Side::Value::Buy, 6000000000000LL, 100000000ULL);
    auto order = decodeOrder(buf, sizeof(buf));

    auto result = engine.validate(order);
    EXPECT_FALSE(result.passed);
    EXPECT_EQ(result.reason, RejectReason::PriceBand);
}

TEST(RiskEngine, OrderCountIncrementsOnPass) {
    RiskEngine engine;

    char buf[256];
    makeOrder(buf, sizeof(buf), 1, 1, Side::Value::Buy, 5000000000000LL, 100000000ULL);
    auto order = decodeOrder(buf, sizeof(buf));

    EXPECT_EQ(engine.state().getOrderCount(1), 0u);
    engine.validate(order);
    EXPECT_EQ(engine.state().getOrderCount(1), 1u);
}

TEST(RiskEngine, OnTradeUpdatesLastPrice) {
    RiskEngine engine;

    char buf[256];
    makeTrade(buf, sizeof(buf), 1, 5000000000000LL, 100000000ULL);
    auto trade = decodeTrade(buf, sizeof(buf));

    engine.onTrade(trade);
    EXPECT_EQ(engine.state().getLastPrice(1), 5000000000000LL);
}

TEST(RiskEngine, CreateRejectMessage) {
    RiskEngine engine;

    char orderBuf[256];
    makeOrder(orderBuf, sizeof(orderBuf), 42, 1, Side::Value::Buy, 5000000000000LL, 100000000ULL);
    auto order = decodeOrder(orderBuf, sizeof(orderBuf));

    char rejectBuf[256];
    size_t len = engine.createReject(order, RejectReason::PriceBand, rejectBuf, sizeof(rejectBuf));
    EXPECT_GT(len, 0u);

    // Decode the reject
    MessageHeader hdr(rejectBuf, len, MessageHeader::sbeSchemaVersion());
    OrderReject reject;
    reject.wrapForDecode(rejectBuf, MessageHeader::encodedLength(),
                         hdr.blockLength(), hdr.version(), len);
    EXPECT_EQ(reject.orderId(), 42u);
    EXPECT_EQ(reject.rejectReason(), RejectReason::PriceBand);
}

// --- Benchmark ---

TEST(RiskEngine, BenchmarkValidation) {
    RiskEngine engine;
    engine.state().setLastPrice(1, 5000000000000LL);

    char buf[256];
    makeOrder(buf, sizeof(buf), 1, 1, Side::Value::Buy, 5000000000000LL, 100000000ULL);
    auto order = decodeOrder(buf, sizeof(buf));

    constexpr int iterations = 100000;
    auto start = std::chrono::high_resolution_clock::now();

    for (int i = 0; i < iterations; ++i) {
        engine.validate(order);
    }

    auto end = std::chrono::high_resolution_clock::now();
    auto ns = std::chrono::duration_cast<std::chrono::nanoseconds>(end - start).count();
    double avgNs = static_cast<double>(ns) / iterations;

    std::cout << "Risk engine validation: " << avgNs << " ns/op ("
              << (avgNs / 1000.0) << " us/op)" << std::endl;

    // Target: < 5 microseconds per validation
    EXPECT_LT(avgNs, 5000.0) << "Risk gate p99 should be < 5 microseconds";
}
