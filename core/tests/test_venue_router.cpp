#include <gtest/gtest.h>
#include <strategy/SymbolRegistry.h>
#include <strategy/VenueRouter.h>
#include <mach_zero_market_data/OrderRequest.h>
#include <mach_zero_market_data/MessageHeader.h>
#include <mach_zero_market_data/Side.h>
#include <mach_zero_market_data/OrderType.h>
#include <mach_zero_market_data/TimeInForce.h>
#include <mach_zero_market_data/Venue.h>

using namespace mach_zero::strategy;
using namespace mach_zero::market_data;

namespace {
size_t makeOrderBuf(char* buf, size_t bufLen, uint64_t symbolId, Venue::Value venue) {
    OrderRequest req;
    req.wrapAndApplyHeader(buf, 0, bufLen);
    req.orderId(1).clientOrderId(1).symbolId(symbolId)
       .side(Side::Value::Buy).price(5000000000000LL).quantity(100000000ULL)
       .orderType(OrderType::Limit).timeInForce(TimeInForce::GTC)
       .venue(venue).timestamp(1000000000ULL);
    return OrderRequest::sbeBlockAndHeaderLength();
}
}

// --- SymbolRegistry Tests ---

TEST(SymbolRegistry, LoadDefaultsAndLookup) {
    SymbolRegistry reg;
    reg.loadDefaults();

    EXPECT_GE(reg.size(), 5u);

    auto* btc = reg.getByName("BTCUSDT");
    ASSERT_NE(btc, nullptr);
    EXPECT_EQ(btc->symbolId, 1u);
    EXPECT_EQ(btc->venue, Venue::Binance);

    auto* rel = reg.getByName("RELIANCE");
    ASSERT_NE(rel, nullptr);
    EXPECT_EQ(rel->symbolId, 100u);
    EXPECT_EQ(rel->venue, Venue::NSE);
}

TEST(SymbolRegistry, GetByIdAndName) {
    SymbolRegistry reg;
    reg.registerSymbol({42, "TESTCOIN", Venue::Binance, 1, 1, 1000, 500, true});

    auto* byId = reg.getById(42);
    ASSERT_NE(byId, nullptr);
    EXPECT_EQ(byId->name, "TESTCOIN");

    auto* byName = reg.getByName("TESTCOIN");
    ASSERT_NE(byName, nullptr);
    EXPECT_EQ(byName->symbolId, 42u);
}

TEST(SymbolRegistry, GetSymbolsByVenue) {
    SymbolRegistry reg;
    reg.loadDefaults();

    auto binanceSyms = reg.getSymbolsByVenue(Venue::Binance);
    EXPECT_GE(binanceSyms.size(), 2u);

    auto nseSyms = reg.getSymbolsByVenue(Venue::NSE);
    EXPECT_GE(nseSyms.size(), 3u);
}

TEST(SymbolRegistry, UnknownReturnsNull) {
    SymbolRegistry reg;
    EXPECT_EQ(reg.getById(999), nullptr);
    EXPECT_EQ(reg.getByName("NOSYMBOL"), nullptr);
    EXPECT_EQ(reg.getSymbolId("NOSYMBOL"), 0u);
}

// --- VenueRouter Tests ---

TEST(VenueRouter, RoutesBinanceOrder) {
    SymbolRegistry reg;
    reg.loadDefaults();

    VenueRouter router(reg);
    bool binanceReceived = false;
    router.registerVenue(Venue::Binance, [&](const char*, size_t) {
        binanceReceived = true;
    });

    char buf[256];
    size_t len = makeOrderBuf(buf, sizeof(buf), 1, Venue::Binance);
    EXPECT_TRUE(router.route(buf, len));
    EXPECT_TRUE(binanceReceived);
}

TEST(VenueRouter, RoutesNseOrder) {
    SymbolRegistry reg;
    reg.loadDefaults();

    VenueRouter router(reg);
    bool nseReceived = false;
    router.registerVenue(Venue::NSE, [&](const char*, size_t) {
        nseReceived = true;
    });

    char buf[256];
    size_t len = makeOrderBuf(buf, sizeof(buf), 100, Venue::NSE);
    EXPECT_TRUE(router.route(buf, len));
    EXPECT_TRUE(nseReceived);
}

TEST(VenueRouter, RejectsUnregisteredVenue) {
    SymbolRegistry reg;
    reg.loadDefaults();
    VenueRouter router(reg);

    char buf[256];
    size_t len = makeOrderBuf(buf, sizeof(buf), 1, Venue::Binance);
    EXPECT_FALSE(router.route(buf, len)); // No sink registered
}

TEST(VenueRouter, RejectsUnknownSymbol) {
    SymbolRegistry reg;
    reg.loadDefaults();
    VenueRouter router(reg);
    router.registerVenue(Venue::Binance, [](const char*, size_t) {});

    char buf[256];
    size_t len = makeOrderBuf(buf, sizeof(buf), 999, Venue::Binance); // Unknown symbol
    EXPECT_FALSE(router.route(buf, len));
}

TEST(VenueRouter, CountsRoutedOrders) {
    SymbolRegistry reg;
    reg.loadDefaults();
    VenueRouter router(reg);
    router.registerVenue(Venue::Binance, [](const char*, size_t) {});

    char buf[256];
    size_t len = makeOrderBuf(buf, sizeof(buf), 1, Venue::Binance);
    router.route(buf, len);
    router.route(buf, len);

    EXPECT_EQ(router.routedCount(), 2u);
}
