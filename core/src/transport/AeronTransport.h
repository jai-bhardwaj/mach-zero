#pragma once

#include "Transport.h"
#include <Aeron.h>
#include <common/ipc/ChannelConfig.h>
#include <memory>
#include <string>
#include <unordered_map>

namespace mach_zero::transport {

// Aeron-backed implementation of the Transport interface.
class AeronTransport : public Transport {
public:
    explicit AeronTransport(const std::string& channel = std::string(ipc::IPC_CHANNEL))
        : channel_(channel)
    {
        aeron::Context ctx;
        aeron_ = std::make_unique<aeron::Aeron>(ctx);
    }

    int64_t publish(int32_t streamId, const char* buffer, size_t length) override {
        auto pub = getOrCreatePublication(streamId);
        aeron::concurrent::AtomicBuffer atomicBuf(
            reinterpret_cast<uint8_t*>(const_cast<char*>(buffer)), length);
        return pub->offer(atomicBuf, 0, static_cast<aeron::util::index_t>(length));
    }

    void subscribe(int32_t streamId, MessageHandler handler) override {
        handlers_[streamId] = std::move(handler);
        getOrCreateSubscription(streamId);
    }

    int poll(int32_t streamId, int fragmentLimit = 10) override {
        auto sub = getOrCreateSubscription(streamId);
        auto handlerIt = handlers_.find(streamId);
        if (handlerIt == handlers_.end()) return 0;

        auto& handler = handlerIt->second;
        aeron::fragment_handler_t fragHandler =
            [&handler](aeron::concurrent::AtomicBuffer& buffer,
                       aeron::util::index_t offset, aeron::util::index_t length,
                       aeron::Header& /*header*/) {
                handler(reinterpret_cast<const char*>(buffer.buffer()) + offset, length);
            };

        return sub->poll(fragHandler, fragmentLimit);
    }

    bool isConnected() const override { return true; }

private:
    std::shared_ptr<aeron::Publication> getOrCreatePublication(int32_t streamId) {
        auto it = publications_.find(streamId);
        if (it != publications_.end()) return it->second;

        auto pubId = aeron_->addPublication(channel_, streamId);
        auto pub = aeron_->findPublication(pubId);
        while (!pub) { pub = aeron_->findPublication(pubId); }
        publications_[streamId] = pub;
        return pub;
    }

    std::shared_ptr<aeron::Subscription> getOrCreateSubscription(int32_t streamId) {
        auto it = subscriptions_.find(streamId);
        if (it != subscriptions_.end()) return it->second;

        auto subId = aeron_->addSubscription(channel_, streamId);
        auto sub = aeron_->findSubscription(subId);
        while (!sub) { sub = aeron_->findSubscription(subId); }
        subscriptions_[streamId] = sub;
        return sub;
    }

    std::string channel_;
    std::unique_ptr<aeron::Aeron> aeron_;
    std::unordered_map<int32_t, std::shared_ptr<aeron::Publication>> publications_;
    std::unordered_map<int32_t, std::shared_ptr<aeron::Subscription>> subscriptions_;
    std::unordered_map<int32_t, MessageHandler> handlers_;
};

} // namespace mach_zero::transport
