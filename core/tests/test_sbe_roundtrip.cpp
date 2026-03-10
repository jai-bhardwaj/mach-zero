#include <gtest/gtest.h>
#include <mach_zero_market_data/Trade.h>
#include <mach_zero_market_data/Quote.h>
#include <mach_zero_market_data/OrderRequest.h>
#include <mach_zero_market_data/OrderAck.h>
#include <mach_zero_market_data/OrderReject.h>
#include <mach_zero_market_data/CancelRequest.h>
#include <mach_zero_market_data/Heartbeat.h>
#include <mach_zero_market_data/RiskCommand.h>
#include <mach_zero_market_data/MessageHeader.h>
#include <mach_zero_market_data/Side.h>
#include <mach_zero_market_data/Venue.h>
#include <mach_zero_market_data/OrderType.h>
#include <mach_zero_market_data/TimeInForce.h>
#include <mach_zero_market_data/OrderStatus.h>
#include <mach_zero_market_data/RejectReason.h>
#include <mach_zero_market_data/RiskCommandType.h>

using namespace mach_zero::market_data;

// Helper: encode then decode, verify fields match
TEST(SbeRoundtrip, Trade) {
    char buf[256];

    Trade encoder;
    encoder.wrapAndApplyHeader(buf, 0, sizeof(buf));
    encoder.symbolId(42)
        .price(4500000000LL)  // 45.00000000
        .quantity(100000000ULL) // 1.00000000
        .side(Side::Buy)
        .venue(Venue::Binance)
        .timestamp(1234567890000000000ULL);

    // Decode
    MessageHeader hdr(buf, sizeof(buf), MessageHeader::sbeSchemaVersion());
    EXPECT_EQ(hdr.templateId(), Trade::sbeTemplateId());

    Trade decoder;
    decoder.wrapForDecode(buf, MessageHeader::encodedLength(),
                          hdr.blockLength(), hdr.version(),
                          Trade::sbeBlockAndHeaderLength());

    EXPECT_EQ(decoder.symbolId(), 42u);
    EXPECT_EQ(decoder.price(), 4500000000LL);
    EXPECT_EQ(decoder.quantity(), 100000000ULL);
    EXPECT_EQ(decoder.side(), Side::Buy);
    EXPECT_EQ(decoder.venue(), Venue::Binance);
    EXPECT_EQ(decoder.timestamp(), 1234567890000000000ULL);
}

TEST(SbeRoundtrip, Quote) {
    char buf[256];

    Quote encoder;
    encoder.wrapAndApplyHeader(buf, 0, sizeof(buf));
    encoder.symbolId(1)
        .bidPrice(4499000000LL)
        .bidQuantity(500000000ULL)
        .askPrice(4501000000LL)
        .askQuantity(300000000ULL)
        .venue(Venue::NSE)
        .sequenceNumber(12345)
        .timestamp(9999999999ULL);

    MessageHeader hdr(buf, sizeof(buf), MessageHeader::sbeSchemaVersion());
    EXPECT_EQ(hdr.templateId(), Quote::sbeTemplateId());

    Quote decoder;
    decoder.wrapForDecode(buf, MessageHeader::encodedLength(),
                          hdr.blockLength(), hdr.version(),
                          Quote::sbeBlockAndHeaderLength());

    EXPECT_EQ(decoder.symbolId(), 1u);
    EXPECT_EQ(decoder.bidPrice(), 4499000000LL);
    EXPECT_EQ(decoder.bidQuantity(), 500000000ULL);
    EXPECT_EQ(decoder.askPrice(), 4501000000LL);
    EXPECT_EQ(decoder.askQuantity(), 300000000ULL);
    EXPECT_EQ(decoder.venue(), Venue::NSE);
    EXPECT_EQ(decoder.sequenceNumber(), 12345u);
    EXPECT_EQ(decoder.timestamp(), 9999999999ULL);
}

TEST(SbeRoundtrip, OrderRequest) {
    char buf[256];

    OrderRequest encoder;
    encoder.wrapAndApplyHeader(buf, 0, sizeof(buf));
    encoder.orderId(100)
        .clientOrderId(200)
        .symbolId(1)
        .side(Side::Sell)
        .price(5000000000LL)
        .quantity(250000000ULL)
        .orderType(OrderType::Limit)
        .timeInForce(TimeInForce::GTC)
        .venue(Venue::Binance)
        .timestamp(1111111111ULL);

    MessageHeader hdr(buf, sizeof(buf), MessageHeader::sbeSchemaVersion());
    EXPECT_EQ(hdr.templateId(), OrderRequest::sbeTemplateId());

    OrderRequest decoder;
    decoder.wrapForDecode(buf, MessageHeader::encodedLength(),
                          hdr.blockLength(), hdr.version(),
                          OrderRequest::sbeBlockAndHeaderLength());

    EXPECT_EQ(decoder.orderId(), 100u);
    EXPECT_EQ(decoder.clientOrderId(), 200u);
    EXPECT_EQ(decoder.symbolId(), 1u);
    EXPECT_EQ(decoder.side(), Side::Sell);
    EXPECT_EQ(decoder.price(), 5000000000LL);
    EXPECT_EQ(decoder.quantity(), 250000000ULL);
    EXPECT_EQ(decoder.orderType(), OrderType::Limit);
    EXPECT_EQ(decoder.timeInForce(), TimeInForce::GTC);
    EXPECT_EQ(decoder.venue(), Venue::Binance);
    EXPECT_EQ(decoder.timestamp(), 1111111111ULL);
}

