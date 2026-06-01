#include <gtest/gtest.h>
#include <strategy/StrategyEngine.h>
#include <strategy/SimpleSpreadStrategy.h>
#include <strategy/MomentumStrategy.h>
#include <risk/RiskEngine.h>
#include <mach_zero_market_data/Trade.h>
#include <mach_zero_market_data/Quote.h>
#include <mach_zero_market_data/OrderAck.h>
#include <mach_zero_market_data/OrderRequest.h>
#include <mach_zero_market_data/MessageHeader.h>
#include <mach_zero_market_data/Side.h>
#include <mach_zero_market_data/Venue.h>
#include <mach_zero_market_data/OrderStatus.h>

using namespace mach_zero::strategy;
using namespace mach_zero::market_data;

namespace {

// Helper: encode an SBE Trade message
size_t encodeTrade(char* buf, size_t bufLen, uint64_t symbolId, int64_t price,
                   uint64_t quantity, Side::Value side = Side::Value::Buy) {
    Trade trade;
    trade.wrapAndApplyHeader(buf, 0, bufLen);
    trade.symbolId(symbolId)
         .price(price)
         .quantity(quantity)
         .side(side)
         .venue(Venue::Binance)
         .timestamp(1000000000ULL);
    return Trade::sbeBlockAndHeaderLength();
}

// Helper: encode an SBE Quote message
size_t encodeQuote(char* buf, size_t bufLen, uint64_t symbolId,
                   int64_t bidPrice, uint64_t bidQty,
                   int64_t askPrice, uint64_t askQty) {
    Quote quote;
    quote.wrapAndApplyHeader(buf, 0, bufLen);
    quote.symbolId(symbolId)
         .bidPrice(bidPrice)
         .bidQuantity(bidQty)
         .askPrice(askPrice)
         .askQuantity(askQty)
         .venue(Venue::Binance)
         .sequenceNumber(1)
         .timestamp(1000000000ULL);
    return Quote::sbeBlockAndHeaderLength();
}

// Helper: encode an SBE OrderAck
size_t encodeAck(char* buf, size_t bufLen, uint64_t orderId, uint64_t symbolId) {
    OrderAck ack;
    ack.wrapAndApplyHeader(buf, 0, bufLen);
    ack.orderId(orderId)
       .clientOrderId(orderId)
       .symbolId(symbolId)
       .status(OrderStatus::Value::Filled)
       .filledQuantity(100000000ULL)
       .avgPrice(5000000000000LL)
       .exchangeOrderId(99999)
       .venue(Venue::Binance)
       .timestamp(1000000000ULL);
    return OrderAck::sbeBlockAndHeaderLength();
}

} // namespace

// --- StrategyEngine Tests ---

TEST(StrategyEngine, AddStrategyAndProcessTrade) {
    StrategyEngine engine;

    SimpleSpreadStrategy::Config cfg;
    cfg.symbolId = 1;
    cfg.spreadOffset = 100000000LL; // 1.0
    cfg.orderQuantity = 100000000ULL;
    engine.addStrategy(std::make_shared<SimpleSpreadStrategy>(cfg));

    // Send a trade -- spread strategy only updates lastPrice on trades
    char buf[256];
    size_t len = encodeTrade(buf, sizeof(buf), 1, 5000000000000LL, 100000000ULL);
    engine.processMarketData(buf, len);

    // No orders yet from a trade alone (needs quote for spread strategy)
    auto orders = engine.drainOrders();
    EXPECT_TRUE(orders.empty());
}

