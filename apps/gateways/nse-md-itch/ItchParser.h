#pragma once

#include "ItchMessages.h"
#include "NseSymbolMap.h"
#include <mach_zero_market_data/Trade.h>
#include <mach_zero_market_data/Quote.h>
#include <mach_zero_market_data/Side.h>
#include <mach_zero_market_data/Venue.h>
#include <mach_zero_market_data/MessageHeader.h>
#include <cstring>
#include <cstdint>

namespace mach_zero::gateway {

using namespace mach_zero::market_data;

// Parses NSE ITCH binary messages into internal SBE format.
// ITCH is fixed-width binary, so parsing is a struct overlay / memcpy.
class ItchParser {
public:
    explicit ItchParser(const NseSymbolMap& symbolMap) : symbolMap_(symbolMap) {}

    // Parse an ITCH Trade message into SBE Trade. Returns encoded length or 0.
    size_t parseTrade(const char* data, size_t len, char* outBuf, size_t outBufLen) {
        if (len < sizeof(itch::TradeMessage)) return 0;

        const auto* msg = reinterpret_cast<const itch::TradeMessage*>(data);
        if (msg->header.messageType != itch::MSG_TRADE) return 0;

        uint64_t symbolId = symbolMap_.toSymbolId(msg->tokenId);
        if (symbolId == 0) return 0;

        // NSE prices are in paise (1/100 rupee). Convert to 8-decimal fixed point.
        // paise * 1e6 = 8-decimal fixed point
        int64_t price = msg->price * 1000000LL;

        auto side = (msg->side == 'B') ? Side::Value::Buy : Side::Value::Sell;

        Trade trade;
        trade.wrapAndApplyHeader(outBuf, 0, static_cast<uint64_t>(outBufLen));
        trade.symbolId(symbolId)
            .price(price)
            .quantity(msg->quantity)
            .side(side)
            .venue(Venue::NSE)
            .timestamp(msg->timestamp);

        return Trade::sbeBlockAndHeaderLength();
    }

    // Parse an ITCH OrderBook snapshot into SBE Quote. Returns encoded length or 0.
    size_t parseOrderBook(const char* data, size_t len, char* outBuf, size_t outBufLen) {
        if (len < sizeof(itch::OrderBookSnapshot)) return 0;

        const auto* msg = reinterpret_cast<const itch::OrderBookSnapshot*>(data);
        if (msg->header.messageType != itch::MSG_ORDER_BOOK) return 0;

        uint64_t symbolId = symbolMap_.toSymbolId(msg->tokenId);
        if (symbolId == 0) return 0;

        int64_t bidPrice = msg->bidPrice1 * 1000000LL;
        int64_t askPrice = msg->askPrice1 * 1000000LL;

        Quote quote;
        quote.wrapAndApplyHeader(outBuf, 0, static_cast<uint64_t>(outBufLen));
        quote.symbolId(symbolId)
            .bidPrice(bidPrice)
            .bidQuantity(msg->bidQty1)
            .askPrice(askPrice)
            .askQuantity(msg->askQty1)
            .venue(Venue::NSE)
            .sequenceNumber(0)
            .timestamp(0);

        return Quote::sbeBlockAndHeaderLength();
    }

private:
    const NseSymbolMap& symbolMap_;
};

} // namespace mach_zero::gateway
