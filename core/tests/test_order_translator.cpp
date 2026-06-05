#include <gtest/gtest.h>
#include "OrderTranslator.h"
#include <mach_zero_market_data/OrderRequest.h>
#include <mach_zero_market_data/Side.h>
#include <mach_zero_market_data/OrderType.h>
#include <mach_zero_market_data/Venue.h>

using namespace mach_zero::gateway;
using namespace mach_zero::market_data;

// fixedToString must produce the EXACT decimal for an int64 fixed-point value
// (8 decimals, 1.0 == 1e8) with no floating-point drift, trimming trailing
// zeros. The prior translator went through double, which can perturb the last
// digits and trip Binance's LOT_SIZE/PRICE_FILTER precision checks.
TEST(OrderTranslator, FixedToStringIsExact) {
    EXPECT_EQ(OrderTranslator::fixedToString(0LL), "0");
    EXPECT_EQ(OrderTranslator::fixedToString(100000000LL), "1");          // 1.0 -> trimmed
    EXPECT_EQ(OrderTranslator::fixedToString(150000000LL), "1.5");
    EXPECT_EQ(OrderTranslator::fixedToString(100000001LL), "1.00000001"); // smallest tick
    EXPECT_EQ(OrderTranslator::fixedToString(123456789LL), "1.23456789");
    EXPECT_EQ(OrderTranslator::fixedToString(314159265LL), "3.14159265");
    EXPECT_EQ(OrderTranslator::fixedToString(7000000000000LL), "70000");  // 70000.0
    EXPECT_EQ(OrderTranslator::fixedToString(1000000LL), "0.01");         // 0.01
    // A value that a double round-trip is prone to perturb stays exact:
    EXPECT_EQ(OrderTranslator::fixedToString(10000003LL), "0.10000003");
}

namespace {
size_t encodeOrder(char* buf, size_t len, Side::Value side, OrderType::Value type,
                   int64_t price, uint64_t qty) {
    OrderRequest req;
    req.wrapAndApplyHeader(buf, 0, len);
    req.orderId(1).clientOrderId(1).symbolId(1).side(side).price(price)
       .quantity(qty).orderType(type).venue(Venue::Binance)
       .timestamp(1).tenantId(1).strategyId(0);
    return OrderRequest::sbeBlockAndHeaderLength();
}
} // namespace

TEST(OrderTranslator, ToRestParamsFormatsExactStrings) {
    char buf[256];
    size_t len = encodeOrder(buf, sizeof(buf), Side::Value::Buy,
                             OrderType::Value::Limit,
                             /*price=*/4999200000000LL /*49992.0*/,
                             /*qty=*/  150000000ULL    /*1.5*/);
    MessageHeader hdr(buf, len, MessageHeader::sbeSchemaVersion());
    OrderRequest req;
    req.wrapForDecode(buf, MessageHeader::encodedLength(), hdr.blockLength(),
                      hdr.version(), len);

    auto p = OrderTranslator::toRestParams(req, "BTCUSDT");
    EXPECT_EQ(p.symbol, "BTCUSDT");
    EXPECT_EQ(p.side, "BUY");
    EXPECT_EQ(p.type, "LIMIT");
    EXPECT_EQ(p.quantity, "1.5");
    EXPECT_EQ(p.price, "49992");
}

TEST(OrderTranslator, MarketOrderMapsToMarketType) {
    char buf[256];
    size_t len = encodeOrder(buf, sizeof(buf), Side::Value::Sell,
                             OrderType::Value::Market, 0LL, 100000000ULL);
    MessageHeader hdr(buf, len, MessageHeader::sbeSchemaVersion());
    OrderRequest req;
    req.wrapForDecode(buf, MessageHeader::encodedLength(), hdr.blockLength(),
                      hdr.version(), len);

    auto p = OrderTranslator::toRestParams(req, "BTCUSDT");
    EXPECT_EQ(p.type, "MARKET");
    EXPECT_EQ(p.side, "SELL");
    EXPECT_EQ(p.quantity, "1");
}
