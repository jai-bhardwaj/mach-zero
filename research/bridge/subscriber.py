"""
SBE message decoder for Mach-Zero market data.

Decodes binary SBE messages from raw buffers using struct unpacking
(matching the schema defined in common/schemas/market_data.xml).

This avoids the broken sbedecoder dependency by directly unpacking
the fixed-layout SBE messages.
"""

import struct
from dataclasses import dataclass
from enum import IntEnum


class Side(IntEnum):
    Unknown = 0
    Buy = 1
    Sell = 2


class Venue(IntEnum):
    Unknown = 0
    Binance = 1
    NSE = 2
    BSE = 3


# SBE MessageHeader: blockLength(u16), templateId(u16), schemaId(u16), version(u16)
HEADER_FORMAT = "<HHHH"
HEADER_SIZE = struct.calcsize(HEADER_FORMAT)


@dataclass
class Trade:
    symbol_id: int
    price: int       # Fixed-point, divide by 1e8 for decimal
    quantity: int     # Fixed-point, divide by 1e8 for decimal
    side: Side
    venue: Venue
    timestamp: int    # Nanoseconds since epoch

    TEMPLATE_ID = 1
    # Fields: symbolId(u64), price(i64), quantity(u64), side(u8), venue(u8), timestamp(u64)
    FORMAT = "<QqQBBQ"

    @classmethod
    def decode(cls, buf: bytes, offset: int = 0) -> "Trade":
        values = struct.unpack_from(cls.FORMAT, buf, offset + HEADER_SIZE)
        return cls(
            symbol_id=values[0],
            price=values[1],
            quantity=values[2],
            side=Side(values[3]),
            venue=Venue(values[4]),
            timestamp=values[5],
        )

    @property
    def price_decimal(self) -> float:
        return self.price / 1e8

    @property
    def quantity_decimal(self) -> float:
        return self.quantity / 1e8


@dataclass
class Quote:
    symbol_id: int
    bid_price: int
    bid_quantity: int
    ask_price: int
    ask_quantity: int
    venue: Venue
    sequence_number: int
    timestamp: int

    TEMPLATE_ID = 2
    # Fields: symbolId(u64), bidPrice(i64), bidQty(u64), askPrice(i64), askQty(u64),
    #         venue(u8), seqNo(u64), timestamp(u64)
    FORMAT = "<QqQqQBQQ"

    @classmethod
    def decode(cls, buf: bytes, offset: int = 0) -> "Quote":
        values = struct.unpack_from(cls.FORMAT, buf, offset + HEADER_SIZE)
        return cls(
            symbol_id=values[0],
            bid_price=values[1],
            bid_quantity=values[2],
            ask_price=values[3],
            ask_quantity=values[4],
            venue=Venue(values[5]),
            sequence_number=values[6],
            timestamp=values[7],
        )


# Template ID -> decoder class mapping
DECODERS = {
    Trade.TEMPLATE_ID: Trade,
    Quote.TEMPLATE_ID: Quote,
}


def decode_message(buf: bytes, offset: int = 0):
    """Decode an SBE message from a raw buffer. Returns the appropriate dataclass."""
    _, template_id, _, _ = struct.unpack_from(HEADER_FORMAT, buf, offset)
    decoder = DECODERS.get(template_id)
    if decoder is None:
        raise ValueError(f"Unknown SBE template ID: {template_id}")
    return decoder.decode(buf, offset)
