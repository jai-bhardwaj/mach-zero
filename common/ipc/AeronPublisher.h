#pragma once

#include <Aeron.h>
#include <cstdint>
#include <memory>
#include <string>
#include <stdexcept>
#include <thread>

namespace mach_zero::ipc {

// RAII wrapper around Aeron Publication.
// Encapsulates the boilerplate of creating a context, connecting to the media driver,
// and finding the publication. Provides a simple publish() interface.
class AeronPublisher {
public:
    // Create with own Aeron instance (legacy — use shared overload in services)
    AeronPublisher(const std::string& channel, std::int32_t streamId)
        : channel_(channel), streamId_(streamId)
    {
        aeron::Context ctx;
        ownedAeron_ = std::make_unique<aeron::Aeron>(ctx);
        aeron_ = ownedAeron_.get();
        setupPublication();
    }

    // Create with shared Aeron instance (preferred — avoids heartbeat timeouts)
    AeronPublisher(std::shared_ptr<aeron::Aeron> shared, const std::string& channel, std::int32_t streamId)
        : channel_(channel), streamId_(streamId), sharedAeron_(std::move(shared))
    {
        aeron_ = sharedAeron_.get();
        setupPublication();
    }

    // Publish a raw buffer. Returns the new stream position on success, or a negative
    // value on back-pressure / not-connected (matches Aeron Publication::offer semantics).
    std::int64_t publish(const uint8_t* buffer, std::size_t length) {
        aeron::concurrent::AtomicBuffer atomicBuf(
            const_cast<uint8_t*>(buffer), length);
        return publication_->offer(atomicBuf, 0, static_cast<aeron::util::index_t>(length));
    }

    // Convenience: publish from a char buffer
    std::int64_t publish(const char* buffer, std::size_t length) {
        return publish(reinterpret_cast<const uint8_t*>(buffer), length);
    }

    // Publish with bounded retry on TRANSIENT failures. offer() returns
    // BACK_PRESSURED (-2) when the term buffer is momentarily full, ADMIN_ACTION
    // (-3) during a term rotation, or NOT_CONNECTED (-1) before a subscriber
    // attaches — all retryable, NOT drops. Fire-and-forget publish() silently
    // loses the message on these, which for an ORDER means the order never
    // reaches the venue while the strategy believes it was sent (position
    // desync). Order-critical streams (validated orders, rejects, acks) must use
    // this. Returns true if delivered; false on a terminal error
    // (PUBLICATION_CLOSED / MAX_POSITION_EXCEEDED) or if the retry budget is
    // exhausted — the caller MUST treat false as a critical, logged failure, not
    // a silent drop. Market data may keep using publish() (a newer tick
    // supersedes a dropped one).
    bool publishReliable(const uint8_t* buffer, std::size_t length,
                         int maxAttempts = 500000) {
        aeron::concurrent::AtomicBuffer atomicBuf(
            const_cast<uint8_t*>(buffer), length);
        for (int attempt = 0; attempt < maxAttempts; ++attempt) {
            const std::int64_t r = publication_->offer(
                atomicBuf, 0, static_cast<aeron::util::index_t>(length));
            if (r > 0) return true; // delivered (new stream position)
            if (r == aeron::BACK_PRESSURED || r == aeron::ADMIN_ACTION ||
                r == aeron::NOT_CONNECTED) {
                std::this_thread::yield(); // transient — back off and retry
                continue;
            }
            return false; // terminal: PUBLICATION_CLOSED / MAX_POSITION_EXCEEDED
        }
        return false; // retry budget exhausted (sustained back-pressure)
    }

    bool publishReliable(const char* buffer, std::size_t length) {
        return publishReliable(reinterpret_cast<const uint8_t*>(buffer), length);
    }

    bool isConnected() const { return publication_->isConnected(); }

    const std::string& channel() const { return channel_; }
    std::int32_t streamId() const { return streamId_; }

private:
    void setupPublication() {
        std::int64_t pubId = aeron_->addPublication(channel_, streamId_);
        publication_ = aeron_->findPublication(pubId);
        while (!publication_) {
            std::this_thread::yield();
            publication_ = aeron_->findPublication(pubId);
        }
    }

    std::string channel_;
    std::int32_t streamId_;
    std::unique_ptr<aeron::Aeron> ownedAeron_;     // Used when no shared instance
    std::shared_ptr<aeron::Aeron> sharedAeron_;     // Keeps shared instance alive
    aeron::Aeron* aeron_ = nullptr;                 // Points to whichever is active
    std::shared_ptr<aeron::Publication> publication_;
};

} // namespace mach_zero::ipc
