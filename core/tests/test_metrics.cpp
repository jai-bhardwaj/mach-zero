#include <gtest/gtest.h>
#include <common/metrics/Metrics.h>
#include <common/metrics/MetricsExporter.h>

using namespace mach_zero::metrics;

TEST(MetricsCounter, IncrementAndReset) {
    Counter c("test_counter", "test help");
    EXPECT_EQ(c.value(), 0u);

    c.increment();
    EXPECT_EQ(c.value(), 1u);

    c.increment(5);
    EXPECT_EQ(c.value(), 6u);

    c.reset();
    EXPECT_EQ(c.value(), 0u);
}

TEST(MetricsGauge, SetAndAdjust) {
    Gauge g("test_gauge");

    g.set(42);
    EXPECT_EQ(g.value(), 42);

    g.increment(8);
    EXPECT_EQ(g.value(), 50);

    g.decrement(20);
    EXPECT_EQ(g.value(), 30);
}

TEST(LatencyHistogram, RecordAndStats) {
    LatencyHistogram h("test_latency", "test latency");

    h.record(50);   // < 100ns bucket
    h.record(500);  // < 1us bucket
    h.record(5000); // < 10us bucket

    EXPECT_EQ(h.count(), 3u);
    EXPECT_EQ(h.sum(), 5550u);
    EXPECT_EQ(h.minVal(), 50u);
    EXPECT_EQ(h.maxVal(), 5000u);
    EXPECT_DOUBLE_EQ(h.mean(), 1850.0);

    EXPECT_EQ(h.bucket(0), 1u); // < 100ns
    EXPECT_EQ(h.bucket(1), 1u); // < 1us
    EXPECT_EQ(h.bucket(2), 1u); // < 10us
}

TEST(LatencyHistogram, BucketBoundaries) {
    LatencyHistogram h("test");

    // Test each bucket
    h.record(0);       // bucket 0: < 100ns
    h.record(99);      // bucket 0
    h.record(100);     // bucket 1: < 1us
    h.record(999);     // bucket 1
    h.record(1000);    // bucket 2: < 10us
    h.record(9999);    // bucket 2
    h.record(10000);   // bucket 3: < 100us
    h.record(100000);  // bucket 4: < 1ms
    h.record(1000000); // bucket 5: < 10ms

    EXPECT_EQ(h.bucket(0), 2u);
    EXPECT_EQ(h.bucket(1), 2u);
    EXPECT_EQ(h.bucket(2), 2u);
    EXPECT_EQ(h.bucket(3), 1u);
    EXPECT_EQ(h.bucket(4), 1u);
    EXPECT_EQ(h.bucket(5), 1u);
}

TEST(LatencyHistogram, Reset) {
    LatencyHistogram h("test");
    h.record(100);
    h.record(200);

    h.reset();
    EXPECT_EQ(h.count(), 0u);
    EXPECT_EQ(h.sum(), 0u);
    EXPECT_EQ(h.bucket(0), 0u);
    EXPECT_EQ(h.bucket(1), 0u);
}

TEST(MetricsExporter, PrometheusFormat) {
    Counter c("mz_trades_total", "Total trades");
    c.increment(42);

    Gauge g("mz_position", "Current position");
    g.set(100);

    MetricsExporter exporter;
    exporter.addCounter(c);
    exporter.addGauge(g);

    std::string output = exporter.exportText();
    EXPECT_NE(output.find("# TYPE mz_trades_total counter"), std::string::npos);
    EXPECT_NE(output.find("mz_trades_total 42"), std::string::npos);
    EXPECT_NE(output.find("# TYPE mz_position gauge"), std::string::npos);
    EXPECT_NE(output.find("mz_position 100"), std::string::npos);
}

TEST(ScopedLatency, MeasuresTime) {
    LatencyHistogram h("test");

    {
        ScopedLatency sl(h);
        // Do some trivial work
        volatile int x = 0;
        for (int i = 0; i < 100; ++i) x += i;
    }

    EXPECT_EQ(h.count(), 1u);
    EXPECT_GT(h.sum(), 0u);
}
