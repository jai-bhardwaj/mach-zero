#pragma once

#include <cstdint>
#include <string>
#include <fstream>
#include <mutex>
#include <chrono>
#include <cstring>
#include <vector>
#include <functional>

namespace mach_zero::transport {

// Binary audit logger with nanosecond timestamps.
// Records all trading events for compliance and replay.
// Format: [8B timestamp][2B eventType][4B length][payload]
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

    explicit AuditLogger(const std::string& logPath)
        : path_(logPath) {}

    ~AuditLogger() { close(); }

    bool open() {
        std::lock_guard<std::mutex> lock(mutex_);
        file_.open(path_, std::ios::binary | std::ios::app);
        return file_.is_open();
    }

    void close() {
        std::lock_guard<std::mutex> lock(mutex_);
        if (file_.is_open()) {
            file_.flush();
            file_.close();
        }
    }

    bool log(EventType type, const char* data, uint32_t length) {
        AuditRecord record;
        record.timestampNanos = currentNanos();
        record.eventType = type;
        record.payloadLength = length;

        std::lock_guard<std::mutex> lock(mutex_);
        file_.write(reinterpret_cast<const char*>(&record), sizeof(record));
        if (length > 0 && data) {
            file_.write(data, length);
        }
        ++recordCount_;
        return file_.good();
    }

    // Log a text event (for system events, kill switch activation, etc.)
    bool logText(EventType type, const std::string& message) {
        return log(type, message.data(), static_cast<uint32_t>(message.size()));
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

    std::string path_;
    std::ofstream file_;
    std::mutex mutex_;
    uint64_t recordCount_ = 0;
};

} // namespace mach_zero::transport