TEST(StrategyEngine, ReplaceStrategiesSwapsTheActiveSet) {
    StrategyEngine engine;

    // Start with one strategy.
    SimpleSpreadStrategy::Config a;
    a.symbolId = 1;
    a.spreadOffset = 100000000LL;
    a.orderQuantity = 100000000ULL;
    engine.addStrategy(std::make_shared<SimpleSpreadStrategy>(a));
    EXPECT_EQ(engine.strategyCount(), 1u);

    // Hot-reload to a different set (two strategies on different symbols).
    std::vector<std::shared_ptr<Strategy>> next;
    SimpleSpreadStrategy::Config b;
    b.symbolId = 2;
    b.spreadOffset = 100000000LL;
    b.orderQuantity = 100000000ULL;
    next.push_back(std::make_shared<SimpleSpreadStrategy>(b));
    MomentumStrategy::Config m;
    m.symbolId = 2;
    m.windowSize = 3;
    m.threshold = 100000000LL;
    m.orderQuantity = 100000000ULL;
    next.push_back(std::make_shared<MomentumStrategy>(m));

    engine.replaceStrategies(std::move(next));
    EXPECT_EQ(engine.strategyCount(), 2u);

    // The replaced strategies are wired (order emitter set): feed symbol-2
    // quotes and confirm the new spread strategy emits, proving the swap took
    // effect and the old symbol-1 strategy is gone.
    char buf[256];
    size_t tlen = encodeTrade(buf, sizeof(buf), 2, 5000000000000LL, 100000000ULL);
    engine.processMarketData(buf, tlen);
    size_t qlen = encodeQuote(buf, sizeof(buf), 2, 4999000000000LL, 100000000ULL,
                              5001000000000LL, 100000000ULL);
    engine.processMarketData(buf, qlen);
    auto orders = engine.drainOrders();
    EXPECT_FALSE(orders.empty());
}

TEST(StrategyEngine, SpreadStrategyEmitsOnQuote) {
    StrategyEngine engine;

    SimpleSpreadStrategy::Config cfg;
    cfg.symbolId = 1;
    cfg.spreadOffset = 100000000LL; // 1.0
    cfg.orderQuantity = 100000000ULL;
    engine.addStrategy(std::make_shared<SimpleSpreadStrategy>(cfg));

    // Send a quote with both bid and ask
    char buf[256];
    size_t len = encodeQuote(buf, sizeof(buf), 1,
                             5000000000000LL, 1000000000ULL,  // bid: 50000.0
                             5000200000000LL, 1000000000ULL); // ask: 50002.0
    engine.processMarketData(buf, len);

    // Should emit 2 orders (buy and sell at offsets from mid)
    auto orders = engine.drainOrders();
    EXPECT_EQ(orders.size(), 2u);

    // Verify the orders are valid SBE OrderRequest messages
    for (const auto& orderBuf : orders) {
        MessageHeader hdr(const_cast<char*>(orderBuf.data()), orderBuf.size(),
                          MessageHeader::sbeSchemaVersion());
        EXPECT_EQ(hdr.templateId(), OrderRequest::sbeTemplateId());

        OrderRequest req;
        req.wrapForDecode(const_cast<char*>(orderBuf.data()), MessageHeader::encodedLength(),
                          hdr.blockLength(), hdr.version(), orderBuf.size());
        EXPECT_EQ(req.symbolId(), 1u);
        EXPECT_EQ(req.quantity(), 100000000ULL);
    }
}

TEST(StrategyEngine, DrainOrdersClearsQueue) {
    StrategyEngine engine;

    SimpleSpreadStrategy::Config cfg;
    cfg.symbolId = 1;
    engine.addStrategy(std::make_shared<SimpleSpreadStrategy>(cfg));

    char buf[256];
    size_t len = encodeQuote(buf, sizeof(buf), 1,
                             5000000000000LL, 1000000000ULL,
                             5000200000000LL, 1000000000ULL);
    engine.processMarketData(buf, len);

    auto orders1 = engine.drainOrders();
    EXPECT_FALSE(orders1.empty());

    auto orders2 = engine.drainOrders();
    EXPECT_TRUE(orders2.empty());
}

TEST(StrategyEngine, QuoteUpdatesInternalOrderBook) {
    StrategyEngine engine;

    char buf[256];
    size_t len = encodeQuote(buf, sizeof(buf), 1,
                             5000000000000LL, 1000000000ULL,
                             5000200000000LL, 500000000ULL);
    engine.processMarketData(buf, len);

    auto* book = engine.getBook(1);
    ASSERT_NE(book, nullptr);
    EXPECT_EQ(book->bestBid().price, 5000000000000LL);
    EXPECT_EQ(book->bestAsk().price, 5000200000000LL);
}

TEST(StrategyEngine, ProcessAckDispatches) {
    StrategyEngine engine;

    SimpleSpreadStrategy::Config cfg;
    cfg.symbolId = 1;
    engine.addStrategy(std::make_shared<SimpleSpreadStrategy>(cfg));

    char buf[256];
    size_t len = encodeAck(buf, sizeof(buf), 1, 1);
    // Should not crash
    engine.processAck(buf, len);
}

