"""
QuestDB ingestion sink for Mach-Zero market data.

Reads SBE-encoded messages from shared memory (or Aeron via future bridge)
and writes them to QuestDB using the InfluxDB Line Protocol.

Usage:
    python questdb_sink.py
"""

import time
import sys
import os
from questdb.ingress import Sender, TimestampNanos
from subscriber import decode_message, Trade, Quote, HEADER_SIZE

# QuestDB connection string (ILP over HTTP)
QUESTDB_CONF = "http::addr=localhost:9000;"


def handle_trade(trade: Trade, sender: Sender):
    """Insert a decoded Trade into QuestDB."""
    sender.row(
        "trades",
        symbols={
            "symbol": str(trade.symbol_id),
            "venue": trade.venue.name,
            "side": trade.side.name,
        },
        columns={
            "price": trade.price_decimal,
            "quantity": trade.quantity_decimal,
        },
        at=TimestampNanos(trade.timestamp),
    )


def handle_quote(quote: Quote, sender: Sender):
    """Insert a decoded Quote into QuestDB."""
    sender.row(
        "quotes",
        symbols={
            "symbol": str(quote.symbol_id),
            "venue": quote.venue.name,
        },
        columns={
            "bid_price": quote.bid_price / 1e8,
            "bid_quantity": quote.bid_quantity / 1e8,
            "ask_price": quote.ask_price / 1e8,
            "ask_quantity": quote.ask_quantity / 1e8,
            "sequence_number": quote.sequence_number,
        },
        at=TimestampNanos(quote.timestamp),
    )


def run_sink():
    """Main sink loop. Currently reads from stdin (pipe from C++ subscriber).

    In production, this will read from shared memory (ZeroIPC bridge, Phase 4).
    For now, pair with the C++ subscriber that outputs binary SBE to a file/pipe.
    """
    print("Mach-Zero: QuestDB Sink Active")
    print(f"Connecting to QuestDB at {QUESTDB_CONF}")

    with Sender.from_conf(QUESTDB_CONF) as sender:
        print("Connected. Waiting for data on stdin...")
        print("(Pipe binary SBE messages from C++ subscriber)")

        # Read binary SBE messages from stdin
        batch_count = 0
        while True:
            # Read header first to determine message size
            header_data = sys.stdin.buffer.read(HEADER_SIZE)
            if not header_data or len(header_data) < HEADER_SIZE:
                time.sleep(0.001)
                continue

            # Read the message body (block length from header)
            import struct
            block_length = struct.unpack_from("<H", header_data, 0)[0]
            body_data = sys.stdin.buffer.read(block_length)
            if not body_data or len(body_data) < block_length:
                continue

            full_msg = header_data + body_data

            try:
                msg = decode_message(full_msg)
                if isinstance(msg, Trade):
                    handle_trade(msg, sender)
                elif isinstance(msg, Quote):
                    handle_quote(msg, sender)

                batch_count += 1
                if batch_count >= 100:
                    sender.flush()
                    batch_count = 0
            except Exception as e:
                print(f"Decode error: {e}", file=sys.stderr)


if __name__ == "__main__":
    run_sink()
