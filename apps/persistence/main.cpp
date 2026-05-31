#include <transport/QuestDBSink.h>
#include <common/ipc/AeronSubscriber.h>
#include <common/ipc/ChannelConfig.h>
#include <common/ipc/SchemaValidator.h>
#include <common/logger/Logger.h>
#include <mach_zero_market_data/MessageHeader.h>
#include <mach_zero_market_data/Trade.h>
#include <mach_zero_market_data/Quote.h>
#include <mach_zero_market_data/OrderRequest.h>
#include <mach_zero_market_data/OrderAck.h>
#include <mach_zero_market_data/OrderReject.h>
#include <mach_zero_market_data/OrderStatus.h>

#include <iostream>
#include <atomic>
#include <csignal>
#include <thread>
#include <cstdlib>
#include <unordered_map>
#include <cstdint>

using namespace mach_zero::transport;
using namespace mach_zero::ipc;
using namespace mach_zero::market_data;

static std::atomic<bool> running{true};
void signalHandler(int) { running.store(false); }

int main() {
    std::signal(SIGINT, signalHandler);
    std::signal(SIGTERM, signalHandler);

    MZ_INFO("Mach-Zero: Persistence Service Starting...");

    // QuestDB connection — read host/port from env vars (set by docker-compose)
    QuestDBSink::Config dbCfg;
    const char* dbHost = std::getenv("QUESTDB_HOST");
    const char* dbPort = std::getenv("QUESTDB_PORT");
    dbCfg.host = dbHost ? dbHost : "127.0.0.1";
    dbCfg.port = dbPort ? static_cast<uint16_t>(std::atoi(dbPort)) : 9009;
    dbCfg.batchSize = 50;

    std::string dbAddr = "Connecting to QuestDB at " + dbCfg.host + ":" + std::to_string(dbCfg.port);
    MZ_INFO(dbAddr.c_str());

    QuestDBSink sink(dbCfg);
    bool dbConnected = sink.connect();
    if (dbConnected) {
        MZ_INFO("Connected to QuestDB");
    } else {
        MZ_WARN("Could not connect to QuestDB -- will buffer and retry");
    }

    // Single shared Aeron instance for this service
    auto aeron = createAeronInstance();

    // Subscribe to all relevant streams
    AeronSubscriber mdSub(aeron, std::string(IPC_CHANNEL), MARKET_DATA_STREAM,
                          AeronSubscriber::IdleStrategy::Sleeping);
    AeronSubscriber orderSub(aeron, std::string(IPC_CHANNEL), VALIDATED_ORDER_STREAM,
                             AeronSubscriber::IdleStrategy::Sleeping);
    AeronSubscriber ackSub(aeron, std::string(IPC_CHANNEL), ACK_STREAM,
                           AeronSubscriber::IdleStrategy::Sleeping);

    uint64_t tradeCount = 0, orderCount = 0, ackCount = 0;
    uint64_t reconnectCounter = 0;

    // OrderAck carries no `side`, so correlate it from the validated
    // OrderRequest we already see on VALIDATED_ORDER. Bounded to open orders:
    // entries are erased on a terminal ack (Filled/Cancelled/Rejected).
    std::unordered_map<uint64_t, uint8_t> orderSide;

    // Map the SBE OrderStatus to the lowercase status SYMBOL the web expects,
    // instead of collapsing every ack to "acked" (which hid fills behind
    // receipt acks).
    auto ackStatusString = [](uint8_t raw) -> const char* {
        switch (raw) {
            case OrderStatus::Value::New:           return "new";
            case OrderStatus::Value::PartialFill:   return "partial";
            case OrderStatus::Value::Filled:        return "filled";
            case OrderStatus::Value::Cancelled:     return "cancelled";
            case OrderStatus::Value::Rejected:      return "rejected";
            case OrderStatus::Value::PendingNew:    return "pending_new";
            case OrderStatus::Value::PendingCancel: return "pending_cancel";
            default:                                return "acked";
        }
    };

    std::cerr << "Persistence service running. Press Ctrl+C to stop." << std::endl;

    while (running.load()) {
        // Periodic reconnect to QuestDB if disconnected
        if (!sink.isConnected()) {
            if (++reconnectCounter % 50000 == 0) {
                if (sink.connect()) {
                    MZ_INFO("Reconnected to QuestDB");
                }
            }
        }

        // Market data -> trades table
        mdSub.poll(
            [&](aeron::concurrent::AtomicBuffer& buffer, aeron::util::index_t offset,
                aeron::util::index_t length, aeron::Header& /*header*/) {
                char* data = reinterpret_cast<char*>(buffer.buffer()) + offset;
                MessageHeader hdr(data, length, MessageHeader::sbeSchemaVersion());
                if (!mach_zero::ipc::isValidSchema(hdr)) return;

                if (hdr.templateId() == Trade::sbeTemplateId()) {
                    Trade trade;
                    trade.wrapForDecode(data, MessageHeader::encodedLength(),
                                        hdr.blockLength(), hdr.version(), length);
                    // Market data is public; tenant_id=0 marks it as such.
                    sink.writeTrade(0, trade.symbolId(), trade.price(), trade.quantity(),
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
                if (!mach_zero::ipc::isValidSchema(hdr)) return;

                if (hdr.templateId() == OrderRequest::sbeTemplateId()) {
                    OrderRequest req;
                    req.wrapForDecode(data, MessageHeader::encodedLength(),
                                      hdr.blockLength(), hdr.version(), length);
                    sink.writeOrder(req.tenantId(), req.orderId(), req.symbolId(),
                                   req.sideRaw(), req.price(), req.quantity(),
                                   "validated", req.timestamp());
                    orderSide[req.orderId()] = req.sideRaw();
                    ++orderCount;
                }
            }, 50);

        // Acks -> orders table (update status)
        ackSub.poll(
            [&](aeron::concurrent::AtomicBuffer& buffer, aeron::util::index_t offset,
                aeron::util::index_t length, aeron::Header& /*header*/) {
                char* data = reinterpret_cast<char*>(buffer.buffer()) + offset;
                MessageHeader hdr(data, length, MessageHeader::sbeSchemaVersion());
                if (!mach_zero::ipc::isValidSchema(hdr)) return;

                if (hdr.templateId() == OrderAck::sbeTemplateId()) {
                    OrderAck ack;
                    ack.wrapForDecode(data, MessageHeader::encodedLength(),
                                      hdr.blockLength(), hdr.version(), length);
                    uint8_t statusRaw = ack.statusRaw();
                    // Recover the side from the originating validated order.
                    uint8_t side = 0;
                    auto sideIt = orderSide.find(ack.orderId());
                    if (sideIt != orderSide.end()) side = sideIt->second;
                    sink.writeOrder(ack.tenantId(), ack.orderId(), ack.symbolId(), side,
                                   ack.avgPrice(), ack.filledQuantity(),
                                   ackStatusString(statusRaw), ack.timestamp());
                    // Drop correlation state once the order can no longer fill.
                    if (statusRaw == OrderStatus::Value::Filled ||
                        statusRaw == OrderStatus::Value::Cancelled ||
                        statusRaw == OrderStatus::Value::Rejected) {
                        orderSide.erase(ack.orderId());
                    }
                    ++ackCount;
                } else if (hdr.templateId() == OrderReject::sbeTemplateId()) {
                    OrderReject reject;
                    reject.wrapForDecode(data, MessageHeader::encodedLength(),
                                          hdr.blockLength(), hdr.version(), length);
                    sink.writeRiskEvent(reject.tenantId(), reject.orderId(), 0,
                                        "rejected", reject.timestamp());
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
