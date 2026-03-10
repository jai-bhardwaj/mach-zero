#pragma once

#include <cstdint>
#include <vector>
#include <utility>

namespace mach_zero::transport {

// Tracks sequence numbers per stream to detect gaps and enable replay.
class SequenceTracker {
public:
    explicit SequenceTracker(uint64_t expectedFirst = 1)
        : expectedNext_(expectedFirst) {}

    struct GapInfo {
        uint64_t gapStart;
        uint64_t gapEnd;  // inclusive
    };

    // Process a sequence number. Returns true if in order, false if gap detected.
    bool onSequence(uint64_t seqNum) {
        ++totalReceived_;

        if (seqNum == expectedNext_) {
            // In order
            expectedNext_ = seqNum + 1;
            return true;
        }

        if (seqNum > expectedNext_) {
            // Gap detected
            GapInfo gap{expectedNext_, seqNum - 1};
            gaps_.push_back(gap);
            totalGaps_ += (seqNum - expectedNext_);
            expectedNext_ = seqNum + 1;
            return false;
        }

        // Duplicate or out-of-order (seqNum < expectedNext_)
        ++totalDuplicates_;
        return true;  // Not a gap, just a duplicate
    }

    // Check if a specific sequence was in a gap
    bool isInGap(uint64_t seqNum) const {
        for (const auto& gap : gaps_) {
            if (seqNum >= gap.gapStart && seqNum <= gap.gapEnd) {
                return true;
            }
        }
        return false;
    }

    // Fill a gap (e.g. after replay)
    void fillGap(uint64_t seqNum) {
        for (auto it = gaps_.begin(); it != gaps_.end(); ) {
            if (seqNum >= it->gapStart && seqNum <= it->gapEnd) {
                if (it->gapStart == it->gapEnd) {
                    it = gaps_.erase(it);
                } else if (seqNum == it->gapStart) {
                    it->gapStart++;
                    ++it;
                } else if (seqNum == it->gapEnd) {
                    it->gapEnd--;
                    ++it;
                } else {
                    // Split the gap
                    GapInfo newGap{seqNum + 1, it->gapEnd};
                    it->gapEnd = seqNum - 1;
                    it = gaps_.insert(it + 1, newGap);
                    ++it;
                }
                --totalGaps_;
                return;
            }
            ++it;
        }
    }

    uint64_t expectedNext() const { return expectedNext_; }
    uint64_t totalReceived() const { return totalReceived_; }
    uint64_t totalGaps() const { return totalGaps_; }
    uint64_t totalDuplicates() const { return totalDuplicates_; }
    const std::vector<GapInfo>& gaps() const { return gaps_; }
    bool hasGaps() const { return !gaps_.empty(); }

    void reset(uint64_t expectedFirst = 1) {
        expectedNext_ = expectedFirst;
        totalReceived_ = 0;
        totalGaps_ = 0;
        totalDuplicates_ = 0;
        gaps_.clear();
    }

private:
    uint64_t expectedNext_;
    uint64_t totalReceived_ = 0;
    uint64_t totalGaps_ = 0;
    uint64_t totalDuplicates_ = 0;
    std::vector<GapInfo> gaps_;
};

} // namespace mach_zero::transport
