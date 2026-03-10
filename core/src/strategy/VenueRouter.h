#pragma once

#include "SymbolRegistry.h"
#include <mach_zero_market_data/OrderRequest.h>
#include <mach_zero_market_data/MessageHeader.h>
#include <mach_zero_market_data/Venue.h>
#include <functional>
#include <unordered_map>
#include <vector>
#include <string>

namespace mach_zero::strategy {

using namespace mach_zero::market_data;

// Callback for sending validated orders to a specific venue gateway.
using VenueSink = std::function<void(const char* data, size_t len)>;

// Routes validated orders to the correct venue gateway based on the order's venue field.
class VenueRouter {
public:
    explicit VenueRouter(const SymbolRegistry& registry) : registry_(registry) {}

    // Register a sink for a given venue
    void registerVenue(Venue::Value venue, VenueSink sink) {
        sinks_[venue] = std::move(sink);
    }

    // Route an order to the appropriate venue
    bool route(const char* data, size_t len) {
        MessageHeader hdr(const_cast<char*>(data), len, MessageHeader::sbeSchemaVersion());
        if (hdr.templateId() != OrderRequest::sbeTemplateId()) {
            return false;
        }

        OrderRequest req;
        req.wrapForDecode(const_cast<char*>(data), MessageHeader::encodedLength(),
                          hdr.blockLength(), hdr.version(), len);

        Venue::Value venue = req.venue();
        auto it = sinks_.find(venue);
        if (it == sinks_.end()) {
            return false; // No sink registered for this venue
        }

        // Validate symbol exists and is tradeable
        const auto* sym = registry_.getById(req.symbolId());
        if (!sym || !sym->tradeable) {
            return false;
        }

        it->second(data, len);
        ++routedCount_;
        return true;
    }

    uint64_t routedCount() const { return routedCount_; }

private:
    const SymbolRegistry& registry_;
    std::unordered_map<Venue::Value, VenueSink> sinks_;
    uint64_t routedCount_ = 0;
};

} // namespace mach_zero::strategy
