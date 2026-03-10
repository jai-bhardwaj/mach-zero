#include <gtest/gtest.h>
#include <transport/AuditLogger.h>
#include <transport/AeronArchive.h>
#include <transport/SequenceTracker.h>
#include <cstdio>
#include <string>
#include <vector>

using namespace mach_zero::transport;

class AuditTest : public ::testing::Test {
protected:
    void SetUp() override {
        auditPath_ = "/tmp/mach_zero_test_audit.bin";
        archivePath_ = "/tmp/mach_zero_test_archive.bin";
        std::remove(auditPath_.c_str());
        std::remove(archivePath_.c_str());
    }

    void TearDown() override {
        std::remove(auditPath_.c_str());
        std::remove(archivePath_.c_str());
    }

    std::string auditPath_;
    std::string archivePath_;
};

// --- AuditLogger Tests ---

TEST_F(AuditTest, WriteAndReadAuditLog) {
    {
        AuditLogger logger(auditPath_);
        ASSERT_TRUE(logger.open());

        logger.log(AuditLogger::EventType::OrderSubmit, "BUY BTCUSDT", 11);
        logger.log(AuditLogger::EventType::OrderAck, "ACK 12345", 9);
        logger.logText(AuditLogger::EventType::KillSwitch, "ACTIVATED");

        EXPECT_EQ(logger.recordCount(), 3u);
    }

    // Read back
    std::vector<AuditLogger::EventType> types;
    std::vector<std::string> payloads;

    AuditLogger::readLog(auditPath_, [&](const AuditLogger::AuditRecord& record, const char* data) {
        types.push_back(record.eventType);
        payloads.emplace_back(data, record.payloadLength);
    });

    ASSERT_EQ(types.size(), 3u);
    EXPECT_EQ(types[0], AuditLogger::EventType::OrderSubmit);
    EXPECT_EQ(types[1], AuditLogger::EventType::OrderAck);
    EXPECT_EQ(types[2], AuditLogger::EventType::KillSwitch);
    EXPECT_EQ(payloads[0], "BUY BTCUSDT");
    EXPECT_EQ(payloads[1], "ACK 12345");
    EXPECT_EQ(payloads[2], "ACTIVATED");
}

TEST_F(AuditTest, TimestampsAreMonotonic) {
    {
        AuditLogger logger(auditPath_);
        ASSERT_TRUE(logger.open());

        for (int i = 0; i < 100; ++i) {
            logger.logText(AuditLogger::EventType::SystemEvent, "tick");
        }
    }

    uint64_t prevTs = 0;
    int count = 0;
    AuditLogger::readLog(auditPath_, [&](const AuditLogger::AuditRecord& record, const char*) {
        EXPECT_GE(record.timestampNanos, prevTs);
        prevTs = record.timestampNanos;
        ++count;
    });
    EXPECT_EQ(count, 100);
}

// --- AeronArchive Tests ---

TEST_F(AuditTest, ArchiveRecordAndReplay) {
    {
        AeronArchive archive(archivePath_);
        ASSERT_TRUE(archive.open());

        const char data1[] = "trade_message_1";
        const char data2[] = "order_message_2";
        archive.record(1001, data1, sizeof(data1));
        archive.record(1002, data2, sizeof(data2));

        EXPECT_EQ(archive.recordCount(), 2u);
    }

    // Replay
    std::vector<int32_t> streamIds;
    std::vector<std::string> payloads;

    AeronArchive::replay(archivePath_, [&](const AeronArchive::RecordHeader& hdr, const char* data) {
        streamIds.push_back(hdr.streamId);
        payloads.emplace_back(data, hdr.payloadLength);
    });

    ASSERT_EQ(streamIds.size(), 2u);
    EXPECT_EQ(streamIds[0], 1001);
    EXPECT_EQ(streamIds[1], 1002);
    EXPECT_EQ(payloads[0], std::string("trade_message_1", sizeof("trade_message_1")));
}

// --- SequenceTracker Tests ---

TEST(SequenceTracker, InOrderSequences) {
    SequenceTracker tracker;

    EXPECT_TRUE(tracker.onSequence(1));
    EXPECT_TRUE(tracker.onSequence(2));
    EXPECT_TRUE(tracker.onSequence(3));

    EXPECT_EQ(tracker.expectedNext(), 4u);
    EXPECT_EQ(tracker.totalReceived(), 3u);
    EXPECT_EQ(tracker.totalGaps(), 0u);
    EXPECT_FALSE(tracker.hasGaps());
}

TEST(SequenceTracker, DetectsGap) {
    SequenceTracker tracker;

    EXPECT_TRUE(tracker.onSequence(1));
    EXPECT_TRUE(tracker.onSequence(2));
    EXPECT_FALSE(tracker.onSequence(5));  // Gap: 3, 4

    EXPECT_EQ(tracker.totalGaps(), 2u);
    EXPECT_TRUE(tracker.hasGaps());
    EXPECT_TRUE(tracker.isInGap(3));
    EXPECT_TRUE(tracker.isInGap(4));
    EXPECT_FALSE(tracker.isInGap(5));
}

TEST(SequenceTracker, FillGap) {
    SequenceTracker tracker;

    tracker.onSequence(1);
    tracker.onSequence(5);  // Gap: 2, 3, 4

    EXPECT_EQ(tracker.totalGaps(), 3u);

    tracker.fillGap(3);
    EXPECT_EQ(tracker.totalGaps(), 2u);
    EXPECT_FALSE(tracker.isInGap(3));
    EXPECT_TRUE(tracker.isInGap(2));
    EXPECT_TRUE(tracker.isInGap(4));
}

TEST(SequenceTracker, HandlesDuplicates) {
    SequenceTracker tracker;

    tracker.onSequence(1);
    tracker.onSequence(2);
    tracker.onSequence(2);  // Duplicate

    EXPECT_EQ(tracker.totalDuplicates(), 1u);
    EXPECT_EQ(tracker.totalGaps(), 0u);
}

TEST(SequenceTracker, Reset) {
    SequenceTracker tracker;
    tracker.onSequence(1);
    tracker.onSequence(5);

    tracker.reset(1);
    EXPECT_EQ(tracker.expectedNext(), 1u);
    EXPECT_EQ(tracker.totalGaps(), 0u);
    EXPECT_FALSE(tracker.hasGaps());
}