TEST(StrategyEngine, IgnoresUnrelatedSymbol) {
    StrategyEngine engine;

    SimpleSpreadStrategy::Config cfg;
    cfg.symbolId = 1; // Only cares about symbol 1
    engine.addStrategy(std::make_shared<SimpleSpreadStrategy>(cfg));

    char buf[256];
    size_t len = encodeQuote(buf, sizeof(buf), 99, // Different symbol
                             5000000000000LL, 1000000000ULL,
                             5000200000000LL, 1000000000ULL);
    engine.processMarketData(buf, len);

    auto orders = engine.drainOrders();
    EXPECT_TRUE(orders.empty());
}

TEST(StrategyEngine, MultipleStrategies) {
    StrategyEngine engine;

    SimpleSpreadStrategy::Config spreadCfg;
    spreadCfg.symbolId = 1;
    engine.addStrategy(std::make_shared<SimpleSpreadStrategy>(spreadCfg));

    MomentumStrategy::Config momCfg;
    momCfg.symbolId = 2;
    momCfg.windowSize = 3;
    momCfg.threshold = 50000000LL;
    engine.addStrategy(std::make_shared<MomentumStrategy>(momCfg));

    // Send quote to symbol 1 -> spread strategy fires
    char buf[256];
    size_t len = encodeQuote(buf, sizeof(buf), 1,
                             5000000000000LL, 1000000000ULL,
                             5000200000000LL, 1000000000ULL);
    engine.processMarketData(buf, len);

    auto orders = engine.drainOrders();
    EXPECT_EQ(orders.size(), 2u); // Spread emits 2
}

// --- MomentumStrategy Tests ---

TEST(MomentumStrategy, NoSignalBeforeWindowFull) {
    MomentumStrategy::Config cfg;
    cfg.symbolId = 1;
    cfg.windowSize = 3;
    cfg.threshold = 50000000LL;

    auto strategy = std::make_shared<MomentumStrategy>(cfg);
    std::vector<std::string> emitted;
    strategy->setOrderEmitter([&](const char* buf, size_t len) {
        emitted.push_back({buf, len});
    });

    // Send only 2 trades (< window size of 3)
    char buf[256];
    Trade trade;
    trade.wrapAndApplyHeader(buf, 0, sizeof(buf));
    trade.symbolId(1).price(5000000000000LL).quantity(100000000ULL)
         .side(Side::Value::Buy).venue(Venue::Binance).timestamp(1000000000ULL);
    strategy->onTrade(trade);

    trade.wrapAndApplyHeader(buf, 0, sizeof(buf));
    trade.symbolId(1).price(5001000000000LL).quantity(100000000ULL)
         .side(Side::Value::Buy).venue(Venue::Binance).timestamp(1000000001ULL);
    strategy->onTrade(trade);

    EXPECT_TRUE(emitted.empty());
}

TEST(MomentumStrategy, BuySignalOnDip) {
    MomentumStrategy::Config cfg;
    cfg.symbolId = 1;
    cfg.windowSize = 3;
    cfg.threshold = 50000000LL; // 0.5 threshold
    cfg.orderQuantity = 100000000ULL;

    auto strategy = std::make_shared<MomentumStrategy>(cfg);
    std::vector<std::string> emitted;
    strategy->setOrderEmitter([&](const char* buf, size_t len) {
        emitted.push_back({buf, len});
    });

    char buf[256];
    Trade trade;

    // Fill window with stable prices around 50000
    int64_t prices[] = {5000000000000LL, 5000000000000LL, 5000000000000LL};
    for (int i = 0; i < 3; ++i) {
        trade.wrapAndApplyHeader(buf, 0, sizeof(buf));
        trade.symbolId(1).price(prices[i]).quantity(100000000ULL)
             .side(Side::Value::Buy).venue(Venue::Binance).timestamp(1000000000ULL + i);
        strategy->onTrade(trade);
    }
    EXPECT_TRUE(emitted.empty()); // No deviation yet

    // Now send a trade significantly below VWAP
    trade.wrapAndApplyHeader(buf, 0, sizeof(buf));
    trade.symbolId(1).price(4999000000000LL).quantity(100000000ULL) // -10.0 below VWAP
         .side(Side::Value::Buy).venue(Venue::Binance).timestamp(1000000004ULL);
    strategy->onTrade(trade);

    // Should have emitted a buy order
    EXPECT_EQ(emitted.size(), 1u);

    // Verify it's a buy
    MessageHeader hdr(const_cast<char*>(emitted[0].data()), emitted[0].size(),
                      MessageHeader::sbeSchemaVersion());
    OrderRequest req;
    req.wrapForDecode(const_cast<char*>(emitted[0].data()), MessageHeader::encodedLength(),
                      hdr.blockLength(), hdr.version(), emitted[0].size());
    EXPECT_EQ(req.side(), Side::Value::Buy);
    EXPECT_EQ(req.symbolId(), 1u);
}

