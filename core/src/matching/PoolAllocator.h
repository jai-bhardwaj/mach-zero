#pragma once

#include <array>
#include <cstddef>
#include <cassert>

namespace mach_zero::matching {

// Fixed-size object pool. Pre-allocates N objects, hands them out/reclaims
// without malloc. Zero allocations on the hot path after construction.
template <typename T, size_t Capacity>
class PoolAllocator {
public:
    PoolAllocator() {
        for (size_t i = 0; i < Capacity - 1; ++i) {
            freeList_[i] = i + 1;
        }
        freeList_[Capacity - 1] = INVALID;
        freeHead_ = 0;
        size_ = 0;
    }

    T* allocate() {
        if (freeHead_ == INVALID) return nullptr;
        size_t idx = freeHead_;
        freeHead_ = freeList_[idx];
        ++size_;
        return &pool_[idx];
    }

    void deallocate(T* ptr) {
        assert(ptr >= &pool_[0] && ptr < &pool_[Capacity]);
        size_t idx = static_cast<size_t>(ptr - &pool_[0]);
        freeList_[idx] = freeHead_;
        freeHead_ = idx;
        --size_;
    }

    size_t size() const { return size_; }
    size_t capacity() const { return Capacity; }
    bool full() const { return size_ == Capacity; }

private:
    static constexpr size_t INVALID = ~size_t(0);
    std::array<T, Capacity> pool_{};
    std::array<size_t, Capacity> freeList_{};
    size_t freeHead_ = 0;
    size_t size_ = 0;
};

} // namespace mach_zero::matching
