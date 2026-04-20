#include "BinanceRestClient.h"
#include "OrderTranslator.h"
#include <common/db/CredentialCache.h>
#include <common/ipc/AeronPublisher.h>
#include <common/ipc/AeronSubscriber.h>
#include <common/ipc/ChannelConfig.h>
#include <common/ipc/SchemaValidator.h>
#include <common/logger/Logger.h>
#include <mach_zero_market_data/OrderRequest.h>
#include <mach_zero_market_data/OrderAck.h>
#include <mach_zero_market_data/MessageHeader.h>

#include <iostream>
#include <thread>
#include <atomic>
#include <csignal>
#include <cstdlib>

using namespace mach_zero::market_data;
using namespace mach_zero::gateway;
using namespace mach_zero::ipc;
using namespace mach_zero::db;

static std::atomic<bool> running{true};
void signalHandler(int) { running.store(false); }

int main() {
    std::signal(SIGINT, signalHandler);
    std::signal(SIGTERM, signalHandler);

    MZ_INFO("Mach-Zero: Binance REST Gateway Starting...");

    // =========================================================================
    // Load configuration from environment
    // =========================================================================
    const char* dbUrl = std::getenv("DATABASE_URL");
    const char* encKey = std::getenv("CREDENTIAL_ENCRYPTION_KEY");

    if (!dbUrl || !encKey) {
        MZ_ERROR("Required env vars: DATABASE_URL, CREDENTIAL_ENCRYPTION_KEY");
        return 1;
    }

    // =========================================================================
    // Credential cache — loads from PostgreSQL, refreshes every 30s
    // =========================================================================
    CredentialCache credCache(dbUrl, encKey, 30);
    if (!credCache.start()) {
        MZ_ERROR("Failed to initialize credential cache");
        return 1;
    }

    // =========================================================================
    // REST client — simulated mode unless MACH_ZERO_SIMULATED=0
    // =========================================================================
    const char* simEnv = std::getenv("MACH_ZERO_SIMULATED");
    bool simulated = !simEnv || std::string(simEnv) != "0";
    BinanceRestClient restClient(simulated);
    if (simulated) {
        MZ_WARN("Running in SIMULATED mode (set MACH_ZERO_SIMULATED=0 for real orders)");
    } else {
        MZ_INFO("Running in LIVE mode — orders will hit Binance");
    }

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

    MZ_INFO(("Binance REST gateway running with " + std::to_string(credCache.size()) + " account(s). Press Ctrl+C to stop.").c_str());

    while (running.load()) {
        int frags = subscriber.poll(
            [&](aeron::concurrent::AtomicBuffer& buffer, aeron::util::index_t offset,
                aeron::util::index_t length, aeron::Header& /*header*/) {
                char* data = reinterpret_cast<char*>(buffer.buffer()) + offset;
                MessageHeader hdr(data, length, MessageHeader::sbeSchemaVersion());
                if (!mach_zero::ipc::isValidSchema(hdr)) return;

                if (hdr.templateId() != OrderRequest::sbeTemplateId()) return;

                OrderRequest req;
                req.wrapForDecode(data, MessageHeader::encodedLength(),
                                  hdr.blockLength(), hdr.version(), length);

                // Only handle Binance orders
                if (req.venue() != Venue::Binance) return;

                // Look up credentials for this account
                // accountId is carried in clientOrderId field (first 36 chars = UUID)
                // In production, OrderRequest would have a dedicated accountId field
                std::string accountId(req.clientOrderId(), 36);

                auto maybeCred = credCache.get(accountId);
                if (!maybeCred) {
                    MZ_ERROR(("No credentials found for account: " + accountId).c_str());
                    // Send reject
                    size_t ackLen = OrderTranslator::createAck(
                        req, 0, OrderStatus::Value::Rejected, 0, 0, ackBuf, sizeof(ackBuf));
                    ackPublisher.publish(ackBuf, ackLen);
                    return;
                }

                // Build per-request credentials
                OrderCredentials creds{
                    maybeCred->apiKey,
                    maybeCred->secretKey,
                    maybeCred->baseUrl
                };

                auto params = OrderTranslator::toRestParams(req, symbolName(req.symbolId()));
                auto resp = restClient.placeOrder(creds, params.symbol, params.side,
                                                  params.type, params.quantity, params.price);

                if (resp.success()) {
                    size_t ackLen = OrderTranslator::createAck(
                        req, 0, OrderStatus::Value::New, 0, 0, ackBuf, sizeof(ackBuf));
                    ackPublisher.publish(ackBuf, ackLen);
                    MZ_INFO(("Order placed for account " + maybeCred->name + " on " + maybeCred->baseUrl).c_str());
                } else {
                    MZ_ERROR(("Order placement failed for account " + maybeCred->name).c_str());
                }
            });

        if (frags == 0) {
            std::this_thread::sleep_for(std::chrono::milliseconds(1));
        }
    }

    credCache.stop();
    MZ_INFO("Mach-Zero: Binance REST Gateway Stopped.");
    return 0;
}
