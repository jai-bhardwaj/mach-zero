#include <gtest/gtest.h>
#include <common/ipc/SharedMemoryWriter.h>
#include <common/ipc/SharedMemoryLayout.h>
#include <thread>

using namespace mach_zero::ipc;

class SharedMemoryTest : public ::testing::Test {
protected:
    void SetUp() override {
        writer = std::make_unique<SharedMemoryWriter>("/mz_test_shm");
        ASSERT_TRUE(writer->open());
    }

    void TearDown() override {
        writer->unlink();
        writer.reset();
    }

    std::unique_ptr<SharedMemoryWriter> writer;
};

TEST_F(SharedMemoryTest, OpenAndClose) {
    EXPECT_TRUE(writer->isOpen());
}

TEST_F(SharedMemoryTest, UpdateMarketData) {
    writer->updateMarketData(1, 5000000000000LL, 100000000ULL,
                             4999900000000LL, 500000000ULL,
                             5000100000000LL, 300000000ULL,
                             1000000000ULL);

    const auto* sym = writer->getSymbol(1);
    ASSERT_NE(sym, nullptr);
    EXPECT_EQ(sym->lastPrice, 5000000000000LL);
    EXPECT_EQ(sym->lastQuantity, 100000000ULL);
    EXPECT_EQ(sym->bidPrice, 4999900000000LL);
    EXPECT_EQ(sym->askPrice, 5000100000000LL);
}

TEST_F(SharedMemoryTest, UpdatePosition) {
    writer->updatePosition(1, 500000000LL, 100000000LL, -50000000LL);

    const auto* sym = writer->getSymbol(1);
    ASSERT_NE(sym, nullptr);
    EXPECT_EQ(sym->position, 500000000LL);
    EXPECT_EQ(sym->unrealizedPnl, 100000000LL);
    EXPECT_EQ(sym->realizedPnl, -50000000LL);
}

TEST_F(SharedMemoryTest, IncrementCounters) {
    writer->incrementOrderCount(1);
    writer->incrementOrderCount(1);
    writer->incrementFillCount(1);

    const auto* sym = writer->getSymbol(1);
    ASSERT_NE(sym, nullptr);
    EXPECT_EQ(sym->orderCount, 2u);
    EXPECT_EQ(sym->fillCount, 1u);
}

TEST_F(SharedMemoryTest, SequenceNumberIncrementsCorrectly) {
    const auto* sym = writer->getSymbol(1);
    ASSERT_NE(sym, nullptr);

    uint64_t seq0 = sym->sequence.load();

    writer->updateMarketData(1, 5000000000000LL, 100000000ULL,
                             0, 0, 0, 0, 1000000000ULL);

    uint64_t seq1 = sym->sequence.load();
    // Should have incremented by 2 (begin + end)
    EXPECT_EQ(seq1, seq0 + 2);
    // Should be even (stable)
    EXPECT_EQ(seq1 % 2, 0u);
}

TEST_F(SharedMemoryTest, BoundsCheckOnInvalidSymbol) {
    // Should not crash
    writer->updateMarketData(SHM_MAX_SYMBOLS + 1, 0, 0, 0, 0, 0, 0, 0);
    const auto* sym = writer->getSymbol(SHM_MAX_SYMBOLS + 1);
    EXPECT_EQ(sym, nullptr);
}

TEST_F(SharedMemoryTest, MultipleSymbolsIndependent) {
    writer->updateMarketData(1, 100LL, 1ULL, 0, 0, 0, 0, 1ULL);
    writer->updateMarketData(2, 200LL, 2ULL, 0, 0, 0, 0, 2ULL);

    EXPECT_EQ(writer->getSymbol(1)->lastPrice, 100LL);
    EXPECT_EQ(writer->getSymbol(2)->lastPrice, 200LL);
}
