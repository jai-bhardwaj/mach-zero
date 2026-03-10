#pragma once

#include <cstddef>
#include <cstdint>
#include <cstring>
#include <stdexcept>

namespace mach_zero::memory {

// Monotonic bump allocator: fast, zero-fragmentation, batch-reset.
// Perfect for per-event allocation in the hot path where all allocations
// from one event can be released at once via reset().
class ArenaAllocator {
public:
    explicit ArenaAllocator(size_t capacity)
        : capacity_(capacity), offset_(0) {
        buffer_ = new char[capacity];
    }

    ~ArenaAllocator() {
        delete[] buffer_;
    }

    // Non-copyable
    ArenaAllocator(const ArenaAllocator&) = delete;
    ArenaAllocator& operator=(const ArenaAllocator&) = delete;

    // Allocate aligned memory from the arena
    void* allocate(size_t size, size_t alignment = 8) {
        size_t aligned_offset = (offset_ + alignment - 1) & ~(alignment - 1);
        if (aligned_offset + size > capacity_) {
            return nullptr; // Out of space
        }
        void* ptr = buffer_ + aligned_offset;
        offset_ = aligned_offset + size;
        return ptr;
    }

    // Allocate and zero-initialize
    void* allocateZeroed(size_t size, size_t alignment = 8) {
        void* ptr = allocate(size, alignment);
        if (ptr) {
            std::memset(ptr, 0, size);
        }
        return ptr;
    }

    // Typed allocation
    template<typename T, typename... Args>
    T* create(Args&&... args) {
        void* ptr = allocate(sizeof(T), alignof(T));
        if (!ptr) return nullptr;
        return new (ptr) T(std::forward<Args>(args)...);
    }

    // Reset all allocations (does not free memory)
    void reset() { offset_ = 0; }

    size_t used() const { return offset_; }
    size_t remaining() const { return capacity_ - offset_; }
    size_t capacity() const { return capacity_; }

private:
    char* buffer_;
    size_t capacity_;
    size_t offset_;
};

} // namespace mach_zero::memory
