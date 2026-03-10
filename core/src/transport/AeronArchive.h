#pragma once

#include <cstdint>
#include <string>
#include <vector>
#include <fstream>
#include <mutex>
#include <chrono>
#include <cstring>

namespace mach_zero::transport {

// Durable message recording for replay and audit.
// Records messages to a binary log file with nanosecond timestamps.
// Format: [8 bytes timestamp][4 bytes stream_id][4 bytes length][N bytes payload]
class AeronArchive {
public:
    struct RecordHeader {
        uint64_t timestampNanos;
        int32_t streamId;
        uint32_t payloadLength;
    };

    explicit AeronArchive(const std::string& archivePath)
        : path_(archivePath) {}

    ~AeronArchive() {
        close();
    }

    bool open() {
        std::lock_guard<std::mutex> lock(mutex_);
        file_.open(path_, std::ios::binary | std::ios::app);
        if (!file_.is_open()) return false;
        isOpen_ = true;
        return true;
    }

    void close() {
        std::lock_guard<std::mutex> lock(mutex_);
        if (file_.is_open()) {
            file_.flush();
            file_.close();
        }
        isOpen_ = false;
    }

    // Record a message with current timestamp
    bool record(int32_t streamId, const char* data, uint32_t length) {
        if (!isOpen_) return false;

        RecordHeader header;
        header.timestampNanos = currentNanos();
        header.streamId = streamId;
        header.payloadLength = length;

        std::lock_guard<std::mutex> lock(mutex_);
        file_.write(reinterpret_cast<const char*>(&header), sizeof(header));
        file_.write(data, length);
        ++recordCount_;
        totalBytes_ += sizeof(header) + length;
        return file_.good();
    }

    // Replay all records from the archive file, calling the callback for each
    using ReplayCallback = std::function<void(const RecordHeader&, const char* data)>;

    static bool replay(const std::string& path, ReplayCallback callback) {
        std::ifstream file(path, std::ios::binary);
        if (!file.is_open()) return false;

        RecordHeader header;
        std::vector<char> buffer;

        while (file.read(reinterpret_cast<char*>(&header), sizeof(header))) {
            if (header.payloadLength > 10 * 1024 * 1024) {
                return false;  // Sanity check: reject >10MB records
            }
            buffer.resize(header.payloadLength);
            if (!file.read(buffer.data(), header.payloadLength)) {
                return false;
            }
            callback(header, buffer.data());
        }

        return true;
    }

    // Replay with time range filter
    static bool replayRange(const std::string& path,
                            uint64_t startNanos, uint64_t endNanos,
                            ReplayCallback callback) {
        return replay(path, [&](const RecordHeader& hdr, const char* data) {
            if (hdr.timestampNanos >= startNanos && hdr.timestampNanos <= endNanos) {
                callback(hdr, data);
            }
        });
    }

    uint64_t recordCount() const { return recordCount_; }
    uint64_t totalBytes() const { return totalBytes_; }
    bool isOpen() const { return isOpen_; }

private:
    static uint64_t currentNanos() {
        auto now = std::chrono::steady_clock::now();
        return static_cast<uint64_t>(
            std::chrono::duration_cast<std::chrono::nanoseconds>(
                now.time_since_epoch()).count());
    }

    std::string path_;
    std::ofstream file_;
    std::mutex mutex_;
    bool isOpen_ = false;
    uint64_t recordCount_ = 0;
    uint64_t totalBytes_ = 0;
};

} // namespace mach_zero::transport
