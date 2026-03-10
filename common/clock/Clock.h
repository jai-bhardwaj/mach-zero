#pragma once

#include <chrono>
#include <cstdint>

namespace mach_zero {

// Abstract clock interface for timestamping.
// Production uses SystemClock (real time), tests use ManualClock (deterministic).
class Clock {
public:
    virtual ~Clock() = default;
    virtual uint64_t nowNanos() const = 0;
};

// Real system clock using steady_clock for monotonic timestamps
class SystemClock : public Clock {
public:
    uint64_t nowNanos() const override {
        return static_cast<uint64_t>(
            std::chrono::steady_clock::now().time_since_epoch().count());
    }
};

// Wall clock using system_clock (epoch-relative, for SBE timestamp fields)
class WallClock : public Clock {
public:
    uint64_t nowNanos() const override {
        auto now = std::chrono::system_clock::now();
        return static_cast<uint64_t>(
            std::chrono::duration_cast<std::chrono::nanoseconds>(
                now.time_since_epoch()).count());
    }
};

// Deterministic clock for testing and backtesting.
// Time only advances when explicitly set.
class ManualClock : public Clock {
public:
    explicit ManualClock(uint64_t startNanos = 0) : nanos_(startNanos) {}

    uint64_t nowNanos() const override { return nanos_; }

    void setNanos(uint64_t nanos) { nanos_ = nanos; }
    void advanceNanos(uint64_t deltaNanos) { nanos_ += deltaNanos; }
    void advanceMicros(uint64_t deltaMicros) { nanos_ += deltaMicros * 1000; }
    void advanceMillis(uint64_t deltaMillis) { nanos_ += deltaMillis * 1000000; }
    void advanceSecs(uint64_t deltaSecs) { nanos_ += deltaSecs * 1000000000; }

private:
    uint64_t nanos_;
};

} // namespace mach_zero
