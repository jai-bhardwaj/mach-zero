#include <mach_zero_market_data/Trade.h>
#include <mach_zero_market_data/Quote.h>
#include <mach_zero_market_data/Venue.h>
#include <mach_zero_market_data/MessageHeader.h>
#include "WebSocketClient.h"
#include "BinanceParser.h"
#include "SymbolMap.h"
#include <common/ipc/AeronPublisher.h>
#include <common/ipc/ChannelConfig.h>
#include <common/logger/Logger.h>

#include <iostream>
#include <string>
#include <thread>
#include <atomic>
#include <csignal>

using namespace mach_zero::market_data;
using namespace mach_zero::gateway;
using namespace mach_zero::ipc;

static std::atomic<bool> running{true};

void signalHandler(int) { running.store(false); }

int main(int argc, char* argv[]) {
    std::signal(SIGINT, signalHandler);
    std::signal(SIGTERM, signalHandler);

    MZ_INFO("Mach-Zero: Binance Gateway Starting...");

    // Symbol map for string <-> numeric ID conversion
    SymbolMap symbolMap;

    // Aeron publisher for market data
    AeronPublisher publisher(std::string(IPC_CHANNEL), MARKET_DATA_STREAM);
    MZ_INFO("Aeron publisher ready on MARKET_DATA_STREAM");

    // Parser for Binance JSON -> SBE binary
    BinanceParser parser(symbolMap);

    // Buffer for SBE encoding
    char sbeBuffer[512];

    // Connect to Binance combined stream for trades and depth
    std::string wsUrl = "wss://stream.binance.com:9443/stream?streams="
                        "btcusdt@trade/ethusdt@trade/"
                        "btcusdt@depth@100ms/ethusdt@depth@100ms";

    if (argc > 1) {
        wsUrl = argv[1]; // Allow custom URL override
    }

    WebSocketClient ws(wsUrl);

    ws.setOnMessage([&](const std::string& message) {
        // Binance combined stream wraps messages in {"stream":"...","data":{...}}
        // Try parsing as trade first, then depth update
        const char* json = message.c_str();
        size_t jsonLen = message.size();

        // For combined streams, extract the "data" payload
        // simdjson will handle the full JSON; the parser checks the "e" field
        // to determine message type

        // Try trade parse
        size_t len = parser.parseTrade(json, jsonLen, sbeBuffer, sizeof(sbeBuffer));
        if (len > 0) {
            publisher.publish(sbeBuffer, len);
            return;
        }

        // Try depth update parse
        len = parser.parseDepthUpdate(json, jsonLen, sbeBuffer, sizeof(sbeBuffer));
        if (len > 0) {
            publisher.publish(sbeBuffer, len);
            return;
        }
    });

    ws.start();
    std::cerr << "Binance WebSocket gateway started. Press Ctrl+C to stop." << std::endl;

    while (running.load()) {
        std::this_thread::sleep_for(std::chrono::seconds(1));
    }

    ws.stop();
    MZ_INFO("Mach-Zero: Binance Gateway Stopped.");
    return 0;
}