// --- End-to-End Pipeline Test ---

TEST(E2EPipeline, TradeToStrategyToRisk) {
    // Simulate: Trade -> StrategyEngine -> RiskEngine -> validated/rejected
    StrategyEngine stratEngine;

    SimpleSpreadStrategy::Config cfg;
    cfg.symbolId = 1;
    cfg.spreadOffset = 100000000LL; // 1.0
    cfg.orderQuantity = 100000000ULL;
    stratEngine.addStrategy(std::make_shared<SimpleSpreadStrategy>(cfg));

    mach_zero::risk::RiskEngine riskEngine;
    riskEngine.state().setLastPrice(static_cast<uint8_t>(Venue::Value::Binance), 1, 5000000000000LL);

    // Feed market data (quote)
    char buf[256];
    size_t len = encodeQuote(buf, sizeof(buf), 1,
                             5000000000000LL, 1000000000ULL,
                             5000200000000LL, 1000000000ULL);
    stratEngine.processMarketData(buf, len);

    // Drain orders from strategy
    auto orders = stratEngine.drainOrders();
    ASSERT_GE(orders.size(), 1u);

    // Pass through risk engine
    int passed = 0, rejected = 0;
    for (const auto& orderBuf : orders) {
        MessageHeader hdr(const_cast<char*>(orderBuf.data()), orderBuf.size(),
                          MessageHeader::sbeSchemaVersion());
        OrderRequest req;
        req.wrapForDecode(const_cast<char*>(orderBuf.data()), MessageHeader::encodedLength(),
                          hdr.blockLength(), hdr.version(), orderBuf.size());

        auto result = riskEngine.validate(req);
        if (result.passed) ++passed;
        else ++rejected;
    }

    // Orders should pass (prices are within band, size is small)
    EXPECT_GT(passed, 0);
    std::cout << "E2E Pipeline: " << passed << " passed, " << rejected << " rejected out of "
              << orders.size() << " orders" << std::endl;
}

TEST(E2EPipeline, KillSwitchHaltsFullPipeline) {
    StrategyEngine stratEngine;

    SimpleSpreadStrategy::Config cfg;
    cfg.symbolId = 1;
    stratEngine.addStrategy(std::make_shared<SimpleSpreadStrategy>(cfg));

    mach_zero::risk::RiskEngine riskEngine;
    riskEngine.killSwitch().activate(); // KILL SWITCH ON

    // Feed quote
    char buf[256];
    size_t len = encodeQuote(buf, sizeof(buf), 1,
                             5000000000000LL, 1000000000ULL,
                             5000200000000LL, 1000000000ULL);
    stratEngine.processMarketData(buf, len);

    auto orders = stratEngine.drainOrders();
    ASSERT_FALSE(orders.empty());

    // ALL orders should be rejected by kill switch
    for (const auto& orderBuf : orders) {
        MessageHeader hdr(const_cast<char*>(orderBuf.data()), orderBuf.size(),
                          MessageHeader::sbeSchemaVersion());
        OrderRequest req;
        req.wrapForDecode(const_cast<char*>(orderBuf.data()), MessageHeader::encodedLength(),
                          hdr.blockLength(), hdr.version(), orderBuf.size());

        auto result = riskEngine.validate(req);
        EXPECT_FALSE(result.passed);
        EXPECT_EQ(result.reason, RejectReason::KillSwitch);
    }
}
