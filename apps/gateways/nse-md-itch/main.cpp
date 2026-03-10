#include "ItchParser.h"
#include "NseSymbolMap.h"
#include "ItchMessages.h"
#include <common/ipc/AeronPublisher.h>
#include <common/ipc/ChannelConfig.h>
#include <common/logger/Logger.h>

#include <iostream>
#include <thread>
#include <atomic>
#include <csignal>
#include <cstring>
#include <chrono>
#include <random>

using namespace mach_zero::gateway;
using namespace mach_zero::ipc;

static std::atomic<bool> running{true};
void signalHandler(int) { running.store(false); }

// Generate synthetic ITCH trade messages for testing
void generateSyntheticData(AeronPublisher& publisher, ItchParser& parser) {
    std::mt19937 rng(42);
    std::uniform_int_distribution<int64_t> priceDist(200000, 300000); // 2000.00 - 3000.00 rupees in paise
    std::uniform_int_distribution<uint64_t> qtyDist(1, 1000);
    std::uniform_int_distribution<int> sideDist(0, 1);

    // NSE token IDs for common stocks
    uint32_t tokens[] = {2885, 3045, 11536, 341249, 408065};
    std::uniform_int_distribution<int> tokenDist(0, 4);

    char itchBuf[256];
    char sbeBuf[256];
    uint64_t tradeId = 1;

    MZ_INFO("NSE ITCH Simulator: Generating synthetic market data...");

    while (running.load()) {
        // Build a synthetic ITCH TradeMessage
        auto* trade = reinterpret_cast<itch::TradeMessage*>(itchBuf);
        trade->header.length = sizeof(itch::TradeMessage) - sizeof(uint16_t);
        trade->header.messageType = itch::MSG_TRADE;
        trade->timestamp = static_cast<uint64_t>(
            std::chrono::steady_clock::now().time_since_epoch().count());
        trade->tradeId = tradeId++;
        trade->tokenId = tokens[tokenDist(rng)];
        trade->price = priceDist(rng);
        trade->quantity = qtyDist(rng);
        trade->side = sideDist(rng) ? 'B' : 'S';

        size_t len = parser.parseTrade(itchBuf, sizeof(itch::TradeMessage), sbeBuf, sizeof(sbeBuf));
        if (len > 0) {
            publisher.publish(sbeBuf, len);
        }

        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }
}

int main() {
    std::signal(SIGINT, signalHandler);
    std::signal(SIGTERM, signalHandler);

    MZ_INFO("Mach-Zero: NSE ITCH Gateway (Simulator) Starting...");

    NseSymbolMap symbolMap;
    ItchParser parser(symbolMap);
    AeronPublisher publisher(std::string(IPC_CHANNEL), MARKET_DATA_STREAM);

    std::cerr << "NSE ITCH simulator running. Press Ctrl+C to stop." << std::endl;
    generateSyntheticData(publisher, parser);

    MZ_INFO("Mach-Zero: NSE ITCH Gateway Stopped.");
    return 0;
}
