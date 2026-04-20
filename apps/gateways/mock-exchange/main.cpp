#include <research/backtesting/SimulatedExchange.h>
#include <common/ipc/AeronPublisher.h>
#include <common/ipc/AeronSubscriber.h>
#include <common/ipc/ChannelConfig.h>
#include <common/ipc/SchemaValidator.h>
#include <common/logger/Logger.h>
#include <common/clock/Clock.h>
#include <mach_zero_market_data/MessageHeader.h>
#include <mach_zero_market_data/OrderRequest.h>
#include <mach_zero_market_data/OrderAck.h>
#include <mach_zero_market_data/Trade.h>

#include <iostream>
#include <thread>
#include <atomic>
#include <csignal>
#include <cstring>

using namespace mach_zero::market_data;
using namespace mach_zero::backtest;
using namespace mach_zero::ipc;

static std::atomic<bool> running{true};
void signalHandler(int) { running.store(false); }

int main() {
    std::signal(SIGINT, signalHandler);
    std::signal(SIGTERM, signalHandler);

    MZ_INFO("Mach-Zero: Mock Exchange Gateway Starting...");

    // Single shared Aeron instance
    auto aeron = createAeronInstance();

    // Ack publisher on ACK_STREAM (1006)
    AeronPublisher ackPublisher(aeron, std::string(IPC_CHANNEL), ACK_STREAM);

    // Simulated exchange for order matching
    SimulatedExchange simExchange;

    // Wall clock for timestamps
    mach_zero::WallClock wallClock;

    // Fill callback: patch venue + timestamp, then publish to ACK_STREAM
    char patchBuf[256];
    simExchange.setFillCallback([&](const char* data, size_t len) {
        if (len > sizeof(patchBuf)) return;

        // Copy to mutable buffer for patching
        std::memcpy(patchBuf, data, len);

        // Parse header to get block length and version
        MessageHeader hdr(patchBuf, len, MessageHeader::sbeSchemaVersion());

        // Patch venue and timestamp on the ack
        OrderAck ack;
        ack.wrapForDecode(patchBuf, MessageHeader::encodedLength(),
                          hdr.blockLength(), hdr.version(), len);
        ack.venue(Venue::Binance);
        ack.timestamp(wallClock.nowNanos());

        ackPublisher.publish(patchBuf, len);
    });

    // Subscribe to validated orders on VALIDATED_ORDER_STREAM (1005)
    AeronSubscriber orderSub(aeron, std::string(IPC_CHANNEL), VALIDATED_ORDER_STREAM,
                             AeronSubscriber::IdleStrategy::Sleeping);

    // Subscribe to market data on MARKET_DATA_STREAM (1001) for order matching
    AeronSubscriber mdSub(aeron, std::string(IPC_CHANNEL), MARKET_DATA_STREAM,
                          AeronSubscriber::IdleStrategy::Sleeping);

    uint64_t ordersReceived = 0;
    uint64_t tradesProcessed = 0;

    std::cerr << "Mock Exchange running. Press Ctrl+C to stop." << std::endl;

    while (running.load()) {
        // Poll validated orders — submit to simulated exchange
        orderSub.pollRaw(
            [&](aeron::concurrent::AtomicBuffer& buffer, aeron::util::index_t offset,
                aeron::util::index_t length, aeron::Header& /*header*/) {
                char* data = reinterpret_cast<char*>(buffer.buffer()) + offset;
                MessageHeader hdr(data, length, MessageHeader::sbeSchemaVersion());
                if (!mach_zero::ipc::isValidSchema(hdr)) return;

                if (hdr.templateId() == OrderRequest::sbeTemplateId()) {
                    OrderRequest req;
                    req.wrapForDecode(data, MessageHeader::encodedLength(),
                                      hdr.blockLength(), hdr.version(), length);
                    simExchange.submitOrder(req);
                    ++ordersReceived;
                }
            }, 50);

        // Poll market data — feed trades to simulated exchange for fill matching
        mdSub.pollRaw(
            [&](aeron::concurrent::AtomicBuffer& buffer, aeron::util::index_t offset,
                aeron::util::index_t length, aeron::Header& /*header*/) {
                char* data = reinterpret_cast<char*>(buffer.buffer()) + offset;
                MessageHeader hdr(data, length, MessageHeader::sbeSchemaVersion());
                if (!mach_zero::ipc::isValidSchema(hdr)) return;

                if (hdr.templateId() == Trade::sbeTemplateId()) {
                    Trade trade;
                    trade.wrapForDecode(data, MessageHeader::encodedLength(),
                                        hdr.blockLength(), hdr.version(), length);
                    simExchange.onMarketTrade(
                        trade.symbolId(), trade.price(), trade.quantity());
                    ++tradesProcessed;
                }
            }, 100);

        // Periodic status log
        if (tradesProcessed > 0 && tradesProcessed % 10000 == 0) {
            std::string msg = "Mock exchange: " + std::to_string(ordersReceived) +
                " orders, " + std::to_string(simExchange.totalFills()) +
                " fills, " + std::to_string(simExchange.openOrderCount()) + " open";
            MZ_INFO(msg.c_str());
        }

        // Idle when no fragments (100us sleep matches engine pattern)
        std::this_thread::sleep_for(std::chrono::microseconds(100));
    }

    std::string finalMsg = "Mock exchange final: " + std::to_string(ordersReceived) +
        " orders received, " + std::to_string(simExchange.totalFills()) + " fills";
    MZ_INFO(finalMsg.c_str());
    MZ_INFO("Mach-Zero: Mock Exchange Gateway Stopped.");
    return 0;
}
