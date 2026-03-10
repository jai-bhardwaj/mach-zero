#include <gtest/gtest.h>
#include <research/backtesting/SimulatedExchange.h>
#include <research/backtesting/BacktestResults.h>
#include <research/backtesting/BacktestEngine.h>
#include <strategy/SimpleSpreadStrategy.h>
#include <mach_zero_market_data/OrderRequest.h>
#include <mach_zero_market_data/Side.h>
#include <mach_zero_market_data/OrderType.h>
#include <mach_zero_market_data/TimeInForce.h>
#include <mach_zero_market_data/Venue.h>
#include <mach_zero_market_data/MessageHeader.h>

using namespace mach_zero::backtest;
using namespace mach_zero::market_data;
using namespace mach_zero::strategy;

// --- SimulatedExchange Tests ---

TEST(SimulatedExchange, SubmitAndFill) {
    SimulatedExchange exchange;
    int fillCount = 0;
    exchange.setFillCallback([&](const char*, size_t) {
        ++fillCount;
    });

    // Submit a buy order at 50000
    char buf[256];
    OrderRequest req;
    req.wrapAndApplyHeader(buf, 0, sizeof(buf));
    req.orderId(1).clientOrderId(1).symbolId(1)
       .side(Side::Value::Buy).price(5000000000000LL).quantity(100000000ULL)
       .orderType(OrderType::Limit).timeInForce(TimeInForce::GTC)
       .venue(Venue::Binance).timestamp(1000000000ULL);

    exchange.submitOrder(req); // Triggers New ack
    EXPECT_EQ(fillCount, 1); // New ack
    EXPECT_EQ(exchange.openOrderCount(), 1u);

    // Trade at 50000 -> fills the buy
    exchange.onMarketTrade(1, 5000000000000LL, 100000000ULL);
    EXPECT_EQ(fillCount, 2); // Filled ack
    EXPECT_EQ(exchange.openOrderCount(), 0u);
    EXPECT_EQ(exchange.totalFills(), 1u);
}

TEST(SimulatedExchange, NoFillIfPriceDoesntMatch) {
    SimulatedExchange exchange;
    int fillCount = 0;
    exchange.setFillCallback([&](const char*, size_t) {
        ++fillCount;
    });

    char buf[256];
    OrderRequest req;
    req.wrapAndApplyHeader(buf, 0, sizeof(buf));
    req.orderId(1).clientOrderId(1).symbolId(1)
       .side(Side::Value::Buy).price(4990000000000LL).quantity(100000000ULL)
       .orderType(OrderType::Limit).timeInForce(TimeInForce::GTC)
       .venue(Venue::Binance).timestamp(1000000000ULL);

    exchange.submitOrder(req);
    EXPECT_EQ(fillCount, 1); // New ack only

    // Trade above our buy price -> no fill
    exchange.onMarketTrade(1, 5000000000000LL, 100000000ULL);
    EXPECT_EQ(fillCount, 1); // No new acks
    EXPECT_EQ(exchange.openOrderCount(), 1u);
}

TEST(SimulatedExchange, CancelOrder) {
    SimulatedExchange exchange;
    exchange.setFillCallback([](const char*, size_t) {});

    char buf[256];
    OrderRequest req;
    req.wrapAndApplyHeader(buf, 0, sizeof(buf));
    req.orderId(1).clientOrderId(1).symbolId(1)
       .side(Side::Value::Buy).price(5000000000000LL).quantity(100000000ULL)
       .orderType(OrderType::Limit).timeInForce(TimeInForce::GTC)
       .venue(Venue::Binance).timestamp(1000000000ULL);

    exchange.submitOrder(req);
    EXPECT_EQ(exchange.openOrderCount(), 1u);

    EXPECT_TRUE(exchange.cancelOrder(1));
    EXPECT_EQ(exchange.openOrderCount(), 0u);

    EXPECT_FALSE(exchange.cancelOrder(999)); // Non-existent
}

// --- BacktestResults Tests ---

TEST(BacktestResults, PnlAndStats) {
    BacktestResults results;

    results.recordFill(100000000LL);  // +1.0
    results.recordFill(-50000000LL);  // -0.5
    results.recordFill(200000000LL);  // +2.0
    results.recordTrade();
    results.recordTrade();
    results.recordTrade();

    EXPECT_EQ(results.totalPnl(), 250000000LL);
    EXPECT_DOUBLE_EQ(results.totalPnlDecimal(), 2.5);
    EXPECT_EQ(results.totalTrades(), 3u);
    EXPECT_EQ(results.totalFills(), 3u);
    EXPECT_EQ(results.wins(), 2u);
    EXPECT_EQ(results.losses(), 1u);
    EXPECT_NEAR(results.winRate(), 0.6667, 0.001);
}

TEST(BacktestResults, MaxDrawdown) {
    BacktestResults results;

    results.recordFill(300000000LL);   // equity = 3.0, peak = 3.0
    results.recordFill(-500000000LL);  // equity = -2.0, peak = 3.0, DD = 5.0
    results.recordFill(100000000LL);   // equity = -1.0

    EXPECT_EQ(results.maxDrawdown(), 500000000LL);
    EXPECT_DOUBLE_EQ(results.maxDrawdownDecimal(), 5.0);
}

TEST(BacktestResults, Reset) {
    BacktestResults results;
    results.recordFill(100000000LL);
    results.recordTrade();

    results.reset();
    EXPECT_EQ(results.totalPnl(), 0);
    EXPECT_EQ(results.totalTrades(), 0u);
    EXPECT_EQ(results.totalFills(), 0u);
}

// --- BacktestEngine Integration ---

TEST(BacktestEngine, RunWithSpreadStrategy) {
    BacktestEngine engine;

    SimpleSpreadStrategy::Config cfg;
    cfg.symbolId = 1;
    cfg.spreadOffset = 100000000LL; // 1.0
    cfg.orderQuantity = 100000000ULL;
    engine.addStrategy(std::make_shared<SimpleSpreadStrategy>(cfg));

    // Generate synthetic trade events
    std::vector<TradeEvent> events;
    int64_t basePrice = 5000000000000LL; // 50000.0
    for (int i = 0; i < 100; ++i) {
        // Oscillating price
        int64_t price = basePrice + (i % 10 - 5) * 100000000LL;
        events.push_back({1, price, 100000000ULL, Side::Value::Buy, static_cast<uint64_t>(i) * 1000000000ULL});
    }

    auto results = engine.run(events);

    // Strategy should have generated some trades
    EXPECT_GT(results.totalTrades(), 0u);
    results.printSummary();
}
