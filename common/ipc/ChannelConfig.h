#pragma once

#include <Aeron.h>
#include <cstdint>
#include <memory>
#include <string_view>

namespace mach_zero::ipc {

// Aeron channel for local IPC via shared memory
constexpr std::string_view IPC_CHANNEL = "aeron:ipc";

// Stream IDs for different message flows
constexpr std::int32_t MARKET_DATA_STREAM     = 1001;  // Trade + Quote messages
constexpr std::int32_t ORDER_STREAM           = 1002;  // OrderRequest from strategy
constexpr std::int32_t RISK_STREAM            = 1003;  // Risk events / commands
constexpr std::int32_t PERSISTENCE_STREAM     = 1004;  // Data destined for QuestDB
constexpr std::int32_t VALIDATED_ORDER_STREAM = 1005;  // Orders that passed risk checks
constexpr std::int32_t ACK_STREAM             = 1006;  // OrderAck / OrderReject from exchange

// Create a shared Aeron instance. All publishers/subscribers in a service
// should share one instance to avoid heartbeat timeout issues.
inline std::shared_ptr<aeron::Aeron> createAeronInstance() {
    aeron::Context ctx;
    return std::make_shared<aeron::Aeron>(ctx);
}

} // namespace mach_zero::ipc
