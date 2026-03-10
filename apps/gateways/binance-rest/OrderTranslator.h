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
        double quantity;
        double price;
    };

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

        params.quantity = static_cast<double>(req.quantity()) / 1e8;
        params.price = static_cast<double>(req.price()) / 1e8;
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
