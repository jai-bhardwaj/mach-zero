#pragma once

#include "Strategy.h"
#include <matching/OrderBook.h>
#include <common/ipc/ChannelConfig.h>
#include <common/ipc/SchemaValidator.h>
#include <mach_zero_market_data/Trade.h>
#include <mach_zero_market_data/Quote.h>
#include <mach_zero_market_data/OrderAck.h>
#include <mach_zero_market_data/OrderReject.h>
#include <mach_zero_market_data/OrderRequest.h>
#include <mach_zero_market_data/MessageHeader.h>

#include <Aeron.h>
#include <vector>
#include <memory>
#include <unordered_map>
#include <functional>

namespace mach_zero::strategy {

using namespace mach_zero::market_data;

// The main event loop for strategy execution.
// Polls Aeron for market data and order acks, dispatches to registered strategies,
// and publishes emitted OrderRequests to the order stream.
class StrategyEngine {
public:
    StrategyEngine() = default;

    void addStrategy(std::shared_ptr<Strategy> strategy) {
        strategy->setOrderEmitter([this](const char* buf, size_t len) {
            orderOutputs_.push_back({std::string(buf, len)});
        });
        strategies_.push_back(std::move(strategy));
    }

    // Atomically replace the active strategy set (used for hot-reload of
    // STRATEGIES_FILE). Called on the engine's single processing thread between
    // polls, so there is no concurrency hazard with processMarketData/processAck.
    // The caller is responsible for only invoking this with a successfully
    // parsed set — on a failed reload it should keep the existing strategies.
    void replaceStrategies(std::vector<std::shared_ptr<Strategy>> next) {
        strategies_.clear();
        for (auto& s : next) addStrategy(std::move(s));
    }

    size_t strategyCount() const { return strategies_.size(); }

    // Process a raw SBE message from the market data stream
    void processMarketData(const char* data, size_t length) {
        MessageHeader hdr(const_cast<char*>(data), length, MessageHeader::sbeSchemaVersion());
        if (!mach_zero::ipc::isValidSchema(hdr)) return;

        switch (hdr.templateId()) {
            case Trade::sbeTemplateId(): {
                Trade trade;
                trade.wrapForDecode(const_cast<char*>(data), MessageHeader::encodedLength(),
                                    hdr.blockLength(), hdr.version(), length);
                for (auto& s : strategies_) s->onTrade(trade);
                break;
            }
            case Quote::sbeTemplateId(): {
                Quote quote;
                quote.wrapForDecode(const_cast<char*>(data), MessageHeader::encodedLength(),
                                    hdr.blockLength(), hdr.version(), length);

                // Update internal order book
                auto& book = getOrCreateBook(quote.symbolId());
                book.applyQuote(quote);

                for (auto& s : strategies_) s->onQuote(quote);
                break;
            }
            default:
                break;
        }
    }

    // Process a raw SBE message from the ack stream. Routes to strategies
    // matching the ack's tenantId — defense in depth against clientOrderId
    // collisions across tenants.
    void processAck(const char* data, size_t length) {
        MessageHeader hdr(const_cast<char*>(data), length, MessageHeader::sbeSchemaVersion());
        if (!mach_zero::ipc::isValidSchema(hdr)) return;
        if (hdr.templateId() == OrderAck::sbeTemplateId()) {
            OrderAck ack;
            ack.wrapForDecode(const_cast<char*>(data), MessageHeader::encodedLength(),
                              hdr.blockLength(), hdr.version(), length);
            for (auto& s : strategies_) {
                if (s->tenantId() == ack.tenantId()) s->onOrderAck(ack);
            }
        } else if (hdr.templateId() == OrderReject::sbeTemplateId()) {
            // OrderReject handling is symmetric: route to the tenant's
            // strategies so they can unblock retries or alert. Strategies
            // don't currently override onOrderReject — stub via onOrderAck
            // with a rejected status would need schema changes, so we
            // simply leave rejects unhandled beyond logging at the
            // consumer level. Filter here to prevent spurious fanout.
            (void)length;
        }
    }

    // Drain emitted orders. Returns list of {buffer, length} pairs.
    std::vector<std::string> drainOrders() {
        std::vector<std::string> out;
        out.swap(orderOutputs_);
        return out;
    }

    // Get the internal order book for a symbol
    matching::OrderBook& getOrCreateBook(uint64_t symbolId) {
        auto it = books_.find(symbolId);
        if (it != books_.end()) return it->second;
        auto [newIt, _] = books_.emplace(symbolId, matching::OrderBook(symbolId));
        return newIt->second;
    }

    const matching::OrderBook* getBook(uint64_t symbolId) const {
        auto it = books_.find(symbolId);
        return (it != books_.end()) ? &it->second : nullptr;
    }

private:
    std::vector<std::shared_ptr<Strategy>> strategies_;
    std::vector<std::string> orderOutputs_;
    std::unordered_map<uint64_t, matching::OrderBook> books_;
};

} // namespace mach_zero::strategy