TEST(SbeRoundtrip, OrderAck) {
    char buf[256];

    OrderAck encoder;
    encoder.wrapAndApplyHeader(buf, 0, sizeof(buf));
    encoder.orderId(100)
        .clientOrderId(200)
        .symbolId(1)
        .status(OrderStatus::Filled)
        .filledQuantity(250000000ULL)
        .avgPrice(5000500000LL)
        .exchangeOrderId(99999)
        .venue(Venue::Binance)
        .timestamp(2222222222ULL);

    MessageHeader hdr(buf, sizeof(buf), MessageHeader::sbeSchemaVersion());
    OrderAck decoder;
    decoder.wrapForDecode(buf, MessageHeader::encodedLength(),
                          hdr.blockLength(), hdr.version(),
                          OrderAck::sbeBlockAndHeaderLength());

    EXPECT_EQ(decoder.orderId(), 100u);
    EXPECT_EQ(decoder.status(), OrderStatus::Filled);
    EXPECT_EQ(decoder.filledQuantity(), 250000000ULL);
    EXPECT_EQ(decoder.avgPrice(), 5000500000LL);
    EXPECT_EQ(decoder.exchangeOrderId(), 99999u);
}

TEST(SbeRoundtrip, OrderReject) {
    char buf[128];

    OrderReject encoder;
    encoder.wrapAndApplyHeader(buf, 0, sizeof(buf));
    encoder.orderId(100)
        .clientOrderId(200)
        .rejectReason(RejectReason::PriceBand)
        .venue(Venue::NSE)
        .timestamp(3333333333ULL);

    MessageHeader hdr(buf, sizeof(buf), MessageHeader::sbeSchemaVersion());
    OrderReject decoder;
    decoder.wrapForDecode(buf, MessageHeader::encodedLength(),
                          hdr.blockLength(), hdr.version(),
                          OrderReject::sbeBlockAndHeaderLength());

    EXPECT_EQ(decoder.orderId(), 100u);
    EXPECT_EQ(decoder.rejectReason(), RejectReason::PriceBand);
    EXPECT_EQ(decoder.venue(), Venue::NSE);
}

TEST(SbeRoundtrip, CancelRequest) {
    char buf[128];

    CancelRequest encoder;
    encoder.wrapAndApplyHeader(buf, 0, sizeof(buf));
    encoder.orderId(100)
        .clientOrderId(200)
        .symbolId(5)
        .venue(Venue::Binance)
        .timestamp(4444444444ULL);

    MessageHeader hdr(buf, sizeof(buf), MessageHeader::sbeSchemaVersion());
    CancelRequest decoder;
    decoder.wrapForDecode(buf, MessageHeader::encodedLength(),
                          hdr.blockLength(), hdr.version(),
                          CancelRequest::sbeBlockAndHeaderLength());

    EXPECT_EQ(decoder.orderId(), 100u);
    EXPECT_EQ(decoder.clientOrderId(), 200u);
    EXPECT_EQ(decoder.symbolId(), 5u);
}

TEST(SbeRoundtrip, Heartbeat) {
    char buf[128];

    Heartbeat encoder;
    encoder.wrapAndApplyHeader(buf, 0, sizeof(buf));
    encoder.sourceId(42)
        .sequenceNumber(1000)
        .timestamp(5555555555ULL);

    MessageHeader hdr(buf, sizeof(buf), MessageHeader::sbeSchemaVersion());
    Heartbeat decoder;
    decoder.wrapForDecode(buf, MessageHeader::encodedLength(),
                          hdr.blockLength(), hdr.version(),
                          Heartbeat::sbeBlockAndHeaderLength());

    EXPECT_EQ(decoder.sourceId(), 42u);
    EXPECT_EQ(decoder.sequenceNumber(), 1000u);
    EXPECT_EQ(decoder.timestamp(), 5555555555ULL);
}

TEST(SbeRoundtrip, RiskCommand) {
    char buf[128];

    RiskCommand encoder;
    encoder.wrapAndApplyHeader(buf, 0, sizeof(buf));
    encoder.commandType(RiskCommandType::KillSwitchOn)
        .timestamp(6666666666ULL);

    MessageHeader hdr(buf, sizeof(buf), MessageHeader::sbeSchemaVersion());
    RiskCommand decoder;
    decoder.wrapForDecode(buf, MessageHeader::encodedLength(),
                          hdr.blockLength(), hdr.version(),
                          RiskCommand::sbeBlockAndHeaderLength());

    EXPECT_EQ(decoder.commandType(), RiskCommandType::KillSwitchOn);
    EXPECT_EQ(decoder.timestamp(), 6666666666ULL);
}
