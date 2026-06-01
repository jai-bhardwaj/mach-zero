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
#include <mach_zero_market_data/RiskCommand.h>
#include <mach_zero_market_data/RiskCommandType.h>
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
// Transitional-mode counter: fires when the HTTP handler accepts a
// kill-switch POST without an explicit tenantId (legacy single-tenant
// callers). Once this metric shows zero traffic, ACCEPT_LEGACY_KILLSWITCH
// can be turned off.
static Counter legacyKillswitchCount(
    "mz_legacy_killswitch_total",
    "Kill-switch HTTP calls missing tenantId (transitional legacy path)");

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

    // Publisher for kill-switch commands on the RISK stream. Both
    // risk-monitor and strategy-engine subscribe to this stream and apply
    // received commands to their own local KillSwitch state — single
    // source of truth, fixes the pre-existing bug where the HTTP handler
    // only toggled risk-monitor's instance (not the engine's).
    AeronPublisher riskCommandPub(aeron, std::string(IPC_CHANNEL), RISK_STREAM);

    // Legacy-compat rollout flag. When set, kill-switch HTTP calls that
    // omit `tenantId` in the body default to tenantId=0 (global kill),
    // matching pre-v3 single-tenant behavior. Flip off after web is
    // confirmed sending tenantId in every call.
    const bool acceptLegacyKillswitch =
        []{ const char* v = std::getenv("ACCEPT_LEGACY_KILLSWITCH"); return v && *v == '1'; }();

    // Helper: parse tenantId from JSON body. Returns (tenantId, isLegacy).
    auto parseTenantId = [&](const std::string& body) -> std::pair<uint32_t, bool> {
        std::string tenantIdStr = jsonGetString(body, "tenantId");
        if (tenantIdStr.empty()) {
            if (!acceptLegacyKillswitch) {
                return {UINT32_MAX, false};  // signal "missing, not acceptable"
            }
            legacyKillswitchCount.increment();
            return {0, true};   // legacy = global kill
        }
        try {
            auto v = std::stoul(tenantIdStr);
            if (v >= RiskState::MAX_TENANTS) return {UINT32_MAX, false};
            return {static_cast<uint32_t>(v), true};
        } catch (const std::exception&) {
            return {UINT32_MAX, false};
        }
    };

    // Helper: publish a RiskCommand on the RISK stream.
    auto publishRiskCommand = [&](RiskCommandType::Value cmd, uint32_t tenantId) {
        char buf[128];
        RiskCommand msg;
        msg.wrapAndApplyHeader(buf, 0, sizeof(buf));
        uint64_t ts = static_cast<uint64_t>(
            std::chrono::duration_cast<std::chrono::nanoseconds>(
                std::chrono::system_clock::now().time_since_epoch()).count());
        msg.commandType(cmd).timestamp(ts).tenantId(tenantId);
        riskCommandPub.publish(buf, RiskCommand::sbeBlockAndHeaderLength());
    };

    // Square-off manager
    SquareOffManager squareOffMgr(shm, squareOffPub);

    // HTTP control plane (port from env or default 8080)
    const char* portEnv = std::getenv("HTTP_PORT");
    int httpPort = portEnv ? std::atoi(portEnv) : 8080;

    HttpServer http(httpPort,
        // GET /status handler — reports the global kill flag (for legacy
        // single-tenant UIs). Per-tenant status should be a new route.
        [&]() -> std::string {
            std::ostringstream oss;
            oss << R"({"killSwitch":)" << (riskEngine.killSwitch().isActive(0) ? "true" : "false")
                << R"(,"trades":)" << tradesReceived.value()
                << R"(,"ordersValidated":)" << ordersValidated.value()
                << R"(,"ordersRejected":)" << ordersRejected.value()
                << R"(,"activeSymbols":)" << activeSymbols.value()
                << "}";
            return oss.str();
        },
        // POST /kill-switch/{on|off} handler. Publishes a RiskCommand to
        // the RISK stream — both risk-monitor and strategy-engine apply
        // it from there, so state stays consistent across processes.
        [&](bool activate, const std::string& body) {
            auto [tenantId, ok] = parseTenantId(body);
            if (!ok) {
                MZ_WARN("Kill-switch HTTP: tenantId missing/invalid; rejected");
                return;
            }
            auto cmd = activate ? RiskCommandType::KillSwitchOn
                                : RiskCommandType::KillSwitchOff;
            publishRiskCommand(cmd, tenantId);
            std::string msg = std::string("Kill switch ") +
                (activate ? "ACTIVATE" : "deactivate") +
                " published for engineId=" + std::to_string(tenantId);
            MZ_INFO(msg.c_str());
        }
    );

    // Register POST /square-off route
    http.addPostRoute("/square-off", [&](const std::string& body) -> std::string {
        // Parse JSON body:
        //   {"tenantId": N, "symbolId": 123, "venue": 1}
        //   {"tenantId": N, "all": true, "venue": 1}
        // tenantId required. Commit 5 (legacy HTTP compat) will soften this
        // during rollout via ACCEPT_LEGACY_KILLSWITCH flag.
        std::string tenantIdStr = jsonGetString(body, "tenantId");
        std::string allStr = jsonGetString(body, "all");
        std::string symbolStr = jsonGetString(body, "symbolId");
        std::string venueStr = jsonGetString(body, "venue");

        uint32_t tenantId = 0;
        if (!tenantIdStr.empty()) {
            try {
                auto v = std::stoul(tenantIdStr);
                if (v >= RiskState::MAX_TENANTS) {
                    return R"({"success":false,"error":"tenantId out of range"})";
                }
                tenantId = static_cast<uint32_t>(v);
            } catch (const std::exception&) {
                return R"({"success":false,"error":"tenantId malformed"})";
            }
        }
        // tenantId=0 accepted here for back-compat with pre-v3 callers; the
        // SquareOffManager treats non-SHM_TENANT_ID tenants as no-ops.

        // Default to Binance if no venue specified
        Venue::Value venue = Venue::Value::Binance;
        if (!venueStr.empty()) {
            int v = std::atoi(venueStr.c_str());
            venue = static_cast<Venue::Value>(v);
        }

        SquareOffResult result;
        if (allStr == "true") {
            MZ_INFO("Square-off ALL positions via HTTP");
            result = squareOffMgr.squareOffAll(tenantId, venue);
        } else if (!symbolStr.empty()) {
            uint64_t symbolId = std::stoull(symbolStr);
            std::string msg = "Square-off symbol " + symbolStr + " via HTTP";
            MZ_INFO(msg.c_str());
            result = squareOffMgr.squareOffSymbol(tenantId, symbolId, venue);
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
    // RISK stream subscriber: applies received RiskCommand messages to our
    // local KillSwitch. Aeron delivers our own publisher's messages here
    // too, so we don't need to mutate state directly from the HTTP handler.
    AeronSubscriber riskSub(aeron, std::string(IPC_CHANNEL), RISK_STREAM,
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

        // Poll RISK stream — apply kill-switch commands to local state
        riskSub.poll(
            [&](aeron::concurrent::AtomicBuffer& buffer, aeron::util::index_t offset,
                aeron::util::index_t length, aeron::Header& /*header*/) {
                char* data = reinterpret_cast<char*>(buffer.buffer()) + offset;
                MessageHeader hdr(data, length, MessageHeader::sbeSchemaVersion());
                if (!mach_zero::ipc::isValidSchema(hdr)) return;
                if (hdr.templateId() != RiskCommand::sbeTemplateId()) return;

                RiskCommand cmd;
                cmd.wrapForDecode(data, MessageHeader::encodedLength(),
                                  hdr.blockLength(), hdr.version(), length);
                auto tenantId = cmd.tenantId();
                if (tenantId >= RiskState::MAX_TENANTS) return;

                switch (cmd.commandType()) {
                    case RiskCommandType::KillSwitchOn:
                        riskEngine.killSwitch().activate(tenantId);
                        break;
                    case RiskCommandType::KillSwitchOff:
                        riskEngine.killSwitch().deactivate(tenantId);
                        break;
                    default:
                        break;
                }
            }, 10);

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
