#pragma once

#include <atomic>
#include <array>
#include <cstdint>
#include <string>
#include <sstream>
#include <chrono>
#include <cmath>

namespace mach_zero::metrics {

// Lock-free counter for tracking event counts and rates.
class Counter {
public:
    explicit Counter(const char* name, const char* help = "")
        : name_(name), help_(help) {}

    void increment(uint64_t delta = 1) {
        value_.fetch_add(delta, std::memory_order_relaxed);
    }

    uint64_t value() const { return value_.load(std::memory_order_relaxed); }
    void reset() { value_.store(0, std::memory_order_relaxed); }

    const char* name() const { return name_; }
    const char* help() const { return help_; }

private:
    const char* name_;
    const char* help_;
    std::atomic<uint64_t> value_{0};
};

// Lock-free gauge for tracking current values.
class Gauge {
public:
    explicit Gauge(const char* name, const char* help = "")
        : name_(name), help_(help) {}

    void set(int64_t value) { value_.store(value, std::memory_order_relaxed); }
    void increment(int64_t delta = 1) { value_.fetch_add(delta, std::memory_order_relaxed); }
    void decrement(int64_t delta = 1) { value_.fetch_sub(delta, std::memory_order_relaxed); }

    int64_t value() const { return value_.load(std::memory_order_relaxed); }

    const char* name() const { return name_; }
    const char* help() const { return help_; }

private:
    const char* name_;
    const char* help_;
    std::atomic<int64_t> value_{0};
};

// Lock-free latency histogram with power-of-2 buckets (nanoseconds).
// Bucket boundaries: [0, 100ns), [100ns, 1us), [1us, 10us), [10us, 100us),
//                    [100us, 1ms), [1ms, 10ms), [10ms, 100ms), [100ms, 1s), [1s+)
class LatencyHistogram {
public:
    static constexpr size_t NUM_BUCKETS = 9;

    explicit LatencyHistogram(const char* name, const char* help = "")
        : name_(name), help_(help) {}

    void record(uint64_t nanos) {
        size_t bucket = bucketIndex(nanos);
        buckets_[bucket].fetch_add(1, std::memory_order_relaxed);
        count_.fetch_add(1, std::memory_order_relaxed);
        sum_.fetch_add(nanos, std::memory_order_relaxed);

        // Track max (relaxed CAS loop)
        uint64_t curMax = max_.load(std::memory_order_relaxed);
        while (nanos > curMax) {
            if (max_.compare_exchange_weak(curMax, nanos, std::memory_order_relaxed)) break;
        }

        // Track min
        uint64_t curMin = min_.load(std::memory_order_relaxed);
        while (nanos < curMin) {
            if (min_.compare_exchange_weak(curMin, nanos, std::memory_order_relaxed)) break;
        }
    }

    uint64_t count() const { return count_.load(std::memory_order_relaxed); }
    uint64_t sum() const { return sum_.load(std::memory_order_relaxed); }
    uint64_t maxVal() const { return max_.load(std::memory_order_relaxed); }
    uint64_t minVal() const { return min_.load(std::memory_order_relaxed); }

    double mean() const {
        uint64_t c = count();
        return c > 0 ? static_cast<double>(sum()) / c : 0.0;
    }

    uint64_t bucket(size_t idx) const {
        return (idx < NUM_BUCKETS) ? buckets_[idx].load(std::memory_order_relaxed) : 0;
    }

    const char* name() const { return name_; }
    const char* help() const { return help_; }

    void reset() {
        for (auto& b : buckets_) b.store(0, std::memory_order_relaxed);
        count_.store(0, std::memory_order_relaxed);
        sum_.store(0, std::memory_order_relaxed);
        max_.store(0, std::memory_order_relaxed);
        min_.store(UINT64_MAX, std::memory_order_relaxed);
    }

    static constexpr uint64_t bucketBoundary(size_t idx) {
        constexpr uint64_t boundaries[] = {
            100, 1000, 10000, 100000, 1000000, 10000000, 100000000, 1000000000, UINT64_MAX
        };
        return (idx < NUM_BUCKETS) ? boundaries[idx] : UINT64_MAX;
    }

    static const char* bucketLabel(size_t idx) {
        static const char* labels[] = {
            "<100ns", "<1us", "<10us", "<100us", "<1ms", "<10ms", "<100ms", "<1s", ">=1s"
        };
        return (idx < NUM_BUCKETS) ? labels[idx] : "unknown";
    }

private:
    static size_t bucketIndex(uint64_t nanos) {
        if (nanos < 100) return 0;
        if (nanos < 1000) return 1;
        if (nanos < 10000) return 2;
        if (nanos < 100000) return 3;
        if (nanos < 1000000) return 4;
        if (nanos < 10000000) return 5;
        if (nanos < 100000000) return 6;
        if (nanos < 1000000000) return 7;
        return 8;
    }

    const char* name_;
    const char* help_;
    std::array<std::atomic<uint64_t>, NUM_BUCKETS> buckets_{};
    std::atomic<uint64_t> count_{0};
    std::atomic<uint64_t> sum_{0};
    std::atomic<uint64_t> max_{0};
    std::atomic<uint64_t> min_{UINT64_MAX};
};

// RAII latency measurement helper
class ScopedLatency {
public:
    explicit ScopedLatency(LatencyHistogram& histogram)
        : histogram_(histogram), start_(std::chrono::high_resolution_clock::now()) {}

    ~ScopedLatency() {
        auto end = std::chrono::high_resolution_clock::now();
        auto ns = std::chrono::duration_cast<std::chrono::nanoseconds>(end - start_).count();
        histogram_.record(static_cast<uint64_t>(ns));
    }

private:
    LatencyHistogram& histogram_;
    std::chrono::high_resolution_clock::time_point start_;
};

} // namespace mach_zero::metrics
