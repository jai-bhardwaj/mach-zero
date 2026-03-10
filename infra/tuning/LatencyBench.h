#pragma once

#include <cstdint>
#include <chrono>
#include <vector>
#include <algorithm>
#include <numeric>
#include <cmath>
#include <string>
#include <sstream>
#include <iomanip>

namespace mach_zero::tuning {

// High-precision latency measurement and statistical reporting.
class LatencyBench {
public:
    explicit LatencyBench(size_t reserveSize = 100000) {
        samples_.reserve(reserveSize);
    }

    // Record a single latency sample in nanoseconds
    void record(uint64_t nanos) {
        samples_.push_back(nanos);
    }

    // Get current timestamp for manual measurement
    static uint64_t now() {
#ifdef __linux__
        struct timespec ts;
        clock_gettime(CLOCK_MONOTONIC_RAW, &ts);
        return static_cast<uint64_t>(ts.tv_sec) * 1000000000ULL + ts.tv_nsec;
#else
        auto tp = std::chrono::steady_clock::now();
        return static_cast<uint64_t>(
            std::chrono::duration_cast<std::chrono::nanoseconds>(
                tp.time_since_epoch()).count());
#endif
    }

    size_t count() const { return samples_.size(); }

    // Compute statistics (sorts samples in-place)
    struct Stats {
        uint64_t min;
        uint64_t max;
        double mean;
        double stddev;
        uint64_t median;
        uint64_t p50;
        uint64_t p90;
        uint64_t p95;
        uint64_t p99;
        uint64_t p999;
        size_t count;
    };

    Stats compute() {
        if (samples_.empty()) {
            return {0, 0, 0.0, 0.0, 0, 0, 0, 0, 0, 0, 0};
        }

        std::sort(samples_.begin(), samples_.end());
        size_t n = samples_.size();

        double sum = std::accumulate(samples_.begin(), samples_.end(), 0.0);
        double mean = sum / n;

        double sq_sum = 0;
        for (auto s : samples_) {
            double diff = static_cast<double>(s) - mean;
            sq_sum += diff * diff;
        }
        double stddev = std::sqrt(sq_sum / n);

        return {
            samples_.front(),
            samples_.back(),
            mean,
            stddev,
            percentile(50),
            percentile(50),
            percentile(90),
            percentile(95),
            percentile(99),
            percentile(99.9),
            n
        };
    }

    std::string report(const std::string& label = "Latency") {
        auto stats = compute();
        std::ostringstream oss;
        oss << std::fixed << std::setprecision(1);
        oss << "=== " << label << " Report (" << stats.count << " samples) ===\n";
        oss << "  Min:    " << formatNanos(stats.min) << "\n";
        oss << "  Mean:   " << formatNanos(static_cast<uint64_t>(stats.mean)) << "\n";
        oss << "  Median: " << formatNanos(stats.median) << "\n";
        oss << "  p90:    " << formatNanos(stats.p90) << "\n";
        oss << "  p95:    " << formatNanos(stats.p95) << "\n";
        oss << "  p99:    " << formatNanos(stats.p99) << "\n";
        oss << "  p99.9:  " << formatNanos(stats.p999) << "\n";
        oss << "  Max:    " << formatNanos(stats.max) << "\n";
        oss << "  Stddev: " << formatNanos(static_cast<uint64_t>(stats.stddev)) << "\n";
        return oss.str();
    }

    void reset() { samples_.clear(); }

private:
    uint64_t percentile(double pct) const {
        if (samples_.empty()) return 0;
        size_t idx = static_cast<size_t>(pct / 100.0 * (samples_.size() - 1));
        return samples_[idx];
    }

    static std::string formatNanos(uint64_t nanos) {
        std::ostringstream oss;
        if (nanos < 1000) {
            oss << nanos << " ns";
        } else if (nanos < 1000000) {
            oss << std::fixed << std::setprecision(2) << nanos / 1000.0 << " us";
        } else if (nanos < 1000000000) {
            oss << std::fixed << std::setprecision(2) << nanos / 1000000.0 << " ms";
        } else {
            oss << std::fixed << std::setprecision(2) << nanos / 1000000000.0 << " s";
        }
        return oss.str();
    }

    std::vector<uint64_t> samples_;
};

// RAII helper for measuring a scope
class ScopedBench {
public:
    ScopedBench(LatencyBench& bench) : bench_(bench), start_(LatencyBench::now()) {}
    ~ScopedBench() { bench_.record(LatencyBench::now() - start_); }
private:
    LatencyBench& bench_;
    uint64_t start_;
};

} // namespace mach_zero::tuning
