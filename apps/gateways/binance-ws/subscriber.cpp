#include <Aeron.h>
#include <mach_zero_market_data/Trade.h>
#include <mach_zero_market_data/MessageHeader.h>
#include <iostream>
#include <thread>

using namespace mach_zero::market_data;
using namespace aeron;

// The handler that processes each message fragment
fragment_handler_t trade_handler() {
    // Aeron C++ fragment handler: (AtomicBuffer& buffer, util::index_t offset, util::index_t length, Header& header)
    return [](AtomicBuffer& buffer, util::index_t offset, util::index_t length, Header& /*header*/) {
        using mach_zero::market_data::MessageHeader;

        // Decode SBE message header first
        char* data = reinterpret_cast<char*>(buffer.buffer()) + offset;
        MessageHeader hdr(data, length, MessageHeader::sbeSchemaVersion());

        if (hdr.templateId() != Trade::sbeTemplateId()) {
            std::cerr << "Unexpected templateId: " << hdr.templateId() << std::endl;
            return;
        }

        Trade trade;
        // Wrap the incoming buffer for zero-copy decoding (after the header)
        trade.wrapForDecode(
            data,
            MessageHeader::encodedLength(),
            hdr.blockLength(),
            hdr.version(),
            length);

        std::cout << ">>> Trade Received | Symbol: " << trade.symbolId()
                  << " | Price: " << (trade.price() / 1e8) // Assuming 1e8 scaling
                  << " | Qty: " << trade.quantity()
                  << " | Side: " << (trade.side() == Side::Buy ? "BUY" : "SELL")
                  << std::endl;
    };
}

int main() {
    Context ctx;
    Aeron aeron(ctx);

    // Subscribe to the same channel/stream as the publisher
    std::int64_t subId = aeron.addSubscription("aeron:ipc", 1001);
    auto subscription = aeron.findSubscription(subId);
    while (!subscription) { subscription = aeron.findSubscription(subId); }

    std::cout << "Mach-Zero: Subscriber Monitor Active. Waiting for trades..." << std::endl;

    while (true) {
        // Poll the bus for new messages
        int fragmentsRead = subscription->poll(trade_handler(), 10);
        if (fragmentsRead == 0) {
            std::this_thread::sleep_for(std::chrono::milliseconds(1));
        }
    }
    return 0;
}