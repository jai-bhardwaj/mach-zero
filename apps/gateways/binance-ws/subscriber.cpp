#include <Aeron.h>
#include <mach_zero_market_data/Trade.h>
#include <mach_zero_market_data/Quote.h>
#include <mach_zero_market_data/MessageHeader.h>
#include <mach_zero_market_data/Side.h>
#include <mach_zero_market_data/Venue.h>
#include <common/ipc/ChannelConfig.h>

#include <iostream>
#include <thread>
#include <atomic>
#include <csignal>

using namespace mach_zero::market_data;
using namespace aeron;

static std::atomic<bool> running{true};

void signalHandler(int) { running.store(false); }

// Dispatch incoming SBE messages based on template ID
fragment_handler_t marketDataHandler() {
    return [](AtomicBuffer& buffer, util::index_t offset, util::index_t length, Header& /*header*/) {
        char* data = reinterpret_cast<char*>(buffer.buffer()) + offset;
        MessageHeader hdr(data, length, MessageHeader::sbeSchemaVersion());

        switch (hdr.templateId()) {
            case Trade::sbeTemplateId(): {
                Trade trade;
                trade.wrapForDecode(data, MessageHeader::encodedLength(),
                                    hdr.blockLength(), hdr.version(), length);
                std::cout << "TRADE | Symbol=" << trade.symbolId()
                          << " Price=" << (trade.price() / 1e8)
                          << " Qty=" << (trade.quantity() / 1e8)
                          << " Side=" << (trade.side() == Side::Buy ? "BUY" : "SELL")
                          << " Venue=" << (trade.venue() == Venue::Binance ? "BIN" : "NSE")
                          << std::endl;
                break;
            }
            case Quote::sbeTemplateId(): {
                Quote quote;
                quote.wrapForDecode(data, MessageHeader::encodedLength(),
                                    hdr.blockLength(), hdr.version(), length);
                std::cout << "QUOTE | Symbol=" << quote.symbolId()
                          << " Bid=" << (quote.bidPrice() / 1e8)
                          << "x" << (quote.bidQuantity() / 1e8)
                          << " Ask=" << (quote.askPrice() / 1e8)
                          << "x" << (quote.askQuantity() / 1e8)
                          << " Seq=" << quote.sequenceNumber()
                          << std::endl;
                break;
            }
            default:
                std::cerr << "Unknown templateId: " << hdr.templateId() << std::endl;
                break;
        }
    };
}

int main() {
    std::signal(SIGINT, signalHandler);
    std::signal(SIGTERM, signalHandler);

    Context ctx;
    Aeron aeron(ctx);

    std::int64_t subId = aeron.addSubscription(
        std::string(mach_zero::ipc::IPC_CHANNEL),
        mach_zero::ipc::MARKET_DATA_STREAM);

    auto subscription = aeron.findSubscription(subId);
    while (!subscription) { subscription = aeron.findSubscription(subId); }

    std::cout << "Mach-Zero: Market Data Monitor Active. Waiting for data..." << std::endl;

    while (running.load()) {
        int fragmentsRead = subscription->poll(marketDataHandler(), 10);
        if (fragmentsRead == 0) {
            std::this_thread::sleep_for(std::chrono::microseconds(100));
        }
    }

    std::cout << "Mach-Zero: Monitor stopped." << std::endl;
    return 0;
}
