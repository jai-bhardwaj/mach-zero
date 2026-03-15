#pragma once

#include <string>
#include <vector>
#include <chrono>
#include <cstdint>
#include <cstring>
#include <sstream>
#include <sys/socket.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <arpa/inet.h>
#include <netdb.h>
#include <unistd.h>

namespace mach_zero::transport {

// QuestDB ILP (InfluxDB Line Protocol) sink over TCP.
// Batches writes and flushes periodically for high throughput.
class QuestDBSink {
public:
    struct Config {
        std::string host = "127.0.0.1";
        uint16_t port = 9009;
        size_t batchSize = 100;        // Flush after N lines
        size_t bufferCapacity = 65536; // Pre-allocated buffer
    };

    explicit QuestDBSink(const Config& config)
        : config_(config), fd_(-1), lineCount_(0) {
        buffer_.reserve(config_.bufferCapacity);
    }

    ~QuestDBSink() {
        flush();
        disconnect();
    }

    bool connect() {
        fd_ = ::socket(AF_INET, SOCK_STREAM, 0);
        if (fd_ < 0) return false;

        int flag = 1;
        ::setsockopt(fd_, IPPROTO_TCP, TCP_NODELAY, &flag, sizeof(flag));

        struct sockaddr_in addr{};
        addr.sin_family = AF_INET;
        addr.sin_port = htons(config_.port);

        // Try numeric IP first, fall back to DNS resolution for hostnames
        if (::inet_pton(AF_INET, config_.host.c_str(), &addr.sin_addr) != 1) {
            struct addrinfo hints{}, *res = nullptr;
            hints.ai_family = AF_INET;
            hints.ai_socktype = SOCK_STREAM;
            if (::getaddrinfo(config_.host.c_str(), nullptr, &hints, &res) != 0 || !res) {
                ::close(fd_);
                fd_ = -1;
                return false;
            }
            addr.sin_addr = reinterpret_cast<struct sockaddr_in*>(res->ai_addr)->sin_addr;
            ::freeaddrinfo(res);
        }

        if (::connect(fd_, reinterpret_cast<struct sockaddr*>(&addr), sizeof(addr)) < 0) {
            ::close(fd_);
            fd_ = -1;
            return false;
        }
        connected_ = true;
        return true;
    }

    void disconnect() {
        if (fd_ >= 0) {
            ::close(fd_);
            fd_ = -1;
        }
        connected_ = false;
    }

    bool isConnected() const { return connected_; }

    // Write a trade record in ILP format
    void writeTrade(uint64_t symbolId, int64_t price, uint64_t quantity,
                    uint8_t side, uint8_t venue, uint64_t timestampNanos) {
        buffer_.append("trades");
        appendTag("symbol_id", symbolId);
        appendTag("venue", venue);
        buffer_.append(" price=");
        appendFixedPoint(price);
        buffer_.append(",quantity=");
        appendFixedPoint(static_cast<int64_t>(quantity));
        buffer_.append(",side=");
        buffer_.append(std::to_string(side));
        buffer_.append("i ");
        buffer_.append(std::to_string(timestampNanos));
        buffer_.push_back('\n');
        maybeFlush();
    }

    // Write an order event in ILP format
    void writeOrder(uint64_t orderId, uint64_t symbolId, uint8_t side,
                    int64_t price, uint64_t quantity, const char* status,
                    uint64_t timestampNanos) {
        buffer_.append("orders");
        appendTag("symbol_id", symbolId);
        appendTag("order_id", orderId);
        buffer_.append(" side=");
        buffer_.append(std::to_string(side));
        buffer_.append("i,price=");
        appendFixedPoint(price);
        buffer_.append(",quantity=");
        appendFixedPoint(static_cast<int64_t>(quantity));
        buffer_.append(",status=\"");
        buffer_.append(status);
        buffer_.append("\" ");
        buffer_.append(std::to_string(timestampNanos));
        buffer_.push_back('\n');
        maybeFlush();
    }

    // Write a risk event in ILP format
    void writeRiskEvent(uint64_t orderId, uint64_t symbolId,
                        const char* reason, uint64_t timestampNanos) {
        buffer_.append("risk_events");
        appendTag("symbol_id", symbolId);
        appendTag("order_id", orderId);
        buffer_.append(" reason=\"");
        buffer_.append(reason);
        buffer_.append("\" ");
        buffer_.append(std::to_string(timestampNanos));
        buffer_.push_back('\n');
        maybeFlush();
    }

    // Write a raw ILP line
    void writeLine(const std::string& line) {
        buffer_.append(line);
        if (line.back() != '\n') buffer_.push_back('\n');
        maybeFlush();
    }

    // Force flush the buffer
    bool flush() {
        if (buffer_.empty() || !connected_) return false;

        ssize_t total = 0;
        while (total < static_cast<ssize_t>(buffer_.size())) {
            ssize_t sent = ::send(fd_, buffer_.data() + total,
                                  buffer_.size() - total, 0);
            if (sent <= 0) {
                connected_ = false;
                return false;
            }
            total += sent;
        }

        buffer_.clear();
        lineCount_ = 0;
        return true;
    }

    // Format a fixed-point value (8 decimal places) to ILP float
    static std::string formatFixedPoint(int64_t value) {
        bool negative = value < 0;
        uint64_t abs_val = negative ? static_cast<uint64_t>(-value) : static_cast<uint64_t>(value);
        uint64_t whole = abs_val / 100000000ULL;
        uint64_t frac = abs_val % 100000000ULL;

        std::string result;
        if (negative) result.push_back('-');
        result.append(std::to_string(whole));
        result.push_back('.');

        // Pad fractional part to 8 digits, then trim trailing zeros
        char fracStr[16];
        snprintf(fracStr, sizeof(fracStr), "%08llu", static_cast<unsigned long long>(frac));
        std::string fracPart(fracStr);
        while (fracPart.size() > 1 && fracPart.back() == '0') {
            fracPart.pop_back();
        }
        result.append(fracPart);
        return result;
    }

    size_t pendingLines() const { return lineCount_; }
    size_t bufferSize() const { return buffer_.size(); }

private:
    void appendTag(const char* key, uint64_t value) {
        buffer_.push_back(',');
        buffer_.append(key);
        buffer_.push_back('=');
        buffer_.append(std::to_string(value));
    }

    void appendFixedPoint(int64_t value) {
        buffer_.append(formatFixedPoint(value));
    }

    void maybeFlush() {
        ++lineCount_;
        if (lineCount_ >= config_.batchSize) {
            flush();
        }
    }

    Config config_;
    int fd_;
    bool connected_ = false;
    std::string buffer_;
    size_t lineCount_;
};

} // namespace mach_zero::transport
