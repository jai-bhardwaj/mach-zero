#include <gtest/gtest.h>
#include <transport/ReconnectionManager.h>

using namespace mach_zero::transport;

TEST(ReconnectionManager, SucceedsOnFirstAttempt) {
    ReconnectionManager mgr;
    bool result = mgr.attemptReconnect([]() { return true; });
    EXPECT_TRUE(result);
    EXPECT_EQ(mgr.consecutiveFailures(), 0u);
    EXPECT_EQ(mgr.successfulReconnects(), 1u);
}

TEST(ReconnectionManager, SucceedsAfterFailures) {
    ReconnectionManager::Config cfg;
    cfg.initialDelayMs = 1;  // Fast for testing
    cfg.maxDelayMs = 10;

    ReconnectionManager mgr(cfg);
    int attempts = 0;

    bool result = mgr.attemptReconnect([&]() {
        ++attempts;
        return attempts >= 3;  // Succeed on 3rd attempt
    });

    EXPECT_TRUE(result);
    EXPECT_EQ(attempts, 3);
    EXPECT_EQ(mgr.consecutiveFailures(), 0u);
    EXPECT_EQ(mgr.successfulReconnects(), 1u);
}

TEST(ReconnectionManager, RespectsMaxAttempts) {
    ReconnectionManager::Config cfg;
    cfg.initialDelayMs = 1;
    cfg.maxAttempts = 5;

    ReconnectionManager mgr(cfg);
    int attempts = 0;

    bool result = mgr.attemptReconnect([&]() {
        ++attempts;
        return false;  // Always fail
    });

    EXPECT_FALSE(result);
    EXPECT_EQ(attempts, 5);
    EXPECT_EQ(mgr.consecutiveFailures(), 5u);
}

TEST(ReconnectionManager, ResetClearsFailures) {
    ReconnectionManager::Config cfg;
    cfg.initialDelayMs = 1;
    cfg.maxAttempts = 2;

    ReconnectionManager mgr(cfg);

    mgr.attemptReconnect([]() { return false; });
    EXPECT_EQ(mgr.consecutiveFailures(), 2u);

    mgr.reset();
    EXPECT_EQ(mgr.consecutiveFailures(), 0u);
}
