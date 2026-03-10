#include <transport/QuestDBSink.h>
#include <common/ipc/AeronSubscriber.h>
#include <common/ipc/ChannelConfig.h>
#include <common/logger/Logger.h>
#include <mach_zero_market_data/MessageHeader.h>
#include <mach_zero_market_data/Trade.h>
#include <mach_zero_market_data/Quote.h>
#include <mach_zero_market_data/OrderRequest.h>
#include <mach_zero_market_data/OrderAck.h>
#include <mach_zero_market_data/OrderReject.h>

#include <iostream>
#include <atomic>
#include <csignal>
#include <thread>

using namespace mach_zero::transport;
using namespace mach_zero::ipc;
using namespace mach_zero::market_data;

static std::atomic<bool> running{true};
void signalHandler(int) { running.store(false); }

int main() {
    std::signal(SIGINT, signalHandler);
    std::signal(SIGTERM, signalHandler);

    MZ_INFO("Mach-Zero: Persistence Service Starting...");

    // QuestDB connection
    QuestDBSink::Config dbCfg;
    dbCfg.host = "127.0.0.1";
    dbCfg.port = 9009;
    dbCfg.batchSize = 50;

    QuestDBSink sink(dbCfg);
    bool dbConnected = sink.connect();
    if (dbConnected) {
        MZ_INFO("Connected to QuestDB");
    } else {
        MZ_WARN("Could not connect to QuestDB -- will buffer and retry");
    }

    // Subscribe to all relevant streams
    AeronSubscriber mdSub(std::string(IPC_CHANNEL), MARKET_DATA_STREAM,
                          AeronSubscriber::IdleStrategy::Sleeping);
    AeronSubscriber orderSub(std::string(IPC_CHANNEL), VALIDATED_ORDER_STREAM,
                             AeronSubscriber::IdleStrategy::Sleeping);
    AeronSubscriber ackSub(std::string(IPC_CHANNEL), ACK_STREAM,
                           AeronSubscriber::IdleStrategy::Sleeping);

    uint64_t tradeCount = 0, orderCount = 0, ackCount = 0;

    std::cerr << "Persistence service running. Press Ctrl+C to stop." << std::endl;

    while (running.load()) {
        // Market data -> trades table
        mdSub.poll(
            [&](aeron::concurrent::AtomicBuffer& buffer, aeron::util::index_t offset,
                aeron::util::index_t length, aeron::Header& /*header*/) {
                char* data = reinterpret_cast<char*>(buffer.buffer()) + offset;
                MessageHeader hdr(data, length, MessageHeader::sbeSchemaVersion());

                if (hdr.templateId() == Trade::sbeTemplateId()) {
                    Trade trade;
                    trade.wrapForDecode(data, MessageHeader::encodedLength(),
                                        hdr.blockLength(), hdr.version(), length);
                    sink.writeTrade(trade.symbolId(), trade.price(), trade.quantity(),
                                   trade.sideRaw(), trade.venueRaw(), trade.timestamp());
                    ++tradeCount;
                }
            }, 100);

        // Validated orders -> orders table
        orderSub.poll(
            [&](aeron::concurrent::AtomicBuffer& buffer, aeron::util::index_t offset,
                aeron::util::index_t length, aeron::Header& /*header*/) {
                char* data = reinterpret_cast<char*>(buffer.buffer()) + offset;
                MessageHeader hdr(data, length, MessageHeader::sbeSchemaVersion());

                if (hdr.templateId() == OrderRequest::sbeTemplateId()) {
                    OrderRequest req;
                    req.wrapForDecode(data, MessageHeader::encodedLength(),
                                      hdr.blockLength(), hdr.version(), length);
                    sink.writeOrder(req.orderId(), req.symbolId(), req.sideRaw(),
                                   req.price(), req.quantity(), "validated", req.timestamp());
                    ++orderCount;
                }
            }, 50);

        // Acks -> orders table (update status)
        ackSub.poll(
            [&](aeron::concurrent::AtomicBuffer& buffer, aeron::util::index_t offset,
                aeron::util::index_t length, aeron::Header& /*header*/) {
                char* data = reinterpret_cast<char*>(buffer.buffer()) + offset;
                MessageHeader hdr(data, length, MessageHeader::sbeSchemaVersion());

                if (hdr.templateId() == OrderAck::sbeTemplateId()) {
                    OrderAck ack;
                    ack.wrapForDecode(data, MessageHeader::encodedLength(),
                                      hdr.blockLength(), hdr.version(), length);
                    sink.writeOrder(ack.orderId(), ack.symbolId(), 0,
                                   ack.avgPrice(), ack.filledQuantity(), "acked", ack.timestamp());
                    ++ackCount;
                } else if (hdr.templateId() == OrderReject::sbeTemplateId()) {
                    OrderReject reject;
                    reject.wrapForDecode(data, MessageHeader::encodedLength(),
                                          hdr.blockLength(), hdr.version(), length);
                    sink.writeRiskEvent(reject.orderId(), 0, "rejected", reject.timestamp());
                }
            }, 50);

        // Periodic flush
        static uint64_t loopCount = 0;
        if (++loopCount % 10000 == 0 && sink.pendingLines() > 0) {
            sink.flush();
        }

        if (tradeCount == 0 && orderCount == 0 && ackCount == 0) {
            std::this_thread::sleep_for(std::chrono::milliseconds(1));
        }
    }

    sink.flush();
    MZ_INFO("Persistence service stopped");
    MZ_INFO("Mach-Zero: Persistence Service Stopped.");
    return 0;
}
