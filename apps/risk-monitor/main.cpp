#include <common/ipc/AeronPublisher.h>
#include <common/ipc/AeronSubscriber.h>
#include <common/ipc/ChannelConfig.h>
#include <common/ipc/SchemaValidator.h>
#include <common/ipc/SharedMemoryWriter.h>
#include <common/metrics/Metrics.h>
#include <common/metrics/MetricsExporter.h>
#include <common/logger/Logger.h>
#include <risk/RiskEngine.h>
#include <risk/HttpServer.h>
#include <risk/SquareOffManager.h>
#include <mach_zero_market_data/MessageHeader.h>
#include <mach_zero_market_data/Trade.h>
#include <mach_zero_market_data/OrderRequest.h>
#include <mach_zero_market_data/OrderAck.h>
#include <mach_zero_market_data/OrderReject.h>
#include <mach_zero_market_data/Venue.h>

#include <iostream>
#include <iomanip>
#include <sstream>
#include <atomic>
#include <csignal>
#include <thread>
#include <chrono>

using namespace mach_zero::ipc;
using namespace mach_zero::metrics;
using namespace mach_zero::market_data;
using namespace mach_zero::risk;

static std::atomic<bool> running{true};
void signalHandler(int) { running.store(false); }

// System-wide metrics
static Counter tradesReceived("mz_trades_total", "Total trades received");
static Counter ordersValidated("mz_orders_validated_total", "Orders passing risk checks");
static Counter ordersRejected("mz_orders_rejected_total", "Orders rejected by risk");
static Gauge activeSymbols("mz_active_symbols", "Symbols with recent activity");
static LatencyHistogram riskLatency("mz_risk_latency_ns", "Risk validation latency");

// Simple JSON value extractor (no library dependency)
static std::string jsonGetString(const std::string& json, const std::string& key) {
    std::string search = "\"" + key + "\"";
    auto pos = json.find(search);
    if (pos == std::string::npos) return "";

    // Find the colon after the key
    pos = json.find(':', pos + search.size());
    if (pos == std::string::npos) return "";
    ++pos;

    // Skip whitespace
    while (pos < json.size() && (json[pos] == ' ' || json[pos] == '\t')) ++pos;

    // Check if value is a string (quoted) or number/bool
    if (pos < json.size() && json[pos] == '"') {
        auto endPos = json.find('"', pos + 1);
        if (endPos == std::string::npos) return "";
        return json.substr(pos + 1, endPos - pos - 1);
    }

    // Number or boolean — read until comma, brace, or end
    auto endPos = json.find_first_of(",}] \t\r\n", pos);
    if (endPos == std::string::npos) endPos = json.size();
    return json.substr(pos, endPos - pos);
}

void printDashboard(const SharedMemoryWriter& shm) {
    // Clear screen
    std::cout << "\033[2J\033[H";
    std::cout << "=== Mach-Zero Risk Monitor ===" << std::endl;
    std::cout << std::endl;

    // Metrics summary
    std::cout << "Trades: " << tradesReceived.value()
              << "  Orders OK: " << ordersValidated.value()
              << "  Rejected: " << ordersRejected.value()
              << "  Active Symbols: " << activeSymbols.value()
              << std::endl;

    if (riskLatency.count() > 0) {
        std::cout << "Risk Latency - Mean: " << std::fixed << std::setprecision(1)
                  << riskLatency.mean() << "ns"
                  << "  Min: " << riskLatency.minVal() << "ns"
                  << "  Max: " << riskLatency.maxVal() << "ns"
                  << std::endl;
    }

    std::cout << std::endl;
    std::cout << std::setw(6) << "SYM"
              << std::setw(16) << "LAST PRICE"
              << std::setw(16) << "BID"
              << std::setw(16) << "ASK"
              << std::setw(12) << "POSITION"
              << std::setw(12) << "ORDERS"
              << std::setw(12) << "FILLS"
              << std::endl;
    std::cout << std::string(90, '-') << std::endl;

    int displayed = 0;
    for (uint64_t i = 0; i < SHM_MAX_SYMBOLS && displayed < 20; ++i) {
        const auto* sym = shm.getSymbol(i);
        if (!sym || sym->lastPrice == 0) continue;

        auto formatPrice = [](int64_t p) -> std::string {
            double d = static_cast<double>(p) / 100000000.0;
            std::ostringstream oss;
            oss << std::fixed << std::setprecision(2) << d;
            return oss.str();
        };

        std::cout << std::setw(6) << i
                  << std::setw(16) << formatPrice(sym->lastPrice)
                  << std::setw(16) << formatPrice(sym->bidPrice)
                  << std::setw(16) << formatPrice(sym->askPrice)
                  << std::setw(12) << sym->position
                  << std::setw(12) << sym->orderCount
                  << std::setw(12) << sym->fillCount
                  << std::endl;
        ++displayed;
    }

    if (displayed == 0) {
        std::cout << "  (no active symbols)" << std::endl;
    }

    std::cout << std::endl;
    std::cout << "Press Ctrl+C to stop." << std::endl;
}

