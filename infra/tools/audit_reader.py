#!/usr/bin/env python3
"""
Audit log reader for Mach-Zero binary audit trail.
Decodes binary audit records and prints human-readable output.

Usage:
    python audit_reader.py <audit_log_file> [--filter EVENT_TYPE] [--after TIMESTAMP] [--before TIMESTAMP]
"""

import struct
import sys
import argparse
from datetime import datetime

# Must match AuditLogger::EventType enum
EVENT_TYPES = {
    1: "MarketData",
    2: "OrderSubmit",
    3: "OrderAck",
    4: "RiskReject",
    5: "KillSwitch",
    6: "PositionUpdate",
    7: "SystemEvent",
}

# AuditRecord: uint64_t timestamp, uint16_t eventType, uint32_t payloadLength
RECORD_HEADER_FORMAT = "<QHI"
RECORD_HEADER_SIZE = struct.calcsize(RECORD_HEADER_FORMAT)


def read_audit_log(filepath, event_filter=None, after_ns=0, before_ns=None):
    """Read and decode a binary audit log file."""
    records = []
    with open(filepath, "rb") as f:
        while True:
            header_data = f.read(RECORD_HEADER_SIZE)
            if len(header_data) < RECORD_HEADER_SIZE:
                break

            timestamp_ns, event_type, payload_length = struct.unpack(
                RECORD_HEADER_FORMAT, header_data
            )

            if payload_length > 10 * 1024 * 1024:  # Sanity check
                print(f"ERROR: payload too large ({payload_length} bytes), file may be corrupt")
                break

            payload = f.read(payload_length) if payload_length > 0 else b""
            if len(payload) < payload_length:
                break

            # Apply filters
            if event_filter and event_type != event_filter:
                continue
            if timestamp_ns < after_ns:
                continue
            if before_ns is not None and timestamp_ns > before_ns:
                continue

            records.append({
                "timestamp_ns": timestamp_ns,
                "event_type": event_type,
                "event_name": EVENT_TYPES.get(event_type, f"Unknown({event_type})"),
                "payload_length": payload_length,
                "payload": payload,
            })

    return records


def format_timestamp(ns):
    """Format nanosecond timestamp to human-readable."""
    seconds = ns / 1e9
    dt = datetime.fromtimestamp(seconds)
    nanos = ns % 1_000_000_000
    return f"{dt.strftime('%Y-%m-%d %H:%M:%S')}.{nanos:09d}"


def print_records(records, verbose=False):
    """Print audit records in a formatted table."""
    print(f"{'Timestamp':<35} {'Type':<16} {'Length':>8}  {'Payload'}")
    print("-" * 90)

    for r in records:
        payload_preview = ""
        if r["payload_length"] > 0:
            try:
                payload_preview = r["payload"].decode("utf-8", errors="replace")[:60]
            except Exception:
                payload_preview = r["payload"][:60].hex()

        ts = format_timestamp(r["timestamp_ns"])
        print(f"{ts:<35} {r['event_name']:<16} {r['payload_length']:>8}  {payload_preview}")

    print(f"\nTotal records: {len(records)}")


def main():
    parser = argparse.ArgumentParser(description="Mach-Zero Audit Log Reader")
    parser.add_argument("file", help="Path to binary audit log file")
    parser.add_argument("--filter", type=str, help="Filter by event type name")
    parser.add_argument("--after", type=int, default=0, help="After timestamp (nanoseconds)")
    parser.add_argument("--before", type=int, default=None, help="Before timestamp (nanoseconds)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    args = parser.parse_args()

    event_filter = None
    if args.filter:
        name_to_id = {v.lower(): k for k, v in EVENT_TYPES.items()}
        event_filter = name_to_id.get(args.filter.lower())
        if event_filter is None:
            print(f"Unknown event type: {args.filter}")
            print(f"Available: {', '.join(EVENT_TYPES.values())}")
            sys.exit(1)

    records = read_audit_log(args.file, event_filter, args.after, args.before)
    print_records(records, args.verbose)


if __name__ == "__main__":
    main()
