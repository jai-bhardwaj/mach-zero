#pragma once

#include "SimulatedExchange.h"
#include "BacktestResults.h"
#include <strategy/Strategy.h>
#include <strategy/StrategyEngine.h>
#include <risk/RiskEngine.h>
#include <common/clock/Clock.h>
#include <mach_zero_market_data/Trade.h>
#include <mach_zero_market_data/Quote.h>
#include <mach_zero_market_data/MessageHeader.h>
#include <mach_zero_market_data/Side.h>
#include <mach_zero_market_data/Venue.h>

#include <vector>
#include <memory>
#include <cstdint>

namespace mach_zero::backtest {

using namespace mach_zero::market_data;
using namespace mach_zero::strategy;
using namespace mach_zero::risk;

struct TradeEvent {
    uint64_t symbolId;
    int64_t price;
    uint64_t quantity;
    Side::Value side;
    uint64_t timestampNanos;
};

// Backtesting engine: replays historical market data through strategies,
// validates through risk engine, and fills via simulated exchange.
class BacktestEngine {
public:
    BacktestEngine() {
        exchange_.setFillCallback([this](const char* data, size_t len) {
            onFill(data, len);
        });
    }

    void addStrategy(std::shared_ptr<Strategy> strategy) {
        strategyEngine_.addStrategy(std::move(strategy));
    }

    // Run backtest over a list of trade events
    BacktestResults run(const std::vector<TradeEvent>& events) {
        results_.reset();

        for (const auto& evt : events) {
            // Encode trade as SBE
            char buf[256];
            Trade trade;
            trade.wrapAndApplyHeader(buf, 0, sizeof(buf));
            trade.symbolId(evt.symbolId)
                 .price(evt.price)
                 .quantity(evt.quantity)
                 .side(evt.side)
                 .venue(Venue::Unknown)
                 .timestamp(evt.timestampNanos);

            // Feed trade to strategy engine
            strategyEngine_.processMarketData(buf, Trade::sbeBlockAndHeaderLength());

            // Also generate a synthetic Quote from the trade so quote-driven
            // strategies (e.g. SimpleSpreadStrategy) can trigger.
            char qbuf[256];
            Quote quote;
            quote.wrapAndApplyHeader(qbuf, 0, sizeof(qbuf));
            int64_t spread = evt.price / 1000; // 0.1% synthetic spread
            if (spread == 0) spread = 1;
            quote.symbolId(evt.symbolId)
                 .bidPrice(evt.price - spread)
                 .bidQuantity(evt.quantity)
                 .askPrice(evt.price + spread)
                 .askQuantity(evt.quantity)
                 .venue(Venue::Unknown)
                 .sequenceNumber(0)
                 .timestamp(evt.timestampNanos);

            // Feed quote to strategy engine
            strategyEngine_.processMarketData(qbuf, Quote::sbeBlockAndHeaderLength());

            // Update risk engine last price
            MessageHeader hdr(buf, Trade::sbeBlockAndHeaderLength(), MessageHeader::sbeSchemaVersion());
            Trade decoded;
            decoded.wrapForDecode(buf, MessageHeader::encodedLength(),
                                  hdr.blockLength(), hdr.version(), Trade::sbeBlockAndHeaderLength());
            riskEngine_.onTrade(decoded);

            // Process strategy orders through risk engine
            auto orders = strategyEngine_.drainOrders();
            for (const auto& orderBuf : orders) {
                results_.recordTrade();

                MessageHeader orderHdr(const_cast<char*>(orderBuf.data()), orderBuf.size(),
                                       MessageHeader::sbeSchemaVersion());
                OrderRequest req;
                req.wrapForDecode(const_cast<char*>(orderBuf.data()), MessageHeader::encodedLength(),
                                  orderHdr.blockLength(), orderHdr.version(), orderBuf.size());

                auto riskResult = riskEngine_.validate(req);
                if (riskResult.passed) {
                    exchange_.submitOrder(req);
                }
            }

            // Check for fills against this trade
            exchange_.onMarketTrade(evt.symbolId, evt.price, evt.quantity);
        }

        return results_;
    }

    RiskEngine& riskEngine() { return riskEngine_; }
    SimulatedExchange& exchange() { return exchange_; }
    BacktestResults& results() { return results_; }

private:
    void onFill(const char* data, size_t len) {
        MessageHeader hdr(const_cast<char*>(data), len, MessageHeader::sbeSchemaVersion());
        OrderAck ack;
        ack.wrapForDecode(const_cast<char*>(data), MessageHeader::encodedLength(),
                          hdr.blockLength(), hdr.version(), len);

        if (ack.status() == OrderStatus::Value::Filled) {
            // Simple P&L: record fill avg price * quantity as delta
            // In a real system, track entry/exit pairs
            results_.recordFill(ack.avgPrice());
        }

        // Feed ack back to strategy engine
        strategyEngine_.processAck(data, len);
    }

    StrategyEngine strategyEngine_;
    RiskEngine riskEngine_;
    SimulatedExchange exchange_;
    BacktestResults results_;
};

} // namespace mach_zero::backtest
