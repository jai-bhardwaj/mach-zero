#pragma once

#include "Strategy.h"
#include <mach_zero_market_data/OrderRequest.h>
#include <mach_zero_market_data/Side.h>
#include <mach_zero_market_data/OrderType.h>
#include <mach_zero_market_data/TimeInForce.h>
#include <mach_zero_market_data/Venue.h>
#include <cstdint>
#include <chrono>

namespace mach_zero::strategy {

// Simple market-making strategy: places limit orders at configurable offsets
// from the mid price. Used as a reference implementation to validate the pipeline.
class SimpleSpreadStrategy : public Strategy {
public:
    struct Config {
        uint32_t tenantId = 1;              // Default tenant for single-tenant legacy deploys
        uint64_t strategyId = 0;            // Engine strategy id (joins to Postgres for name/account/mode)
        uint64_t symbolId = 1;
        int64_t spreadOffset = 100000000LL; // 1.0 in fixed-point (8 decimals)
        uint64_t orderQuantity = 100000000ULL; // 1.0
        Venue::Value venue = Venue::Binance;
    };

    explicit SimpleSpreadStrategy(const Config& config) : config_(config) {}

    uint32_t tenantId() const override { return config_.tenantId; }

    void onTrade(const Trade& trade) override {
        if (trade.symbolId() != config_.symbolId) return;
        lastPrice_ = trade.price();
    }

    void onQuote(const Quote& quote) override {
        if (quote.symbolId() != config_.symbolId) return;

        int64_t mid = 0;
        if (quote.bidPrice() != 0 && quote.askPrice() != 0) {
            mid = (quote.bidPrice() + quote.askPrice()) / 2;
        } else if (lastPrice_ != 0) {
            mid = lastPrice_;
        } else {
            return;
        }

        // Place buy below mid, sell above mid
        int64_t buyPrice = mid - config_.spreadOffset;
        int64_t sellPrice = mid + config_.spreadOffset;

        if (buyPrice > 0) {
            emitOrderRequest(Side::Value::Buy, buyPrice, config_.orderQuantity);
        }
        emitOrderRequest(Side::Value::Sell, sellPrice, config_.orderQuantity);
    }

    void onOrderAck(const OrderAck& ack) override {
        (void)ack; // Track fills in production
    }

private:
    void emitOrderRequest(Side::Value side, int64_t price, uint64_t qty) {
        char buf[256];
        OrderRequest req;
        req.wrapAndApplyHeader(buf, 0, sizeof(buf));
        req.orderId(nextOrderId_++)
            .clientOrderId(nextOrderId_)
            .symbolId(config_.symbolId)
            .side(side)
            .price(price)
            .quantity(qty)
            .orderType(OrderType::Limit)
            .timeInForce(TimeInForce::GTC)
            .venue(config_.venue)
            .timestamp(static_cast<uint64_t>(
                std::chrono::duration_cast<std::chrono::nanoseconds>(
                    std::chrono::system_clock::now().time_since_epoch()).count()))
            .tenantId(config_.tenantId)
            .strategyId(config_.strategyId);
        emitOrder(buf, OrderRequest::sbeBlockAndHeaderLength());
    }

    Config config_;
    int64_t lastPrice_ = 0;
    uint64_t nextOrderId_ = 1;
};

} // namespace mach_zero::strategy
