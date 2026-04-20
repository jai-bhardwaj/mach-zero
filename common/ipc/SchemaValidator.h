#pragma once

#include <mach_zero_market_data/MessageHeader.h>

namespace mach_zero::ipc {

// Validates an incoming SBE MessageHeader before any decode.
// Rejects messages whose schemaId doesn't match this build, and messages
// whose version is older than what this build requires. Forward-compat
// (newer message version than this build) is accepted per SBE semantics.
//
// Every Aeron poll handler MUST call this before wrapForDecode; otherwise
// a stale producer feeding a newer consumer will silently decode garbage.
inline bool isValidSchema(const mach_zero::market_data::MessageHeader& hdr) noexcept {
    return hdr.schemaId() == mach_zero::market_data::MessageHeader::sbeSchemaId()
        && hdr.version() >= mach_zero::market_data::MessageHeader::sbeSchemaVersion();
}

}  // namespace mach_zero::ipc
