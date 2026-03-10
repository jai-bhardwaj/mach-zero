#include "NseOrderEntry.h"
#include <common/ipc/AeronSubscriber.h>
#include <common/ipc/AeronPublisher.h>
#include <common/ipc/ChannelConfig.h>
#include <common/logger/Logger.h>
#include <mach_zero_market_data/MessageHeader.h>
#include <mach_zero_market_data/OrderRequest.h>

#include <iostream>
#include <atomic>
#include <csignal>
#include <thread>

using namespace mach_zero::nse;
using namespace mach_zero::ipc;
using namespace mach_zero::market_data;

static std::atomic<bool> running{true};
void signalHandler(int) { running.store(false); }

int main() {
    std::signal(SIGINT, signalHandler);
    std::signal(SIGTERM, signalHandler);

    MZ_INFO("Mach-Zero: NSE Order Entry Gateway Starting...");

    // NSE order entry client (simulated)
    NseOrderEntry nseClient;

    // Ack publisher
    AeronPublisher ackPublisher(std::string(IPC_CHANNEL), ACK_STREAM);

    nseClient.setAckCallback([&](const char* data, size_t len) {
        ackPublisher.publish(data, len);
    });

    // Subscribe to validated orders for NSE venue
    AeronSubscriber orderSub(std::string(IPC_CHANNEL), VALIDATED_ORDER_STREAM,
                             AeronSubscriber::IdleStrategy::Sleeping);

    std::cerr << "NSE Order Entry Gateway running. Press Ctrl+C to stop." << std::endl;

    while (running.load()) {
        orderSub.poll(
            [&](aeron::concurrent::AtomicBuffer& buffer, aeron::util::index_t offset,
                aeron::util::index_t length, aeron::Header& /*header*/) {
                char* data = reinterpret_cast<char*>(buffer.buffer()) + offset;
                MessageHeader hdr(data, length, MessageHeader::sbeSchemaVersion());

                if (hdr.templateId() == OrderRequest::sbeTemplateId()) {
                    OrderRequest req;
                    req.wrapForDecode(data, MessageHeader::encodedLength(),
                                      hdr.blockLength(), hdr.version(), length);

                    if (req.venue() == Venue::NSE) {
                        nseClient.submitOrder(req);
                    }
                }
            }, 50);

        // Periodic heartbeat
        static uint64_t loopCount = 0;
        if (++loopCount % 100000 == 0) {
            nseClient.sendHeartbeat();
        }

        std::this_thread::sleep_for(std::chrono::microseconds(100));
    }

    MZ_INFO("Mach-Zero: NSE Order Entry Gateway Stopped.");
    return 0;
}
