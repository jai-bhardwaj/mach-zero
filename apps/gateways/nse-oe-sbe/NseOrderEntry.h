#pragma once

#include <mach_zero_market_data/OrderRequest.h>
#include <mach_zero_market_data/OrderAck.h>
#include <mach_zero_market_data/MessageHeader.h>
#include <mach_zero_market_data/Venue.h>
#include <mach_zero_market_data/OrderStatus.h>
#include <cstdint>
#include <cstring>
#include <chrono>
#include <functional>

namespace mach_zero::nse {

using namespace mach_zero::market_data;

// Callback for sending order acks back to the system
using AckCallback = std::function<void(const char* data, size_t len)>;

// Simulated NSE SBE order entry client.
// In production, this would manage a TCP connection to NSE's SBE gateway
// with sequence numbers, heartbeats, and session management.
class NseOrderEntry {
public:
    NseOrderEntry() = default;

    void setAckCallback(AckCallback cb) { ackCallback_ = std::move(cb); }

    // Submit an order to the exchange (simulated)
    bool submitOrder(const OrderRequest& order) {
        if (order.venue() != Venue::NSE) return false;

        ++seqNum_;

        // Simulate exchange acceptance
        char ackBuf[256];
        OrderAck ack;
        ack.wrapAndApplyHeader(ackBuf, 0, sizeof(ackBuf));
        ack.orderId(order.orderId())
           .clientOrderId(order.clientOrderId())
           .symbolId(order.symbolId())
           .status(OrderStatus::Value::New)
           .filledQuantity(0)
           .avgPrice(0)
           .exchangeOrderId(exchangeOrderIdBase_ + seqNum_)
           .venue(Venue::NSE)
           .timestamp(static_cast<uint64_t>(
               std::chrono::duration_cast<std::chrono::nanoseconds>(
                   std::chrono::system_clock::now().time_since_epoch()).count()));

        if (ackCallback_) {
            ackCallback_(ackBuf, OrderAck::sbeBlockAndHeaderLength());
        }

        ++ordersSubmitted_;
        return true;
    }

    // Cancel an order (simulated)
    bool cancelOrder(uint64_t orderId, uint64_t symbolId) {
        ++seqNum_;

        char ackBuf[256];
        OrderAck ack;
        ack.wrapAndApplyHeader(ackBuf, 0, sizeof(ackBuf));
        ack.orderId(orderId)
           .clientOrderId(0)
           .symbolId(symbolId)
           .status(OrderStatus::Value::Cancelled)
           .filledQuantity(0)
           .avgPrice(0)
           .exchangeOrderId(exchangeOrderIdBase_ + seqNum_)
           .venue(Venue::NSE)
           .timestamp(static_cast<uint64_t>(
               std::chrono::duration_cast<std::chrono::nanoseconds>(
                   std::chrono::system_clock::now().time_since_epoch()).count()));

        if (ackCallback_) {
            ackCallback_(ackBuf, OrderAck::sbeBlockAndHeaderLength());
        }

        ++ordersCancelled_;
        return true;
    }

    // Heartbeat (simulated)
    void sendHeartbeat() { ++heartbeatsSent_; }

    uint64_t ordersSubmitted() const { return ordersSubmitted_; }
    uint64_t ordersCancelled() const { return ordersCancelled_; }
    uint64_t sequenceNumber() const { return seqNum_; }

private:
    AckCallback ackCallback_;
    uint64_t seqNum_ = 0;
    uint64_t exchangeOrderIdBase_ = 1000000;
    uint64_t ordersSubmitted_ = 0;
    uint64_t ordersCancelled_ = 0;
    uint64_t heartbeatsSent_ = 0;
};

} // namespace mach_zero::nse
