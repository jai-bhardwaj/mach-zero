#pragma once

#include <mach_zero_market_data/OrderRequest.h>
#include <mach_zero_market_data/OrderAck.h>
#include <mach_zero_market_data/Side.h>
#include <mach_zero_market_data/Venue.h>
#include <mach_zero_market_data/OrderType.h>
#include <mach_zero_market_data/OrderStatus.h>
#include <string>
#include <cstdint>

namespace mach_zero::gateway {

using namespace mach_zero::market_data;

// Translates between internal SBE OrderRequest and Binance REST API parameters,
// and between Binance REST responses and SBE OrderAck.
class OrderTranslator {
public:
    struct BinanceOrderParams {
        std::string symbol;
        std::string side;
        std::string type;
        // Quantity/price are kept as exact decimal STRINGS, formatted directly
        // from the int64 fixed-point values. Going through double (the prior
        // `double(req.quantity())/1e8`) drifts the last digits and can trip
        // Binance's LOT_SIZE / PRICE_FILTER precision checks (silent reject).
        std::string quantity;
        std::string price;
    };

    // Format a fixed-point int64 (8 decimals, 1.0 == 1e8) as an exact decimal
    // string with no floating-point step. Trailing fractional zeros are trimmed
    // (Binance accepts fewer decimals; it rejects MORE precision than allowed).
    static std::string fixedToString(int64_t v) {
        const bool neg = v < 0;
        // Safe magnitude even for INT64_MIN (avoids UB of -INT64_MIN).
        uint64_t a = neg ? (~static_cast<uint64_t>(v) + 1ULL)
                         : static_cast<uint64_t>(v);
        uint64_t intPart = a / 100000000ULL;
        uint64_t frac = a % 100000000ULL;
        std::string s;
        if (neg) s.push_back('-');
        s += std::to_string(intPart);
        if (frac > 0) {
            char fbuf[8];
            for (int i = 7; i >= 0; --i) { fbuf[i] = static_cast<char>('0' + frac % 10); frac /= 10; }
            int len = 8;
            while (len > 0 && fbuf[len - 1] == '0') --len; // trim trailing zeros
            s.push_back('.');
            s.append(fbuf, static_cast<size_t>(len));
        }
        return s;
    }

    // Convert internal OrderRequest to Binance REST parameters
    static BinanceOrderParams toRestParams(const OrderRequest& req, const std::string& symbolName) {
        BinanceOrderParams params;
        params.symbol = symbolName;
        params.side = (req.side() == Side::Value::Buy) ? "BUY" : "SELL";

        switch (req.orderType()) {
            case OrderType::Value::Market: params.type = "MARKET"; break;
            case OrderType::Value::Limit:  params.type = "LIMIT"; break;
            case OrderType::Value::IOC:    params.type = "LIMIT"; break; // with IOC TIF
            case OrderType::Value::FOK:    params.type = "LIMIT"; break; // with FOK TIF
            default: params.type = "LIMIT"; break;
        }

        params.quantity = fixedToString(static_cast<int64_t>(req.quantity()));
        params.price = fixedToString(req.price());
        return params;
    }

    // Create an SBE OrderAck from a Binance REST response
    static size_t createAck(const OrderRequest& req, uint64_t exchangeOrderId,
                            OrderStatus::Value status, uint64_t filledQty, int64_t avgPrice,
                            char* outBuf, size_t outBufLen) {
        OrderAck ack;
        ack.wrapAndApplyHeader(outBuf, 0, static_cast<uint64_t>(outBufLen));
        ack.orderId(req.orderId())
            .clientOrderId(req.clientOrderId())
            .symbolId(req.symbolId())
            .status(status)
            .filledQuantity(filledQty)
            .avgPrice(avgPrice)
            .exchangeOrderId(exchangeOrderId)
            .venue(Venue::Binance)
            .timestamp(static_cast<uint64_t>(
                std::chrono::duration_cast<std::chrono::nanoseconds>(
                    std::chrono::system_clock::now().time_since_epoch()).count()));
        return OrderAck::sbeBlockAndHeaderLength();
    }
};

} // namespace mach_zero::gateway
