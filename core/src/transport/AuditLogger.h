#pragma once

#include <cstdint>
#include <string>
#include <fstream>
#include <mutex>
#include <chrono>
#include <cstring>
#include <cerrno>
#include <vector>
#include <functional>
#include <fcntl.h>
#include <unistd.h>

namespace mach_zero::transport {

// Binary audit logger with nanosecond timestamps.
// Records all trading events for compliance and replay.
// Format: [8B timestamp][2B eventType][4B length][payload]
//
// Durability: the write path uses a raw POSIX fd (not buffered std::ofstream)
// so we can fsync to disk. Each record is written in a SINGLE ::write so a
// crash can't interleave a header with a missing payload. Per-record fsync is
// opt-in (Config::durableEachRecord) since it trades throughput for the
// strongest guarantee; otherwise call sync() periodically and rely on the
// fsync-on-close. Readers use std::ifstream and are unaffected (byte format is
// identical).
class AuditLogger {
public:
    enum class EventType : uint16_t {
        MarketData     = 1,
        OrderSubmit    = 2,
        OrderAck       = 3,
        RiskReject     = 4,
        KillSwitch     = 5,
        PositionUpdate = 6,
        SystemEvent    = 7
    };

    struct AuditRecord {
        uint64_t timestampNanos;
        EventType eventType;
        uint32_t payloadLength;
    };

    struct Config {
        // fsync after every record — strongest durability, lowest throughput.
        // Default off: callers checkpoint via sync() and rely on fsync-on-close.
        bool durableEachRecord = false;
    };

    explicit AuditLogger(const std::string& logPath)
        : path_(logPath) {}

    AuditLogger(const std::string& logPath, Config config)
        : path_(logPath), config_(config) {}

    ~AuditLogger() { close(); }

    bool open() {
        std::lock_guard<std::mutex> lock(mutex_);
        if (fd_ >= 0) return true;
        fd_ = ::open(path_.c_str(), O_WRONLY | O_CREAT | O_APPEND, 0644);
        return fd_ >= 0;
    }

    void close() {
        std::lock_guard<std::mutex> lock(mutex_);
        if (fd_ >= 0) {
            ::fsync(fd_);   // flush kernel buffers to disk on clean shutdown
            ::close(fd_);
            fd_ = -1;
        }
    }

    bool log(EventType type, const char* data, uint32_t length) {
        AuditRecord record;
        record.timestampNanos = currentNanos();
        record.eventType = type;
        record.payloadLength = length;

        std::lock_guard<std::mutex> lock(mutex_);
        if (fd_ < 0) return false;

        // Assemble header+payload into one contiguous buffer and write it in a
        // single syscall, so a crash never leaves a header without its payload.
        scratch_.clear();
        const char* recBytes = reinterpret_cast<const char*>(&record);
        scratch_.insert(scratch_.end(), recBytes, recBytes + sizeof(record));
        if (length > 0 && data) {
            scratch_.insert(scratch_.end(), data, data + length);
        }
        if (!writeAll(scratch_.data(), scratch_.size())) return false;

        ++recordCount_;
        if (config_.durableEachRecord) {
            if (::fsync(fd_) != 0) return false;
        }
        return true;
    }

    // Log a text event (for system events, kill switch activation, etc.)
    bool logText(EventType type, const std::string& message) {
        return log(type, message.data(), static_cast<uint32_t>(message.size()));
    }

    // Durably checkpoint everything written so far to disk. Call on critical
    // events (e.g. kill-switch activation) or on a periodic timer.
    bool sync() {
        std::lock_guard<std::mutex> lock(mutex_);
        return fd_ >= 0 && ::fsync(fd_) == 0;
    }

    // Read all records from an audit log
    using ReadCallback = std::function<void(const AuditRecord&, const char* data)>;

    static bool readLog(const std::string& path, ReadCallback callback) {
        std::ifstream file(path, std::ios::binary);
        if (!file.is_open()) return false;

        AuditRecord record;
        std::vector<char> buffer;

        while (file.read(reinterpret_cast<char*>(&record), sizeof(record))) {
            buffer.resize(record.payloadLength);
            if (record.payloadLength > 0) {
                if (!file.read(buffer.data(), record.payloadLength)) {
                    return false;
                }
            }
            callback(record, buffer.data());
        }
        return true;
    }

    uint64_t recordCount() const { return recordCount_; }

private:
    static uint64_t currentNanos() {
        auto now = std::chrono::steady_clock::now();
        return static_cast<uint64_t>(
            std::chrono::duration_cast<std::chrono::nanoseconds>(
                now.time_since_epoch()).count());
    }

    // Write the whole buffer, retrying short writes and EINTR.
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
    uint64_t recordCount_ = 0;
};

} // namespace mach_zero::transport
