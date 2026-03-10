#include <gtest/gtest.h>
#include <apps/gateways/nse-md-itch/ItchParser.h>
#include <apps/gateways/nse-md-itch/ItchMessages.h>
#include <apps/gateways/nse-md-itch/NseSymbolMap.h>
#include <mach_zero_market_data/Trade.h>
#include <mach_zero_market_data/Quote.h>
#include <mach_zero_market_data/MessageHeader.h>
#include <cstring>

using namespace mach_zero::market_data;
using namespace mach_zero::gateway;
using namespace mach_zero::gateway::itch;

class ItchParserTest : public ::testing::Test {
protected:
    NseSymbolMap symbolMap;
    ItchParser parser{symbolMap};
    char itchBuf[256];
    char sbeBuf[256];
};

TEST_F(ItchParserTest, ParseTradeMessage) {
    auto* msg = reinterpret_cast<TradeMessage*>(itchBuf);
    msg->header.length = sizeof(TradeMessage) - sizeof(uint16_t);
    msg->header.messageType = MSG_TRADE;
    msg->timestamp = 1234567890ULL;
    msg->tradeId = 42;
    msg->tokenId = 2885; // RELIANCE -> symbolId 101
    msg->price = 250000;  // 2500.00 rupees in paise
    msg->quantity = 100;
    msg->side = 'B';

    size_t len = parser.parseTrade(itchBuf, sizeof(TradeMessage), sbeBuf, sizeof(sbeBuf));
    ASSERT_GT(len, 0u);

    MessageHeader hdr(sbeBuf, sizeof(sbeBuf), MessageHeader::sbeSchemaVersion());
    EXPECT_EQ(hdr.templateId(), Trade::sbeTemplateId());

    Trade trade;
    trade.wrapForDecode(sbeBuf, MessageHeader::encodedLength(),
                        hdr.blockLength(), hdr.version(), len);

    EXPECT_EQ(trade.symbolId(), 101u); // RELIANCE
    EXPECT_EQ(trade.price(), 250000 * 1000000LL); // paise -> 8-decimal fixed point
    EXPECT_EQ(trade.quantity(), 100u);
    EXPECT_EQ(trade.side(), Side::Value::Buy);
    EXPECT_EQ(trade.venue(), Venue::NSE);
}

TEST_F(ItchParserTest, ParseTradeMessageSellSide) {
    auto* msg = reinterpret_cast<TradeMessage*>(itchBuf);
    msg->header.length = sizeof(TradeMessage) - sizeof(uint16_t);
    msg->header.messageType = MSG_TRADE;
    msg->timestamp = 9999ULL;
    msg->tradeId = 1;
    msg->tokenId = 3045; // SBIN -> symbolId 102
    msg->price = 50000;  // 500.00 rupees
    msg->quantity = 500;
    msg->side = 'S';

    size_t len = parser.parseTrade(itchBuf, sizeof(TradeMessage), sbeBuf, sizeof(sbeBuf));
    ASSERT_GT(len, 0u);

    MessageHeader hdr(sbeBuf, sizeof(sbeBuf), MessageHeader::sbeSchemaVersion());
    Trade trade;
    trade.wrapForDecode(sbeBuf, MessageHeader::encodedLength(),
                        hdr.blockLength(), hdr.version(), len);

    EXPECT_EQ(trade.symbolId(), 102u);
    EXPECT_EQ(trade.side(), Side::Value::Sell);
}

TEST_F(ItchParserTest, UnknownTokenReturnsZero) {
    auto* msg = reinterpret_cast<TradeMessage*>(itchBuf);
    msg->header.length = sizeof(TradeMessage) - sizeof(uint16_t);
    msg->header.messageType = MSG_TRADE;
    msg->tokenId = 99999; // Unknown

    size_t len = parser.parseTrade(itchBuf, sizeof(TradeMessage), sbeBuf, sizeof(sbeBuf));
    EXPECT_EQ(len, 0u);
}

TEST_F(ItchParserTest, WrongMessageTypeReturnsZero) {
    auto* msg = reinterpret_cast<TradeMessage*>(itchBuf);
    msg->header.messageType = MSG_ADD_ORDER; // Not a trade

    size_t len = parser.parseTrade(itchBuf, sizeof(TradeMessage), sbeBuf, sizeof(sbeBuf));
    EXPECT_EQ(len, 0u);
}

TEST_F(ItchParserTest, ParseOrderBookSnapshot) {
    auto* msg = reinterpret_cast<OrderBookSnapshot*>(itchBuf);
    msg->header.length = sizeof(OrderBookSnapshot) - sizeof(uint16_t);
    msg->header.messageType = MSG_ORDER_BOOK;
    msg->tokenId = 11536; // TCS -> symbolId 103
    msg->bidPrice1 = 350000;
    msg->bidQty1 = 200;
    msg->askPrice1 = 351000;
    msg->askQty1 = 150;

    size_t len = parser.parseOrderBook(itchBuf, sizeof(OrderBookSnapshot), sbeBuf, sizeof(sbeBuf));
    ASSERT_GT(len, 0u);

    MessageHeader hdr(sbeBuf, sizeof(sbeBuf), MessageHeader::sbeSchemaVersion());
    EXPECT_EQ(hdr.templateId(), Quote::sbeTemplateId());

    Quote quote;
    quote.wrapForDecode(sbeBuf, MessageHeader::encodedLength(),
                        hdr.blockLength(), hdr.version(), len);

    EXPECT_EQ(quote.symbolId(), 103u);
    EXPECT_EQ(quote.bidPrice(), 350000 * 1000000LL);
    EXPECT_EQ(quote.askPrice(), 351000 * 1000000LL);
    EXPECT_EQ(quote.venue(), Venue::NSE);
}
