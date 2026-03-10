#pragma once

#include <cstddef>
#include <cstdint>
#include <sys/mman.h>
#include <stdexcept>

namespace mach_zero::memory {

// Allocates memory backed by huge pages (2MB) for reduced TLB misses.
// Falls back to regular mmap if huge pages are unavailable.
class HugePageAllocator {
public:
    static void* allocate(size_t size) {
        // Round up to 2MB boundary
        constexpr size_t HUGE_PAGE_SIZE = 2 * 1024 * 1024;
        size_t aligned = (size + HUGE_PAGE_SIZE - 1) & ~(HUGE_PAGE_SIZE - 1);

        void* ptr = nullptr;

#ifdef __linux__
        // Try huge pages first
        ptr = mmap(nullptr, aligned, PROT_READ | PROT_WRITE,
                   MAP_PRIVATE | MAP_ANONYMOUS | MAP_HUGETLB, -1, 0);
        if (ptr == MAP_FAILED) {
            // Fall back to regular pages with MADV_HUGEPAGE hint
            ptr = mmap(nullptr, aligned, PROT_READ | PROT_WRITE,
                       MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
            if (ptr != MAP_FAILED) {
                madvise(ptr, aligned, MADV_HUGEPAGE);
            }
        }
#else
        // macOS and others: regular mmap
        ptr = mmap(nullptr, aligned, PROT_READ | PROT_WRITE,
                   MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
#endif

        if (ptr == MAP_FAILED) {
            throw std::runtime_error("HugePageAllocator: mmap failed");
        }

        return ptr;
    }

    static void deallocate(void* ptr, size_t size) {
        constexpr size_t HUGE_PAGE_SIZE = 2 * 1024 * 1024;
        size_t aligned = (size + HUGE_PAGE_SIZE - 1) & ~(HUGE_PAGE_SIZE - 1);
        munmap(ptr, aligned);
    }
};

} // namespace mach_zero::memory
