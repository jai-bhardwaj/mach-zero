#pragma once

#include <mach_zero_market_data/Trade.h>
#include <mach_zero_market_data/Quote.h>
#include <mach_zero_market_data/OrderAck.h>
#include <mach_zero_market_data/OrderRequest.h>
#include <cstdint>
#include <vector>
#include <functional>

namespace mach_zero::strategy {

using namespace mach_zero::market_data;

// Callback for strategy to emit order requests
using OrderEmitter = std::function<void(const char* buf, size_t len)>;

// Abstract base class for trading strategies.
// Strategies receive market data events and emit OrderRequest messages.
class Strategy {
public:
    virtual ~Strategy() = default;

    virtual void onTrade(const Trade& trade) = 0;
    virtual void onQuote(const Quote& quote) = 0;
    virtual void onOrderAck(const OrderAck& ack) = 0;
    virtual void onTimer(uint64_t nowNanos) { (void)nowNanos; }

    void setOrderEmitter(OrderEmitter emitter) { emitter_ = std::move(emitter); }

protected:
    void emitOrder(const char* buf, size_t len) {
        if (emitter_) emitter_(buf, len);
    }

    OrderEmitter emitter_;
};

} // namespace mach_zero::strategy
