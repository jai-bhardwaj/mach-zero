#pragma once

#include <Aeron.h>
#include <cstdint>
#include <memory>
#include <string>
#include <chrono>
#include <thread>

namespace mach_zero::ipc {

// RAII wrapper around Aeron Subscription.
// Provides a simple poll() interface with configurable idle strategy.
class AeronSubscriber {
public:
    enum class IdleStrategy {
        BusySpin,    // Tight loop, lowest latency, burns CPU
        Yielding,    // std::this_thread::yield()
        Sleeping     // sleep_for(100us) when no fragments
    };

    // Create with own Aeron instance (legacy — use shared overload in services)
    AeronSubscriber(const std::string& channel, std::int32_t streamId,
                    IdleStrategy idle = IdleStrategy::Sleeping)
        : channel_(channel), streamId_(streamId), idle_(idle)
    {
        aeron::Context ctx;
        ownedAeron_ = std::make_unique<aeron::Aeron>(ctx);
        aeron_ = ownedAeron_.get();
        setupSubscription();
    }

    // Create with shared Aeron instance (preferred — avoids heartbeat timeouts)
    AeronSubscriber(std::shared_ptr<aeron::Aeron> shared, const std::string& channel,
                    std::int32_t streamId, IdleStrategy idle = IdleStrategy::Sleeping)
        : channel_(channel), streamId_(streamId), idle_(idle), sharedAeron_(std::move(shared))
    {
        aeron_ = sharedAeron_.get();
        setupSubscription();
    }

    // Poll for new messages. Returns the number of fragments read.
    int poll(aeron::fragment_handler_t handler, int fragmentLimit = 10) {
        int fragments = subscription_->poll(handler, fragmentLimit);
        if (fragments == 0) {
            idle();
        }
        return fragments;
    }

    // Poll without idle (caller manages idle strategy)
    int pollRaw(aeron::fragment_handler_t handler, int fragmentLimit = 10) {
        return subscription_->poll(handler, fragmentLimit);
    }

    bool isConnected() const { return subscription_->isConnected(); }

    const std::string& channel() const { return channel_; }
    std::int32_t streamId() const { return streamId_; }

private:
    void setupSubscription() {
        std::int64_t subId = aeron_->addSubscription(channel_, streamId_);
        subscription_ = aeron_->findSubscription(subId);
        while (!subscription_) {
            std::this_thread::yield();
            subscription_ = aeron_->findSubscription(subId);
        }
    }

    void idle() {
        switch (idle_) {
            case IdleStrategy::BusySpin:
                break; // No-op
            case IdleStrategy::Yielding:
                std::this_thread::yield();
                break;
            case IdleStrategy::Sleeping:
                std::this_thread::sleep_for(std::chrono::microseconds(100));
                break;
        }
    }

    std::string channel_;
    std::int32_t streamId_;
    IdleStrategy idle_;
    std::unique_ptr<aeron::Aeron> ownedAeron_;      // Used when no shared instance
    std::shared_ptr<aeron::Aeron> sharedAeron_;      // Keeps shared instance alive
    aeron::Aeron* aeron_ = nullptr;                  // Points to whichever is active
    std::shared_ptr<aeron::Subscription> subscription_;
};

} // namespace mach_zero::ipc
