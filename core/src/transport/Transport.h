#pragma once

#include <cstdint>
#include <cstddef>
#include <functional>

namespace mach_zero::transport {

// Abstract transport interface for publishing/subscribing to message streams.
// Allows different backends (Aeron IPC, UDP, TCP) to be swapped without
// changing application code.
class Transport {
public:
    using MessageHandler = std::function<void(const char* data, size_t length)>;

    virtual ~Transport() = default;

    virtual int64_t publish(int32_t streamId, const char* buffer, size_t length) = 0;
    virtual void subscribe(int32_t streamId, MessageHandler handler) = 0;
    virtual int poll(int32_t streamId, int fragmentLimit = 10) = 0;
    virtual bool isConnected() const = 0;
};

} // namespace mach_zero::transport
