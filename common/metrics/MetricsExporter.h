#pragma once

#include "Metrics.h"
#include <string>
#include <sstream>
#include <vector>

namespace mach_zero::metrics {

// Exports metrics in Prometheus exposition format (text/plain).
class MetricsExporter {
public:
    void addCounter(const Counter& counter) {
        counters_.push_back(&counter);
    }

    void addGauge(const Gauge& gauge) {
        gauges_.push_back(&gauge);
    }

    void addHistogram(const LatencyHistogram& histogram) {
        histograms_.push_back(&histogram);
    }

    std::string exportText() const {
        std::ostringstream out;

        for (const auto* c : counters_) {
            if (c->help()[0] != '\0') {
                out << "# HELP " << c->name() << " " << c->help() << "\n";
            }
            out << "# TYPE " << c->name() << " counter\n";
            out << c->name() << " " << c->value() << "\n";
        }

        for (const auto* g : gauges_) {
            if (g->help()[0] != '\0') {
                out << "# HELP " << g->name() << " " << g->help() << "\n";
            }
            out << "# TYPE " << g->name() << " gauge\n";
            out << g->name() << " " << g->value() << "\n";
        }

        for (const auto* h : histograms_) {
            if (h->help()[0] != '\0') {
                out << "# HELP " << h->name() << " " << h->help() << "\n";
            }
            out << "# TYPE " << h->name() << " histogram\n";

            uint64_t cumulative = 0;
            for (size_t i = 0; i < LatencyHistogram::NUM_BUCKETS; ++i) {
                cumulative += h->bucket(i);
                out << h->name() << "_bucket{le=\""
                    << LatencyHistogram::bucketBoundary(i) << "\"} "
                    << cumulative << "\n";
            }
            out << h->name() << "_count " << h->count() << "\n";
            out << h->name() << "_sum " << h->sum() << "\n";

            // Additional stats
            out << h->name() << "_mean " << h->mean() << "\n";
            if (h->count() > 0) {
                out << h->name() << "_min " << h->minVal() << "\n";
                out << h->name() << "_max " << h->maxVal() << "\n";
            }
        }

        return out.str();
    }

private:
    std::vector<const Counter*> counters_;
    std::vector<const Gauge*> gauges_;
    std::vector<const LatencyHistogram*> histograms_;
};

} // namespace mach_zero::metrics
