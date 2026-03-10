#include "BinanceRestClient.h"
#include "OrderTranslator.h"
#include <common/ipc/AeronPublisher.h>
#include <common/ipc/AeronSubscriber.h>
#include <common/ipc/ChannelConfig.h>
#include <common/logger/Logger.h>
#include <mach_zero_market_data/OrderRequest.h>
#include <mach_zero_market_data/OrderAck.h>
#include <mach_zero_market_data/MessageHeader.h>

#include <iostream>
#include <thread>
#include <atomic>
#include <csignal>

using namespace mach_zero::market_data;
using namespace mach_zero::gateway;
using namespace mach_zero::ipc;

static std::atomic<bool> running{true};
void signalHandler(int) { running.store(false); }

int main() {
    std::signal(SIGINT, signalHandler);
    std::signal(SIGTERM, signalHandler);

    MZ_INFO("Mach-Zero: Binance REST Gateway Starting...");

    // REST client (testnet)
    BinanceRestClient restClient("", "", "https://testnet.binance.vision");

    // Subscribe to validated orders, publish acks
    AeronSubscriber subscriber(std::string(IPC_CHANNEL), VALIDATED_ORDER_STREAM,
                               AeronSubscriber::IdleStrategy::Sleeping);
    AeronPublisher ackPublisher(std::string(IPC_CHANNEL), ACK_STREAM);

    // Simple symbol ID -> name map (would share with SymbolMap in production)
    auto symbolName = [](uint64_t id) -> std::string {
        switch (id) {
            case 1: return "BTCUSDT";
            case 2: return "ETHUSDT";
            case 3: return "BNBUSDT";
            default: return "UNKNOWN";
        }
    };

    char ackBuf[256];

    std::cerr << "Binance REST gateway running. Press Ctrl+C to stop." << std::endl;

    while (running.load()) {
        int frags = subscriber.poll(
            [&](aeron::concurrent::AtomicBuffer& buffer, aeron::util::index_t offset,
                aeron::util::index_t length, aeron::Header& /*header*/) {
                char* data = reinterpret_cast<char*>(buffer.buffer()) + offset;
                MessageHeader hdr(data, length, MessageHeader::sbeSchemaVersion());

                if (hdr.templateId() != OrderRequest::sbeTemplateId()) return;

                OrderRequest req;
                req.wrapForDecode(data, MessageHeader::encodedLength(),
                                  hdr.blockLength(), hdr.version(), length);

                // Only handle Binance orders
                if (req.venue() != Venue::Binance) return;

                auto params = OrderTranslator::toRestParams(req, symbolName(req.symbolId()));
                auto resp = restClient.placeOrder(params.symbol, params.side,
                                                  params.type, params.quantity, params.price);

                if (resp.success()) {
                    size_t ackLen = OrderTranslator::createAck(
                        req, 0, OrderStatus::Value::New, 0, 0, ackBuf, sizeof(ackBuf));
                    ackPublisher.publish(ackBuf, ackLen);
                    MZ_INFO("Order placed successfully");
                } else {
                    MZ_ERROR("Order placement failed");
                }
            });

        if (frags == 0) {
            std::this_thread::sleep_for(std::chrono::milliseconds(1));
        }
    }

    MZ_INFO("Mach-Zero: Binance REST Gateway Stopped.");
    return 0;
}
