#include <gtest/gtest.h>
#include <matching/OrderBook.h>
#include <matching/PoolAllocator.h>
#include <matching/PriceLevel.h>
#include <chrono>

using namespace mach_zero::matching;

TEST(OrderBook, EmptyBookReturnsZero) {
    OrderBook book(1);
    EXPECT_EQ(book.bestBid().price, 0);
    EXPECT_EQ(book.bestAsk().price, 0);
    EXPECT_EQ(book.midPrice(), 0);
    EXPECT_EQ(book.spread(), 0);
    EXPECT_EQ(book.bidLevels(), 0u);
    EXPECT_EQ(book.askLevels(), 0u);
}

TEST(OrderBook, SetBidAsk) {
    OrderBook book(1);
    book.setBid(10000, 100);
    book.setAsk(10100, 200);

    EXPECT_EQ(book.bestBid().price, 10000);
    EXPECT_EQ(book.bestBid().quantity, 100u);
    EXPECT_EQ(book.bestAsk().price, 10100);
    EXPECT_EQ(book.bestAsk().quantity, 200u);
}

TEST(OrderBook, BestBidIsHighest) {
    OrderBook book(1);
    book.setBid(100, 10);
    book.setBid(200, 20);
    book.setBid(150, 15);

    EXPECT_EQ(book.bestBid().price, 200);
    EXPECT_EQ(book.bestBid().quantity, 20u);
}

TEST(OrderBook, BestAskIsLowest) {
    OrderBook book(1);
    book.setAsk(300, 30);
    book.setAsk(200, 20);
    book.setAsk(250, 25);

    EXPECT_EQ(book.bestAsk().price, 200);
    EXPECT_EQ(book.bestAsk().quantity, 20u);
}

TEST(OrderBook, MidPriceAndSpread) {
    OrderBook book(1);
    book.setBid(10000, 100);
    book.setAsk(10200, 200);

    EXPECT_EQ(book.midPrice(), 10100);
    EXPECT_EQ(book.spread(), 200);
}

TEST(OrderBook, RemoveLevelBySettingZeroQty) {
    OrderBook book(1);
    book.setBid(100, 10);
    book.setBid(200, 20);
    EXPECT_EQ(book.bidLevels(), 2u);

    book.setBid(200, 0); // Remove level
    EXPECT_EQ(book.bidLevels(), 1u);
    EXPECT_EQ(book.bestBid().price, 100);
}

TEST(OrderBook, GetLevelByDepth) {
    OrderBook book(1);
    book.setBid(100, 10);
    book.setBid(200, 20);
    book.setBid(150, 15);

    EXPECT_EQ(book.getBidLevel(0).price, 200); // Best = highest
    EXPECT_EQ(book.getBidLevel(1).price, 150);
    EXPECT_EQ(book.getBidLevel(2).price, 100);
    EXPECT_EQ(book.getBidLevel(3).price, 0); // Out of range

    book.setAsk(300, 30);
    book.setAsk(250, 25);
    EXPECT_EQ(book.getAskLevel(0).price, 250); // Best = lowest
    EXPECT_EQ(book.getAskLevel(1).price, 300);
}

TEST(OrderBook, Clear) {
    OrderBook book(1);
    book.setBid(100, 10);
    book.setAsk(200, 20);
    book.clear();
    EXPECT_EQ(book.bidLevels(), 0u);
    EXPECT_EQ(book.askLevels(), 0u);
}

TEST(PoolAllocator, AllocateAndDeallocate) {
    PoolAllocator<PriceLevel, 16> pool;
    EXPECT_EQ(pool.size(), 0u);

    auto* p1 = pool.allocate();
    ASSERT_NE(p1, nullptr);
    EXPECT_EQ(pool.size(), 1u);

    auto* p2 = pool.allocate();
    ASSERT_NE(p2, nullptr);
    ASSERT_NE(p1, p2);
    EXPECT_EQ(pool.size(), 2u);

    pool.deallocate(p1);
    EXPECT_EQ(pool.size(), 1u);

    pool.deallocate(p2);
    EXPECT_EQ(pool.size(), 0u);
}

TEST(PoolAllocator, ExhaustPool) {
    PoolAllocator<PriceLevel, 4> pool;
    pool.allocate();
    pool.allocate();
    pool.allocate();
    pool.allocate();
    EXPECT_TRUE(pool.full());
    EXPECT_EQ(pool.allocate(), nullptr);
}

TEST(OrderBook, BenchmarkUpdates) {
    OrderBook book(1);
    constexpr int N = 100000;

    auto start = std::chrono::high_resolution_clock::now();
    for (int i = 0; i < N; ++i) {
        book.setBid(10000 + (i % 100), static_cast<uint64_t>(100 + i));
        book.setAsk(10200 + (i % 100), static_cast<uint64_t>(200 + i));
    }
    auto end = std::chrono::high_resolution_clock::now();

    auto ns = std::chrono::duration_cast<std::chrono::nanoseconds>(end - start).count();
    double nsPerOp = static_cast<double>(ns) / (N * 2);
    std::cerr << "OrderBook update: " << nsPerOp << " ns/op (" << N * 2 << " ops)" << std::endl;

    // Should be well under 500ns per operation
    EXPECT_LT(nsPerOp, 5000.0); // Generous bound for CI
}
