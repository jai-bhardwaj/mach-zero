#pragma once

#include <simdjson.h>
#include <mach_zero_market_data/Trade.h>
#include <mach_zero_market_data/Quote.h>
#include <mach_zero_market_data/Side.h>
#include <mach_zero_market_data/Venue.h>
#include "SymbolMap.h"
#include <cstdint>
#include <cstring>
#include <string>
#include <cmath>

namespace mach_zero::gateway {

using namespace mach_zero::market_data;

// Parses Binance WebSocket JSON messages into SBE-encoded binary messages.
//
// Binance trade format:
// {"e":"trade","E":1672515782136,"s":"BTCUSDT","t":100,"p":"23456.78",
//  "q":"0.001","b":88,"a":92,"T":1672515782136,"m":true,"M":true}
//
// Binance depth update format:
// {"e":"depthUpdate","E":123456789,"s":"BTCUSDT","U":157,"u":160,
//  "b":[["0.0024","10"]],"a":[["0.0026","100"]]}
class BinanceParser {
public:
    explicit BinanceParser(const SymbolMap& symbolMap) : symbolMap_(symbolMap) {}

    // Parse a Binance trade JSON message into the provided SBE buffer.
    // Returns the encoded message length, or 0 on failure.
    size_t parseTrade(const char* json, size_t jsonLen, char* outBuf, size_t outBufLen) {
        simdjson::padded_string padded(json, jsonLen);
        auto doc = parser_.iterate(padded);

        std::string_view eventType;
        auto err = doc["e"].get_string().get(eventType);
        if (err || eventType != "trade") return 0;

        std::string_view symbol;
        err = doc["s"].get_string().get(symbol);
        if (err) return 0;

        uint64_t symbolId = symbolMap_.toId(symbol);
        if (symbolId == 0) return 0;

        // Parse price and quantity as strings (Binance sends these as strings)
        std::string_view priceStr, qtyStr;
        err = doc["p"].get_string().get(priceStr);
        if (err) return 0;
        err = doc["q"].get_string().get(qtyStr);
        if (err) return 0;

        // Convert to fixed-point int64 (8 decimal places)
        int64_t price = toFixedPoint(priceStr);
        uint64_t quantity = toFixedPointUnsigned(qtyStr);

        // Buyer is maker = sell (taker is buying), maker = true means sell-side aggressor
        bool isBuyerMaker = false;
        doc["m"].get_bool().get(isBuyerMaker);
        auto side = isBuyerMaker ? Side::Value::Sell : Side::Value::Buy;

        // Timestamp in milliseconds from Binance, convert to nanoseconds
        uint64_t eventTimeMs = 0;
        doc["T"].get_uint64().get(eventTimeMs);
        uint64_t timestampNs = eventTimeMs * 1000000ULL;

        // Encode SBE Trade message
        Trade trade;
        trade.wrapAndApplyHeader(outBuf, 0, static_cast<uint64_t>(outBufLen));
        trade.symbolId(symbolId)
            .price(price)
            .quantity(quantity)
            .side(side)
            .venue(Venue::Binance)
            .timestamp(timestampNs);

        return Trade::sbeBlockAndHeaderLength();
    }

    // Parse a Binance depth update into SBE Quote message (best bid/ask only).
    // Returns encoded message length, or 0 on failure.
    size_t parseDepthUpdate(const char* json, size_t jsonLen, char* outBuf, size_t outBufLen) {
        simdjson::padded_string padded(json, jsonLen);
        auto doc = parser_.iterate(padded);

        std::string_view eventType;
        auto err = doc["e"].get_string().get(eventType);
        if (err || eventType != "depthUpdate") return 0;

        std::string_view symbol;
        err = doc["s"].get_string().get(symbol);
        if (err) return 0;

        uint64_t symbolId = symbolMap_.toId(symbol);
        if (symbolId == 0) return 0;

        // Parse best bid and ask from the arrays
        int64_t bidPrice = 0;
        uint64_t bidQty = 0;
        int64_t askPrice = 0;
        uint64_t askQty = 0;

        auto bids = doc["b"].get_array();
        if (!bids.error()) {
            for (auto level : bids.value()) {
                auto arr = level.get_array();
                if (!arr.error()) {
                    size_t idx = 0;
                    std::string_view pStr, qStr;
                    for (auto val : arr.value()) {
                        if (idx == 0) val.get_string().get(pStr);
                        if (idx == 1) val.get_string().get(qStr);
                        ++idx;
                    }
                    int64_t p = toFixedPoint(pStr);
                    if (p > bidPrice) {
                        bidPrice = p;
                        bidQty = toFixedPointUnsigned(qStr);
                    }
                }
            }
        }

        auto asks = doc["a"].get_array();
        if (!asks.error()) {
            bool firstAsk = true;
            for (auto level : asks.value()) {
                auto arr = level.get_array();
                if (!arr.error()) {
                    size_t idx = 0;
                    std::string_view pStr, qStr;
                    for (auto val : arr.value()) {
                        if (idx == 0) val.get_string().get(pStr);
                        if (idx == 1) val.get_string().get(qStr);
                        ++idx;
                    }
                    int64_t p = toFixedPoint(pStr);
                    if (firstAsk || p < askPrice) {
                        askPrice = p;
                        askQty = toFixedPointUnsigned(qStr);
                        firstAsk = false;
                    }
                }
            }
        }

        uint64_t lastUpdateId = 0;
        doc["u"].get_uint64().get(lastUpdateId);

        uint64_t eventTimeMs = 0;
        doc["E"].get_uint64().get(eventTimeMs);
        uint64_t timestampNs = eventTimeMs * 1000000ULL;

        Quote quote;
        quote.wrapAndApplyHeader(outBuf, 0, static_cast<uint64_t>(outBufLen));
        quote.symbolId(symbolId)
            .bidPrice(bidPrice)
            .bidQuantity(bidQty)
            .askPrice(askPrice)
            .askQuantity(askQty)
            .venue(Venue::Binance)
            .sequenceNumber(lastUpdateId)
            .timestamp(timestampNs);

        return Quote::sbeBlockAndHeaderLength();
    }

private:
    // Convert decimal string like "23456.78" to fixed-point int64 with 8 decimal places.
    // "23456.78" -> 2345678000000
    static int64_t toFixedPoint(std::string_view str) {
        if (str.empty()) return 0;

        bool negative = false;
        size_t pos = 0;
        if (str[0] == '-') {
            negative = true;
            pos = 1;
        }

        int64_t intPart = 0;
        while (pos < str.size() && str[pos] != '.') {
            intPart = intPart * 10 + (str[pos] - '0');
            ++pos;
        }

        int64_t fracPart = 0;
        int fracDigits = 0;
        if (pos < str.size() && str[pos] == '.') {
            ++pos;
            while (pos < str.size() && fracDigits < 8) {
                fracPart = fracPart * 10 + (str[pos] - '0');
                ++fracDigits;
                ++pos;
            }
        }

        // Pad remaining decimal places to reach 8
        for (int i = fracDigits; i < 8; ++i) {
            fracPart *= 10;
        }

        int64_t result = intPart * 100000000LL + fracPart;
        return negative ? -result : result;
    }

    static uint64_t toFixedPointUnsigned(std::string_view str) {
        int64_t val = toFixedPoint(str);
        return static_cast<uint64_t>(val >= 0 ? val : 0);
    }

    const SymbolMap& symbolMap_;
    simdjson::ondemand::parser parser_;
};

} // namespace mach_zero::gateway
