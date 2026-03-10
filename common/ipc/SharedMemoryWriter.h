#pragma once

#include "SharedMemoryLayout.h"
#include <sys/mman.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <cstring>
#include <chrono>
#include <string>

namespace mach_zero::ipc {

// Memory-mapped shared memory writer for C++ -> Python bridge.
// Single writer, multiple readers (lock-free via sequence numbers).
class SharedMemoryWriter {
public:
    explicit SharedMemoryWriter(const std::string& name = "/mach_zero_state")
        : name_(name) {}

    ~SharedMemoryWriter() {
        close();
    }

    bool open() {
        fd_ = shm_open(name_.c_str(), O_CREAT | O_RDWR, 0666);
        if (fd_ < 0) return false;

        if (ftruncate(fd_, SHM_TOTAL_SIZE) < 0) {
            ::close(fd_);
            fd_ = -1;
            return false;
        }

        void* ptr = mmap(nullptr, SHM_TOTAL_SIZE, PROT_READ | PROT_WRITE,
                         MAP_SHARED, fd_, 0);
        if (ptr == MAP_FAILED) {
            ::close(fd_);
            fd_ = -1;
            return false;
        }

        base_ = static_cast<char*>(ptr);
        header_ = reinterpret_cast<ShmHeader*>(base_);
        symbols_ = reinterpret_cast<SymbolState*>(base_ + sizeof(ShmHeader));

        // Initialize header
        header_->magic = 0x4D41434830;
        header_->version = 1;
        header_->numSymbols = SHM_MAX_SYMBOLS;
        header_->symbolStateOffset = sizeof(ShmHeader);
        header_->symbolStateSize = sizeof(SymbolState);
        header_->createdTimestamp = static_cast<uint64_t>(
            std::chrono::duration_cast<std::chrono::nanoseconds>(
                std::chrono::system_clock::now().time_since_epoch()).count());

        return true;
    }

    void close() {
        if (base_) {
            munmap(base_, SHM_TOTAL_SIZE);
            base_ = nullptr;
        }
        if (fd_ >= 0) {
            ::close(fd_);
            fd_ = -1;
        }
    }

    void unlink() {
        shm_unlink(name_.c_str());
    }

    // Update market data for a symbol
    void updateMarketData(uint64_t symbolId, int64_t lastPrice, uint64_t lastQty,
                          int64_t bidPrice, uint64_t bidQty,
                          int64_t askPrice, uint64_t askQty,
                          uint64_t timestampNanos) {
        if (symbolId >= SHM_MAX_SYMBOLS || !symbols_) return;

        auto& s = symbols_[symbolId];
        s.beginWrite();

        s.lastPrice = lastPrice;
        s.lastQuantity = lastQty;
        s.bidPrice = bidPrice;
        s.bidQuantity = bidQty;
        s.askPrice = askPrice;
        s.askQuantity = askQty;
        s.lastTradeTimestamp = timestampNanos;
        s.lastUpdateTimestamp = static_cast<uint64_t>(
            std::chrono::duration_cast<std::chrono::nanoseconds>(
                std::chrono::system_clock::now().time_since_epoch()).count());

        s.endWrite();
    }

    // Update position/risk data
    void updatePosition(uint64_t symbolId, int64_t position,
                        int64_t unrealizedPnl, int64_t realizedPnl) {
        if (symbolId >= SHM_MAX_SYMBOLS || !symbols_) return;

        auto& s = symbols_[symbolId];
        s.beginWrite();

        s.position = position;
        s.unrealizedPnl = unrealizedPnl;
        s.realizedPnl = realizedPnl;

        s.endWrite();
    }

    // Increment counters
    void incrementOrderCount(uint64_t symbolId) {
        if (symbolId >= SHM_MAX_SYMBOLS || !symbols_) return;
        auto& s = symbols_[symbolId];
        s.beginWrite();
        ++s.orderCount;
        s.endWrite();
    }

    void incrementFillCount(uint64_t symbolId) {
        if (symbolId >= SHM_MAX_SYMBOLS || !symbols_) return;
        auto& s = symbols_[symbolId];
        s.beginWrite();
        ++s.fillCount;
        s.endWrite();
    }

    const SymbolState* getSymbol(uint64_t symbolId) const {
        if (symbolId >= SHM_MAX_SYMBOLS || !symbols_) return nullptr;
        return &symbols_[symbolId];
    }

    bool isOpen() const { return base_ != nullptr; }

private:
    std::string name_;
    int fd_ = -1;
    char* base_ = nullptr;
    ShmHeader* header_ = nullptr;
    SymbolState* symbols_ = nullptr;
};

} // namespace mach_zero::ipc