int main() {
    std::signal(SIGINT, signalHandler);
    std::signal(SIGTERM, signalHandler);

    MZ_INFO("Mach-Zero: Risk Monitor Starting...");

    // Risk engine with kill switch
    RiskEngine riskEngine;

    // Shared memory for live state
    SharedMemoryWriter shm("/mach_zero_state");
    if (!shm.open()) {
        MZ_ERROR("Failed to open shared memory");
        return 1;
    }

    // Single shared Aeron instance for this service
    auto aeron = createAeronInstance();

    // Publisher for square-off orders — publishes to VALIDATED_ORDER_STREAM
    // (bypasses risk checks since we're closing positions)
    AeronPublisher squareOffPub(aeron, std::string(IPC_CHANNEL), VALIDATED_ORDER_STREAM);

    // Square-off manager
    SquareOffManager squareOffMgr(shm, squareOffPub);

    // HTTP control plane (port from env or default 8080)
    const char* portEnv = std::getenv("HTTP_PORT");
    int httpPort = portEnv ? std::atoi(portEnv) : 8080;

    HttpServer http(httpPort,
        // GET /status handler
        [&]() -> std::string {
            std::ostringstream oss;
            oss << R"({"killSwitch":)" << (riskEngine.killSwitch().isActive() ? "true" : "false")
                << R"(,"trades":)" << tradesReceived.value()
                << R"(,"ordersValidated":)" << ordersValidated.value()
                << R"(,"ordersRejected":)" << ordersRejected.value()
                << R"(,"activeSymbols":)" << activeSymbols.value()
                << "}";
            return oss.str();
        },
        // POST /kill-switch/{on|off} handler
        [&](bool activate) {
            if (activate) {
                riskEngine.killSwitch().activate();
                MZ_INFO("Kill switch ACTIVATED via HTTP");
            } else {
                riskEngine.killSwitch().deactivate();
                MZ_INFO("Kill switch deactivated via HTTP");
            }
        }
    );

    // Register POST /square-off route
    http.addPostRoute("/square-off", [&](const std::string& body) -> std::string {
        // Parse JSON body: {"symbolId": 123, "venue": 1} or {"all": true, "venue": 1}
        std::string allStr = jsonGetString(body, "all");
        std::string symbolStr = jsonGetString(body, "symbolId");
        std::string venueStr = jsonGetString(body, "venue");

        // Default to Binance if no venue specified
        Venue::Value venue = Venue::Value::Binance;
        if (!venueStr.empty()) {
            int v = std::atoi(venueStr.c_str());
            venue = static_cast<Venue::Value>(v);
        }

        SquareOffResult result;
        if (allStr == "true") {
            MZ_INFO("Square-off ALL positions via HTTP");
            result = squareOffMgr.squareOffAll(venue);
        } else if (!symbolStr.empty()) {
            uint64_t symbolId = std::stoull(symbolStr);
            std::string msg = "Square-off symbol " + symbolStr + " via HTTP";
            MZ_INFO(msg.c_str());
            result = squareOffMgr.squareOffSymbol(symbolId, venue);
        } else {
            return R"({"success":false,"error":"Missing 'symbolId' or 'all' parameter"})";
        }

        return result.toJson();
    });

    if (http.start()) {
        MZ_INFO("HTTP control plane listening on port 8080");
    } else {
        MZ_ERROR("Failed to start HTTP server on port 8080");
    }

    // Aeron subscriptions — all share the same instance
    AeronSubscriber mdSub(aeron, std::string(IPC_CHANNEL), MARKET_DATA_STREAM,
                          AeronSubscriber::IdleStrategy::Sleeping);
    AeronSubscriber orderSub(aeron, std::string(IPC_CHANNEL), VALIDATED_ORDER_STREAM,
                             AeronSubscriber::IdleStrategy::Sleeping);
    AeronSubscriber ackSub(aeron, std::string(IPC_CHANNEL), ACK_STREAM,
                           AeronSubscriber::IdleStrategy::Sleeping);

    auto lastRefresh = std::chrono::steady_clock::now();

    while (running.load()) {
        // Poll market data
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
                    shm.updateMarketData(trade.symbolId(), trade.price(), trade.quantity(),
                                         0, 0, 0, 0, trade.timestamp());
                    tradesReceived.increment();
                }
            }, 100);

        // Poll orders
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
                    shm.incrementOrderCount(req.symbolId());
                    ordersValidated.increment();
                }
            }, 50);

        // Poll acks/rejects
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
                    shm.incrementFillCount(ack.symbolId());
                } else if (hdr.templateId() == OrderReject::sbeTemplateId()) {
                    ordersRejected.increment();
                }
            }, 50);

        // Refresh dashboard every 500ms
        auto now = std::chrono::steady_clock::now();
        if (now - lastRefresh > std::chrono::milliseconds(500)) {
            printDashboard(shm);
            lastRefresh = now;
        }

        std::this_thread::sleep_for(std::chrono::milliseconds(1));
    }

    http.stop();
    shm.unlink();
    MZ_INFO("Mach-Zero: Risk Monitor Stopped.");
    return 0;
}
