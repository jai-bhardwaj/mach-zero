#include <gtest/gtest.h>
#include "BinanceParser.h"
#include "SymbolMap.h"
#include <mach_zero_market_data/Trade.h>
#include <mach_zero_market_data/Quote.h>
#include <mach_zero_market_data/MessageHeader.h>
#include <mach_zero_market_data/Side.h>
#include <mach_zero_market_data/Venue.h>
#include <string>

using namespace mach_zero::market_data;
using namespace mach_zero::gateway;

class BinanceParserTest : public ::testing::Test {
protected:
    SymbolMap symbolMap;
    BinanceParser parser{symbolMap};
    char buf[512];
};

TEST_F(BinanceParserTest, ParseTradeMessage) {
    std::string json = R"({
        "e": "trade",
        "E": 1672515782136,
        "s": "BTCUSDT",
        "t": 100,
        "p": "23456.78",
        "q": "0.001",
        "b": 88,
        "a": 92,
        "T": 1672515782136,
        "m": false,
        "M": true
    })";

    size_t len = parser.parseTrade(json.c_str(), json.size(), buf, sizeof(buf));
    ASSERT_GT(len, 0u);

    MessageHeader hdr(buf, sizeof(buf), MessageHeader::sbeSchemaVersion());
    EXPECT_EQ(hdr.templateId(), Trade::sbeTemplateId());

    Trade trade;
    trade.wrapForDecode(buf, MessageHeader::encodedLength(),
                        hdr.blockLength(), hdr.version(), len);

    EXPECT_EQ(trade.symbolId(), 1u); // BTCUSDT = 1 in default SymbolMap
    EXPECT_EQ(trade.price(), 2345678000000LL); // "23456.78" * 1e8
    EXPECT_EQ(trade.quantity(), 100000ULL); // "0.001" * 1e8
    EXPECT_EQ(trade.side(), Side::Buy); // m=false means buyer is taker (Buy)
    EXPECT_EQ(trade.venue(), Venue::Binance);
    EXPECT_EQ(trade.timestamp(), 1672515782136000000ULL); // ms -> ns
}

TEST_F(BinanceParserTest, ParseTradeSellSide) {
    std::string json = R"({
        "e": "trade",
        "E": 1672515782136,
        "s": "ETHUSDT",
        "t": 101,
        "p": "1800.50",
        "q": "2.5",
        "b": 88,
        "a": 92,
        "T": 1672515782136,
        "m": true,
        "M": true
    })";

    size_t len = parser.parseTrade(json.c_str(), json.size(), buf, sizeof(buf));
    ASSERT_GT(len, 0u);

    MessageHeader hdr(buf, sizeof(buf), MessageHeader::sbeSchemaVersion());
    Trade trade;
    trade.wrapForDecode(buf, MessageHeader::encodedLength(),
                        hdr.blockLength(), hdr.version(), len);

    EXPECT_EQ(trade.symbolId(), 2u); // ETHUSDT = 2
    EXPECT_EQ(trade.price(), 180050000000LL); // "1800.50" * 1e8
    EXPECT_EQ(trade.quantity(), 250000000ULL); // "2.5" * 1e8
    EXPECT_EQ(trade.side(), Side::Sell); // m=true means seller is taker
}

TEST_F(BinanceParserTest, ParseUnknownSymbolReturnsZero) {
    std::string json = R"({
        "e": "trade",
        "E": 1672515782136,
        "s": "UNKNOWNUSDT",
        "t": 100,
        "p": "100.00",
        "q": "1.0",
        "T": 1672515782136,
        "m": false
    })";

    size_t len = parser.parseTrade(json.c_str(), json.size(), buf, sizeof(buf));
    EXPECT_EQ(len, 0u);
}

TEST_F(BinanceParserTest, ParseNonTradeEventReturnsZero) {
    std::string json = R"({"e": "kline", "s": "BTCUSDT"})";

    size_t len = parser.parseTrade(json.c_str(), json.size(), buf, sizeof(buf));
    EXPECT_EQ(len, 0u);
}

TEST_F(BinanceParserTest, ParseDepthUpdate) {
    std::string json = R"({
        "e": "depthUpdate",
        "E": 1672515782136,
        "s": "BTCUSDT",
        "U": 157,
        "u": 160,
        "b": [["23450.00", "1.5"], ["23449.00", "2.0"]],
        "a": [["23460.00", "0.8"], ["23461.00", "1.2"]]
    })";

    size_t len = parser.parseDepthUpdate(json.c_str(), json.size(), buf, sizeof(buf));
    ASSERT_GT(len, 0u);

    MessageHeader hdr(buf, sizeof(buf), MessageHeader::sbeSchemaVersion());
    EXPECT_EQ(hdr.templateId(), Quote::sbeTemplateId());

    Quote quote;
    quote.wrapForDecode(buf, MessageHeader::encodedLength(),
                        hdr.blockLength(), hdr.version(), len);

    EXPECT_EQ(quote.symbolId(), 1u);
    EXPECT_EQ(quote.bidPrice(), 2345000000000LL);  // "23450.00" * 1e8
    EXPECT_EQ(quote.askPrice(), 2346000000000LL);   // "23460.00" * 1e8
    EXPECT_EQ(quote.venue(), Venue::Binance);
    EXPECT_EQ(quote.sequenceNumber(), 160u);
}

TEST_F(BinanceParserTest, FixedPointConversionWholeNumber) {
    std::string json = R"({
        "e": "trade",
        "E": 1000,
        "s": "BTCUSDT",
        "t": 1,
        "p": "50000",
        "q": "1",
        "T": 1000,
        "m": false
    })";

    size_t len = parser.parseTrade(json.c_str(), json.size(), buf, sizeof(buf));
    ASSERT_GT(len, 0u);

    MessageHeader hdr(buf, sizeof(buf), MessageHeader::sbeSchemaVersion());
    Trade trade;
    trade.wrapForDecode(buf, MessageHeader::encodedLength(),
                        hdr.blockLength(), hdr.version(), len);

    EXPECT_EQ(trade.price(), 5000000000000LL); // 50000 * 1e8
    EXPECT_EQ(trade.quantity(), 100000000ULL); // 1 * 1e8
}
