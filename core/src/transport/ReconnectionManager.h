#pragma once

#include <cstdint>
#include <chrono>
#include <random>
#include <functional>
#include <algorithm>
#include <thread>

namespace mach_zero::transport {

// Manages reconnection with exponential backoff + jitter.
// Thread-safe: call attemptReconnect() from any thread.
class ReconnectionManager {
public:
    struct Config {
        uint32_t initialDelayMs = 100;
        uint32_t maxDelayMs = 30000;
        double backoffMultiplier = 2.0;
        double jitterFactor = 0.25;     // 25% jitter
        uint32_t maxAttempts = 0;        // 0 = unlimited
    };

    using ConnectFunc = std::function<bool()>;

    ReconnectionManager()
        : config_(), rng_(std::random_device{}()) {}

    explicit ReconnectionManager(const Config& config)
        : config_(config), rng_(std::random_device{}()) {}

    // Attempt to reconnect using the provided connect function.
    // Blocks until connection succeeds or max attempts reached.
    // Returns true if connected, false if max attempts exhausted.
    bool attemptReconnect(ConnectFunc connectFn) {
        uint32_t attempt = 0;
        uint32_t delayMs = config_.initialDelayMs;

        while (config_.maxAttempts == 0 || attempt < config_.maxAttempts) {
            ++attempt;
            ++totalAttempts_;

            if (connectFn()) {
                consecutiveFailures_ = 0;
                ++successfulReconnects_;
                return true;
            }

            ++consecutiveFailures_;

            // Calculate delay with jitter
            uint32_t actualDelay = addJitter(delayMs);
            std::this_thread::sleep_for(std::chrono::milliseconds(actualDelay));

            // Exponential backoff
            delayMs = std::min(
                static_cast<uint32_t>(delayMs * config_.backoffMultiplier),
                config_.maxDelayMs
            );
        }

        return false;
    }

    // Reset state (e.g. after a successful manual connect)
    void reset() {
        consecutiveFailures_ = 0;
    }

    uint32_t consecutiveFailures() const { return consecutiveFailures_; }
    uint32_t totalAttempts() const { return totalAttempts_; }
    uint32_t successfulReconnects() const { return successfulReconnects_; }

private:
    uint32_t addJitter(uint32_t baseMs) {
        if (config_.jitterFactor <= 0.0) return baseMs;
        double jitterRange = baseMs * config_.jitterFactor;
        std::uniform_real_distribution<double> dist(-jitterRange, jitterRange);
        int32_t jitter = static_cast<int32_t>(dist(rng_));
        return static_cast<uint32_t>(std::max(1, static_cast<int32_t>(baseMs) + jitter));
    }

    Config config_;
    std::mt19937 rng_;
    uint32_t consecutiveFailures_ = 0;
    uint32_t totalAttempts_ = 0;
    uint32_t successfulReconnects_ = 0;
};

} // namespace mach_zero::transport
