#pragma once

#include <mach_zero_market_data/OrderRequest.h>
#include <mach_zero_market_data/OrderAck.h>
#include <mach_zero_market_data/MessageHeader.h>
#include <mach_zero_market_data/Side.h>
#include <mach_zero_market_data/OrderStatus.h>
#include <mach_zero_market_data/Venue.h>
#include <vector>
#include <unordered_map>
#include <cstdint>
#include <functional>

namespace mach_zero::backtest {

using namespace mach_zero::market_data;

// Callback for fill/ack events
using FillCallback = std::function<void(const char* data, size_t len)>;

struct OpenOrder {
    uint64_t orderId;
    uint64_t symbolId;
    Side::Value side;
    int64_t price;
    uint64_t quantity;
    uint64_t filledQty;
    uint32_t tenantId;   // Carries tenantId from OrderRequest to OrderAck
};

// Simulated exchange for backtesting.
// Matches orders against incoming market trades with configurable fill models.
class SimulatedExchange {
public:
    void setFillCallback(FillCallback cb) { fillCallback_ = std::move(cb); }

    // Submit an order to the simulated order book
    void submitOrder(const OrderRequest& order) {
        OpenOrder o;
        o.orderId = order.orderId();
        o.symbolId = order.symbolId();
        o.side = order.side();
        o.price = order.price();
        o.quantity = order.quantity();
        o.filledQty = 0;
        o.tenantId = order.tenantId();

        openOrders_[o.orderId] = o;

        // Send new ack
        sendAck(o.orderId, o.symbolId, OrderStatus::Value::New, 0, 0, o.tenantId);
    }

    // Process a market trade against open orders
    void onMarketTrade(uint64_t symbolId, int64_t tradePrice, uint64_t tradeQty) {
        std::vector<uint64_t> toRemove;

        for (auto& [id, order] : openOrders_) {
            if (order.symbolId != symbolId) continue;

            bool fills = false;
            if (order.side == Side::Value::Buy && tradePrice <= order.price) {
                fills = true;
            } else if (order.side == Side::Value::Sell && tradePrice >= order.price) {
                fills = true;
            }

            if (fills) {
                uint64_t remaining = order.quantity - order.filledQty;
                uint64_t fillQty = std::min(remaining, tradeQty);
                order.filledQty += fillQty;

                if (order.filledQty >= order.quantity) {
                    sendAck(id, symbolId, OrderStatus::Value::Filled,
                            order.quantity, tradePrice, order.tenantId);
                    toRemove.push_back(id);
                    ++totalFills_;
                } else {
                    sendAck(id, symbolId, OrderStatus::Value::PartialFill,
                            order.filledQty, tradePrice, order.tenantId);
                }
            }
        }

        for (auto id : toRemove) {
            openOrders_.erase(id);
        }
    }

    // Cancel an order
    bool cancelOrder(uint64_t orderId) {
        auto it = openOrders_.find(orderId);
        if (it == openOrders_.end()) return false;

        sendAck(orderId, it->second.symbolId, OrderStatus::Value::Cancelled,
                it->second.filledQty, 0, it->second.tenantId);
        openOrders_.erase(it);
        return true;
    }

    size_t openOrderCount() const { return openOrders_.size(); }
    uint64_t totalFills() const { return totalFills_; }

private:
    void sendAck(uint64_t orderId, uint64_t symbolId, OrderStatus::Value status,
                 uint64_t filledQty, int64_t avgPrice, uint32_t tenantId) {
        if (!fillCallback_) return;

        char buf[256];
        OrderAck ack;
        ack.wrapAndApplyHeader(buf, 0, sizeof(buf));
        ack.orderId(orderId)
           .clientOrderId(orderId)
           .symbolId(symbolId)
           .status(status)
           .filledQuantity(filledQty)
           .avgPrice(avgPrice)
           .exchangeOrderId(orderId)
           .venue(Venue::Unknown)
           .timestamp(0)
           .tenantId(tenantId);

        fillCallback_(buf, OrderAck::sbeBlockAndHeaderLength());
    }

    FillCallback fillCallback_;
    std::unordered_map<uint64_t, OpenOrder> openOrders_;
    uint64_t totalFills_ = 0;
};

} // namespace mach_zero::backtest
