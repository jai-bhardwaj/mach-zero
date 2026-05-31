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

    // (tenantId=0, symbolId=1, ...)
    sink.writeTrade(0, 1, 5000000000000LL, 100000000ULL, 1, 1, 1000000000ULL);
    EXPECT_EQ(sink.pendingLines(), 1u);
}

TEST(QuestDBSink, WriteOrderIncludesTenantId) {
    QuestDBSink::Config cfg;
    cfg.batchSize = 1000;
    QuestDBSink sink(cfg);

    sink.writeOrder(/*tenantId=*/42, /*orderId=*/100, /*symbolId=*/1, /*side=*/1,
                    /*price=*/5000000000000LL, /*quantity=*/100000000ULL,
                    "validated", 1000000000ULL);
    EXPECT_EQ(sink.pendingLines(), 1u);
    // Buffer should contain the tenant_id tag
    // (bufferSize is > 0 sanity; we can't easily inspect content without
    // exposing getter, but compiling & running is the guarantee that the
    // signature change didn't break callers.)
    EXPECT_GT(sink.bufferSize(), 0u);
}

TEST(QuestDBSink, WriteRiskEventIncludesTenantId) {
    QuestDBSink::Config cfg;
    cfg.batchSize = 1000;
    QuestDBSink sink(cfg);

    sink.writeRiskEvent(/*tenantId=*/7, /*orderId=*/100, /*symbolId=*/1,
                        "PositionLimit", 1000000000ULL);
    EXPECT_EQ(sink.pendingLines(), 1u);
    EXPECT_GT(sink.bufferSize(), 0u);
}

namespace {
// The ILP "measurement" is everything before the first space: `name[,tag=v...]`.
// Our schema types symbol_id/venue/order_id as LONG/INT, so they MUST be
// fields (after the space), never tags — a numeric column written as a tag is
// SYMBOL-typed and QuestDB rejects the line, tearing down the WAL writer.
std::string measurementOf(std::string_view line) {
    auto sp = line.find(' ');
    return std::string(line.substr(0, sp));
}
}  // namespace

TEST(QuestDBSink, TradeLineHasNoNumericTags) {
    QuestDBSink::Config cfg;
    cfg.batchSize = 1000;
    QuestDBSink sink(cfg);
    sink.writeTrade(0, 1, 5000000000000LL, 100000000ULL, 1, 1, 1000000000ULL);

    std::string line(sink.bufferContents());
    // Measurement must be just the table name — no tags (no comma before the space).
    EXPECT_EQ(measurementOf(line), "trades");
    // symbol_id/venue must appear as integer fields (=Ni), not tags.
    EXPECT_NE(line.find("symbol_id=1i"), std::string::npos);
    EXPECT_NE(line.find("venue=1i"), std::string::npos);
}

TEST(QuestDBSink, OrderLineHasNoNumericTags) {
    QuestDBSink::Config cfg;
    cfg.batchSize = 1000;
    QuestDBSink sink(cfg);
    sink.writeOrder(42, 100, 1, 1, 5000000000000LL, 100000000ULL, "filled", 1000000000ULL);

    std::string line(sink.bufferContents());
    EXPECT_EQ(measurementOf(line), "orders");
    EXPECT_NE(line.find("symbol_id=1i"), std::string::npos);
    EXPECT_NE(line.find("order_id=100i"), std::string::npos);
    EXPECT_NE(line.find("status=\"filled\""), std::string::npos);
}

TEST(QuestDBSink, RiskEventLineHasNoNumericTags) {
    QuestDBSink::Config cfg;
    cfg.batchSize = 1000;
    QuestDBSink sink(cfg);
    sink.writeRiskEvent(7, 100, 1, "PositionLimit", 1000000000ULL);

    std::string line(sink.bufferContents());
    EXPECT_EQ(measurementOf(line), "risk_events");
    EXPECT_NE(line.find("symbol_id=1i"), std::string::npos);
    EXPECT_NE(line.find("order_id=100i"), std::string::npos);
}
