#include <gtest/gtest.h>
#include <transport/QuestDBSink.h>

using namespace mach_zero::transport;

TEST(QuestDBSink, FormatFixedPointPositive) {
    // 50000.12345678 = 5000012345678 in fixed-point
    auto result = QuestDBSink::formatFixedPoint(5000012345678LL);
    EXPECT_EQ(result, "50000.12345678");
}

TEST(QuestDBSink, FormatFixedPointWholeNumber) {
    // 100.0 = 10000000000 in fixed-point
    auto result = QuestDBSink::formatFixedPoint(10000000000LL);
    EXPECT_EQ(result, "100.0");
}

TEST(QuestDBSink, FormatFixedPointNegative) {
    auto result = QuestDBSink::formatFixedPoint(-5000000000LL);
    EXPECT_EQ(result, "-50.0");
}

TEST(QuestDBSink, FormatFixedPointZero) {
    auto result = QuestDBSink::formatFixedPoint(0);
    EXPECT_EQ(result, "0.0");
}

TEST(QuestDBSink, FormatFixedPointSmallFraction) {
    // 0.00000001 = 1 in fixed-point
    auto result = QuestDBSink::formatFixedPoint(1);
    EXPECT_EQ(result, "0.00000001");
}

TEST(QuestDBSink, BufferAccumulatesLines) {
    QuestDBSink::Config cfg;
    cfg.batchSize = 100; // Don't auto-flush
    QuestDBSink sink(cfg);
    // Not connected, so flush won't send, but we can check buffer size

    sink.writeLine("test_table col=1i 1000000000");
    EXPECT_EQ(sink.pendingLines(), 1u);

    sink.writeLine("test_table col=2i 2000000000");
    EXPECT_EQ(sink.pendingLines(), 2u);
    EXPECT_GT(sink.bufferSize(), 0u);
}

TEST(QuestDBSink, WriteTradeFormat) {
    QuestDBSink::Config cfg;
    cfg.batchSize = 1000;
    QuestDBSink sink(cfg);

    sink.writeTrade(1, 5000000000000LL, 100000000ULL, 1, 1, 1000000000ULL);
    EXPECT_EQ(sink.pendingLines(), 1u);
}
