#pragma once

#include <cstdint>
#include <string>
#include <vector>
#include <fstream>
#include <functional>
#include <mutex>
#include <chrono>
#include <cstring>
#include <cerrno>
#include <fcntl.h>
#include <unistd.h>

namespace mach_zero::transport {

// Durable message recording for replay and audit.
// Records messages to a binary log file with nanosecond timestamps.
// Format: [8 bytes timestamp][4 bytes stream_id][4 bytes length][N bytes payload]
//
// Durability: the write path uses a raw POSIX fd so we can fsync. Each record's
// header+payload is written in a SINGLE ::write — previously they were two
// separate buffered writes, so a crash between them left a header advertising a
// payload that never made it, which corrupts replay (the reader trusts
// payloadLength). Per-record fsync is opt-in; otherwise call sync() periodically
// and rely on fsync-on-close. Replay readers use std::ifstream (byte format
// unchanged).
class AeronArchive {
public:
    struct RecordHeader {
        uint64_t timestampNanos;
        int32_t streamId;
        uint32_t payloadLength;
    };

    struct Config {
        bool durableEachRecord = false;
    };

    explicit AeronArchive(const std::string& archivePath)
        : path_(archivePath) {}

    AeronArchive(const std::string& archivePath, Config config)
        : path_(archivePath), config_(config) {}

    ~AeronArchive() {
        close();
    }

    bool open() {
        std::lock_guard<std::mutex> lock(mutex_);
        if (fd_ >= 0) return true;
        fd_ = ::open(path_.c_str(), O_WRONLY | O_CREAT | O_APPEND, 0644);
        if (fd_ < 0) return false;
        isOpen_ = true;
        return true;
    }

    void close() {
        std::lock_guard<std::mutex> lock(mutex_);
        if (fd_ >= 0) {
            ::fsync(fd_);
            ::close(fd_);
            fd_ = -1;
        }
        isOpen_ = false;
    }

    // Record a message with current timestamp.
    bool record(int32_t streamId, const char* data, uint32_t length) {
        RecordHeader header;
        header.timestampNanos = currentNanos();
        header.streamId = streamId;
        header.payloadLength = length;

        std::lock_guard<std::mutex> lock(mutex_);
        if (fd_ < 0) return false;

        // One contiguous write of header+payload: a crash can't split them.
        scratch_.clear();
        const char* hdrBytes = reinterpret_cast<const char*>(&header);
        scratch_.insert(scratch_.end(), hdrBytes, hdrBytes + sizeof(header));
        if (length > 0 && data) {
            scratch_.insert(scratch_.end(), data, data + length);
        }
        if (!writeAll(scratch_.data(), scratch_.size())) return false;

        ++recordCount_;
        totalBytes_ += sizeof(header) + length;
        if (config_.durableEachRecord) {
            if (::fsync(fd_) != 0) return false;
        }
        return true;
    }

    // Durably checkpoint the archive to disk.
    bool sync() {
        std::lock_guard<std::mutex> lock(mutex_);
        return fd_ >= 0 && ::fsync(fd_) == 0;
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

    bool writeAll(const char* p, size_t n) {
        size_t off = 0;
        while (off < n) {
            ssize_t w = ::write(fd_, p + off, n - off);
            if (w < 0) {
                if (errno == EINTR) continue;
                return false;
            }
            if (w == 0) return false;
            off += static_cast<size_t>(w);
        }
        return true;
    }

    std::string path_;
    Config config_;
    int fd_ = -1;
    std::vector<char> scratch_;
    std::mutex mutex_;
    bool isOpen_ = false;
    uint64_t recordCount_ = 0;
    uint64_t totalBytes_ = 0;
};

} // namespace mach_zero::transport
