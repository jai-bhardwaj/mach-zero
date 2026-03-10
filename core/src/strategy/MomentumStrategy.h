#pragma once

#include "Strategy.h"
#include <mach_zero_market_data/OrderRequest.h>
#include <mach_zero_market_data/Side.h>
#include <mach_zero_market_data/OrderType.h>
#include <mach_zero_market_data/TimeInForce.h>
#include <mach_zero_market_data/Venue.h>
#include <deque>
#include <cstdint>
#include <chrono>

namespace mach_zero::strategy {

// Momentum strategy: generates signals based on short-term VWAP deviation.
// Buys when price drops below VWAP by a threshold, sells when above.
class MomentumStrategy : public Strategy {
public:
    struct Config {
        uint64_t symbolId = 1;
        size_t windowSize = 20;       // Number of trades for VWAP
        int64_t threshold = 50000000LL; // 0.5 in fixed-point deviation threshold
        uint64_t orderQuantity = 100000000ULL;
        Venue::Value venue = Venue::Binance;
    };

    explicit MomentumStrategy(const Config& config) : config_(config) {}

    void onTrade(const Trade& trade) override {
        if (trade.symbolId() != config_.symbolId) return;

        // Add to VWAP window
        trades_.push_back({trade.price(), trade.quantity()});
        if (trades_.size() > config_.windowSize) {
            trades_.pop_front();
        }

        if (trades_.size() < config_.windowSize) return;

        int64_t vwap = calculateVWAP();
        int64_t deviation = trade.price() - vwap;

        // Buy signal: price significantly below VWAP
        if (deviation < -config_.threshold && !hasPosition_) {
            emitOrderRequest(Side::Value::Buy, trade.price(), config_.orderQuantity);
            hasPosition_ = true;
        }
        // Sell signal: price significantly above VWAP
        else if (deviation > config_.threshold && hasPosition_) {
            emitOrderRequest(Side::Value::Sell, trade.price(), config_.orderQuantity);
            hasPosition_ = false;
        }
    }

    void onQuote(const Quote& /*quote*/) override {}
    void onOrderAck(const OrderAck& /*ack*/) override {}

private:
    struct TradeData {
        int64_t price;
        uint64_t quantity;
    };

    int64_t calculateVWAP() const {
        __int128 totalPQ = 0;
        uint64_t totalQ = 0;
        for (const auto& t : trades_) {
            totalPQ += static_cast<__int128>(t.price) * t.quantity;
            totalQ += t.quantity;
        }
        return totalQ > 0 ? static_cast<int64_t>(totalPQ / totalQ) : 0;
    }

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
            .orderType(OrderType::Market)
            .timeInForce(TimeInForce::IOC)
            .venue(config_.venue)
            .timestamp(static_cast<uint64_t>(
                std::chrono::duration_cast<std::chrono::nanoseconds>(
                    std::chrono::system_clock::now().time_since_epoch()).count()));
        emitOrder(buf, OrderRequest::sbeBlockAndHeaderLength());
    }

    Config config_;
    std::deque<TradeData> trades_;
    bool hasPosition_ = false;
    uint64_t nextOrderId_ = 10000;
};

} // namespace mach_zero::strategy
