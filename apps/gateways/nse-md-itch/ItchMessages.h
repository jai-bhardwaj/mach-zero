#pragma once

#include <cstdint>

namespace mach_zero::gateway::itch {

// NSE ITCH binary message structures (packed, byte-aligned).
// These match the NSE ITCH protocol layout byte-for-byte.

#pragma pack(push, 1)

struct ItchHeader {
    uint16_t length;       // Message length (excluding this field)
    uint8_t  messageType;  // Message type identifier
};

// Message type identifiers
static constexpr uint8_t MSG_ADD_ORDER    = 'A';
static constexpr uint8_t MSG_DELETE_ORDER = 'D';
static constexpr uint8_t MSG_MODIFY_ORDER = 'U';
static constexpr uint8_t MSG_TRADE        = 'P';
static constexpr uint8_t MSG_ORDER_BOOK   = 'S';

struct AddOrder {
    ItchHeader header;
    uint64_t timestamp;    // Nanoseconds since midnight
    uint64_t orderId;
    uint32_t tokenId;      // Instrument token (maps to symbolId)
    uint8_t  side;         // 'B' = Buy, 'S' = Sell
    int64_t  price;        // Price in paise (1/100 rupee)
    uint64_t quantity;
};

struct DeleteOrder {
    ItchHeader header;
    uint64_t timestamp;
    uint64_t orderId;
    uint32_t tokenId;
};

struct ModifyOrder {
    ItchHeader header;
    uint64_t timestamp;
    uint64_t orderId;
    uint32_t tokenId;
    uint8_t  side;
    int64_t  price;
    uint64_t quantity;
};

struct TradeMessage {
    ItchHeader header;
    uint64_t timestamp;
    uint64_t tradeId;
    uint32_t tokenId;
    int64_t  price;
    uint64_t quantity;
    uint8_t  side;         // Aggressor side
};

struct OrderBookSnapshot {
    ItchHeader header;
    uint32_t tokenId;
    int64_t  bidPrice1;
    uint64_t bidQty1;
    int64_t  askPrice1;
    uint64_t askQty1;
    int64_t  bidPrice2;
    uint64_t bidQty2;
    int64_t  askPrice2;
    uint64_t askQty2;
    // ... up to 5 levels in full spec
};

#pragma pack(pop)

} // namespace mach_zero::gateway::itch
