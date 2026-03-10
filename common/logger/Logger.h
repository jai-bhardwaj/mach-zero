#pragma once

#include <atomic>
#include <array>
#include <cstdint>
#include <cstring>
#include <chrono>
#include <iostream>
#include <thread>
#include <string_view>
#include <cstdio>

namespace mach_zero::log {

enum class Level : uint8_t {
    Trace = 0,
    Debug = 1,
    Info  = 2,
    Warn  = 3,
    Error = 4,
    Fatal = 5
};

constexpr const char* levelStr(Level level) {
    switch (level) {
        case Level::Trace: return "TRC";
        case Level::Debug: return "DBG";
        case Level::Info:  return "INF";
        case Level::Warn:  return "WRN";
        case Level::Error: return "ERR";
        case Level::Fatal: return "FTL";
    }
    return "???";
}

// Lock-free SPSC ring buffer logger.
// Single producer writes log entries on the hot path.
// A background flush thread drains entries to stderr (never blocks the producer).
class Logger {
public:
    static constexpr size_t RING_SIZE = 8192;  // Must be power of 2
    static constexpr size_t MAX_MSG_LEN = 256;

    struct Entry {
        uint64_t timestampNs;
        Level level;
        char message[MAX_MSG_LEN];
    };

    static Logger& instance() {
        static Logger logger;
        return logger;
    }

    void setMinLevel(Level level) { minLevel_.store(level, std::memory_order_relaxed); }

    // Non-blocking write. Drops the message if the ring is full.
    void log(Level level, const char* msg) {
        if (level < minLevel_.load(std::memory_order_relaxed)) return;

        uint64_t writePos = writePos_.load(std::memory_order_relaxed);
        uint64_t readPos = readPos_.load(std::memory_order_acquire);

        // Full ring -- drop the message rather than block
        if (writePos - readPos >= RING_SIZE) {
            droppedCount_.fetch_add(1, std::memory_order_relaxed);
            return;
        }

        auto& entry = ring_[writePos & (RING_SIZE - 1)];
        entry.timestampNs = static_cast<uint64_t>(
            std::chrono::steady_clock::now().time_since_epoch().count());
        entry.level = level;
        std::strncpy(entry.message, msg, MAX_MSG_LEN - 1);
        entry.message[MAX_MSG_LEN - 1] = '\0';

        writePos_.store(writePos + 1, std::memory_order_release);
    }

    void log(Level level, const char* file, int line, const char* msg) {
        char buf[MAX_MSG_LEN];
        std::snprintf(buf, sizeof(buf), "[%s:%d] %s", file, line, msg);
        log(level, buf);
    }

    ~Logger() {
        running_.store(false, std::memory_order_relaxed);
        if (flushThread_.joinable()) {
            flushThread_.join();
        }
        flush(); // Drain remaining entries
    }

private:
    Logger() : running_(true) {
        writePos_.store(0, std::memory_order_relaxed);
        readPos_.store(0, std::memory_order_relaxed);
        droppedCount_.store(0, std::memory_order_relaxed);
        minLevel_.store(Level::Info, std::memory_order_relaxed);

        flushThread_ = std::thread([this] { flushLoop(); });
    }

    Logger(const Logger&) = delete;
    Logger& operator=(const Logger&) = delete;

    void flushLoop() {
        while (running_.load(std::memory_order_relaxed)) {
            flush();
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
        }
    }

    void flush() {
        uint64_t readPos = readPos_.load(std::memory_order_relaxed);
        uint64_t writePos = writePos_.load(std::memory_order_acquire);

        while (readPos < writePos) {
            auto& entry = ring_[readPos & (RING_SIZE - 1)];
            std::fprintf(stderr, "[%s] %s\n", levelStr(entry.level), entry.message);
            ++readPos;
        }

        readPos_.store(readPos, std::memory_order_release);
    }

    std::array<Entry, RING_SIZE> ring_;
    alignas(64) std::atomic<uint64_t> writePos_;
    alignas(64) std::atomic<uint64_t> readPos_;
    std::atomic<uint64_t> droppedCount_;
    std::atomic<Level> minLevel_;
    std::atomic<bool> running_;
    std::thread flushThread_;
};

} // namespace mach_zero::log

// Logging macros -- compile to no-ops for TRACE/DEBUG in release builds
#define MZ_LOG(level, msg) mach_zero::log::Logger::instance().log(level, msg)

#ifndef NDEBUG
  #define MZ_TRACE(msg) MZ_LOG(mach_zero::log::Level::Trace, msg)
  #define MZ_DEBUG(msg) MZ_LOG(mach_zero::log::Level::Debug, msg)
#else
  #define MZ_TRACE(msg) ((void)0)
  #define MZ_DEBUG(msg) ((void)0)
#endif

#define MZ_INFO(msg)  MZ_LOG(mach_zero::log::Level::Info, msg)
#define MZ_WARN(msg)  MZ_LOG(mach_zero::log::Level::Warn, msg)
#define MZ_ERROR(msg) MZ_LOG(mach_zero::log::Level::Error, msg)
#define MZ_FATAL(msg) MZ_LOG(mach_zero::log::Level::Fatal, msg)
