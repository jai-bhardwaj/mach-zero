#pragma once

#include <cstdint>

#ifdef __linux__
#include <sched.h>
#include <pthread.h>
#endif

#ifdef __APPLE__
#include <mach/thread_policy.h>
#include <mach/thread_act.h>
#include <pthread.h>
#endif

namespace mach_zero::tuning {

// Pin the calling thread to a specific CPU core.
// On Linux: uses sched_setaffinity. On macOS: uses thread_policy_set (advisory).
// Returns true on success, false on failure.
inline bool pinThread(int coreId) {
#ifdef __linux__
    cpu_set_t cpuset;
    CPU_ZERO(&cpuset);
    CPU_SET(coreId, &cpuset);
    return pthread_setaffinity_np(pthread_self(), sizeof(cpu_set_t), &cpuset) == 0;
#elif defined(__APPLE__)
    // macOS doesn't support hard CPU affinity, but we can set affinity tags
    thread_affinity_policy_data_t policy = { coreId + 1 };
    thread_port_t mach_thread = pthread_mach_thread_np(pthread_self());
    return thread_policy_set(mach_thread, THREAD_AFFINITY_POLICY,
                            reinterpret_cast<thread_policy_t>(&policy),
                            THREAD_AFFINITY_POLICY_COUNT) == KERN_SUCCESS;
#else
    (void)coreId;
    return false;
#endif
}

// Set thread scheduling to SCHED_FIFO with given priority (Linux only).
inline bool setRealtimePriority(int priority = 90) {
#ifdef __linux__
    struct sched_param param;
    param.sched_priority = priority;
    return pthread_setschedparam(pthread_self(), SCHED_FIFO, &param) == 0;
#else
    (void)priority;
    return false;
#endif
}

} // namespace mach_zero::tuning
