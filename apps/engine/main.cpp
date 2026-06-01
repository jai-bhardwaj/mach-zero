#include <strategy/StrategyEngine.h>
#include <strategy/SimpleSpreadStrategy.h>
#include <strategy/MomentumStrategy.h>
#include <strategy/StrategyLoader.h>
#include <risk/RiskEngine.h>
#include <risk/TenantLimits.h>
#include <common/ipc/AeronPublisher.h>
#include <common/ipc/AeronSubscriber.h>
#include <common/ipc/ChannelConfig.h>
#include <common/ipc/SchemaValidator.h>
#include <common/logger/Logger.h>
#include <mach_zero_market_data/MessageHeader.h>
#include <mach_zero_market_data/OrderRequest.h>
#include <mach_zero_market_data/RiskCommand.h>
#include <mach_zero_market_data/RiskCommandType.h>

#include <cstdlib>
#include <sys/stat.h>

#include <iostream>
#include <thread>
#include <chrono>
#include <atomic>
#include <csignal>
#include <memory>
#include <vector>

using namespace mach_zero::strategy;
using namespace mach_zero::risk;
using namespace mach_zero::ipc;
using namespace mach_zero::market_data;

static std::atomic<bool> running{true};
void signalHandler(int) { running.store(false); }

int main() {
    std::signal(SIGINT, signalHandler);
    std::signal(SIGTERM, signalHandler);

    MZ_INFO("Mach-Zero: Strategy Engine Starting...");

    // Load per-tenant risk limits from JSON file.
    // Fail-fast on missing/malformed — running without config is not a
    // valid state for a financial system.
    TenantLimitsRegistry limitsRegistry;
    const char* limitsPath = std::getenv("TENANT_LIMITS_FILE");
    if (!limitsPath || *limitsPath == '\0') {
        std::cerr << "FATAL: TENANT_LIMITS_FILE env var not set. "
                     "Engine requires per-tenant limits configuration." << std::endl;
        return 2;
    }
    int loaded = limitsRegistry.loadFromFile(limitsPath);
    if (loaded < 0) {
        return 2;  // Loader already printed FATAL diagnostic
    }
    MZ_INFO(("Loaded tenant limits for " + std::to_string(loaded) + " tenants").c_str());

    // Strategy engine
    StrategyEngine engine;

    // Load user-defined strategies from config (written from the dashboard/DB).
    // Fail-fast: a bad strategy config is not a valid state for a financial system.
    const char* stratPath = std::getenv("STRATEGIES_FILE");
    if (stratPath && *stratPath) {
        std::vector<std::shared_ptr<Strategy>> loadedStrategies;
        if (!loadStrategiesFromFile(stratPath, loadedStrategies)) {
            return 2;  // loader already printed a FATAL diagnostic
        }
        for (auto& s : loadedStrategies) engine.addStrategy(s);
        MZ_INFO(("Loaded " + std::to_string(loadedStrategies.size()) +
                 " strategies from STRATEGIES_FILE").c_str());
    }

    // Track STRATEGIES_FILE mtime so the main loop can hot-reload when the sync
    // script (apps/web/scripts/sync-strategies.ts) rewrites it — no restart
    // needed. 0 = not present / not tracked.
    auto fileMtime = [](const char* path) -> long {
        struct stat st{};
        return (path && *path && ::stat(path, &st) == 0)
                   ? static_cast<long>(st.st_mtime)
                   : 0;
    };
    long lastStratMtime = fileMtime(stratPath);

    // Demo strategies are gated behind RUN_DEMO_STRATEGIES (default off):
    // they were previously always-on and flooded the risk gate with orders
    // against an empty book (~10/s, tens of millions of rejects over weeks).
    if (std::getenv("RUN_DEMO_STRATEGIES")) {
        SimpleSpreadStrategy::Config spreadCfg;
        spreadCfg.symbolId = 1; // BTCUSDT
        spreadCfg.spreadOffset = 5000000000LL; // 50.0 offset
        spreadCfg.orderQuantity = 10000000ULL; // 0.1 BTC
        engine.addStrategy(std::make_shared<SimpleSpreadStrategy>(spreadCfg));

        MomentumStrategy::Config momCfg;
        momCfg.symbolId = 2; // ETHUSDT
        momCfg.windowSize = 20;
        momCfg.threshold = 500000000LL; // 5.0
        momCfg.orderQuantity = 100000000ULL; // 1.0 ETH
        engine.addStrategy(std::make_shared<MomentumStrategy>(momCfg));
        MZ_INFO("Demo strategies enabled (RUN_DEMO_STRATEGIES set)");
    }

    // Risk engine
    RiskEngine riskEngine;
    riskEngine.setLimitsRegistry(&limitsRegistry);

    // Single shared Aeron instance for this service
    auto aeron = createAeronInstance();

    // Aeron connections — all share the same instance
    AeronSubscriber mdSubscriber(aeron, std::string(IPC_CHANNEL), MARKET_DATA_STREAM,
                                 AeronSubscriber::IdleStrategy::Sleeping);
    AeronSubscriber ackSubscriber(aeron, std::string(IPC_CHANNEL), ACK_STREAM,
                                  AeronSubscriber::IdleStrategy::Sleeping);
    // RISK stream subscriber: applies received kill-switch commands
    // published by risk-monitor's HTTP handler. Fixes the pre-existing
    // bug where HTTP toggles on risk-monitor did not reach strategy-engine.
    AeronSubscriber riskSubscriber(aeron, std::string(IPC_CHANNEL), RISK_STREAM,
                                   AeronSubscriber::IdleStrategy::Sleeping);
    AeronPublisher orderPublisher(aeron, std::string(IPC_CHANNEL), ORDER_STREAM);
    AeronPublisher validatedPublisher(aeron, std::string(IPC_CHANNEL), VALIDATED_ORDER_STREAM);
    AeronPublisher rejectPublisher(aeron, std::string(IPC_CHANNEL), ACK_STREAM);

    char rejectBuf[128];

    std::cerr << "Strategy engine running. Press Ctrl+C to stop." << std::endl;

    // The OrderRate check counts orders per (tenant, symbol) and must have its
    // window rolled, or maxOrderRatePerSec degenerates into a lifetime cap that
    // permanently halts a tenant once it hits the limit. Roll every second.
    auto lastRateReset = std::chrono::steady_clock::now();

    while (running.load()) {
        // Roll the per-second order-rate window.
        auto nowTs = std::chrono::steady_clock::now();
        if (nowTs - lastRateReset >= std::chrono::seconds(1)) {
            riskEngine.resetRateCounters();
            lastRateReset = nowTs;

            // Hot-reload STRATEGIES_FILE when it changes (checked once/sec, on
            // this single processing thread between polls — no concurrency
            // hazard). A failed reload (bad/partial file) is logged and IGNORED:
            // the engine keeps running its existing strategies. The sync script
            // writes atomically (temp+rename) so we never observe a torn file.
            if (stratPath && *stratPath) {
                long m = fileMtime(stratPath);
                if (m != 0 && m != lastStratMtime) {
                    std::vector<std::shared_ptr<Strategy>> reloaded;
                    if (loadStrategiesFromFile(stratPath, reloaded)) {
                        engine.replaceStrategies(std::move(reloaded));
                        lastStratMtime = m;
                        MZ_INFO(("Hot-reloaded STRATEGIES_FILE: now running " +
                                 std::to_string(engine.strategyCount()) +
                                 " strategies").c_str());
                    } else {
                        // Keep lastStratMtime unchanged so we retry on the next
                        // change rather than spamming; keep existing strategies.
                        MZ_WARN("STRATEGIES_FILE changed but failed to parse — "
                                "keeping existing strategies");
                    }
                }
            }
        }

        // Poll market data
        mdSubscriber.poll(
            [&](aeron::concurrent::AtomicBuffer& buffer, aeron::util::index_t offset,
                aeron::util::index_t length, aeron::Header& /*header*/) {
                const char* data = reinterpret_cast<const char*>(buffer.buffer()) + offset;

                // Schema validation before any decode. Stale producers with
                // schemaId<2 would otherwise silently decode garbage.
                MessageHeader hdr(const_cast<char*>(data), length, MessageHeader::sbeSchemaVersion());
                if (!mach_zero::ipc::isValidSchema(hdr)) return;

                engine.processMarketData(data, length);

                // Update risk engine last prices
                if (hdr.templateId() == Trade::sbeTemplateId()) {
                    Trade trade;
                    trade.wrapForDecode(const_cast<char*>(data), MessageHeader::encodedLength(),
                                        hdr.blockLength(), hdr.version(), length);
                    riskEngine.onTrade(trade);
                }
            }, 100);

        // Poll RISK stream — apply kill-switch commands to our local state
        riskSubscriber.poll(
            [&](aeron::concurrent::AtomicBuffer& buffer, aeron::util::index_t offset,
                aeron::util::index_t length, aeron::Header& /*header*/) {
                const char* data = reinterpret_cast<const char*>(buffer.buffer()) + offset;
                MessageHeader hdr(const_cast<char*>(data), length, MessageHeader::sbeSchemaVersion());
                if (!mach_zero::ipc::isValidSchema(hdr)) return;
                if (hdr.templateId() != RiskCommand::sbeTemplateId()) return;

                RiskCommand cmd;
                cmd.wrapForDecode(const_cast<char*>(data), MessageHeader::encodedLength(),
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

        // Poll acks
        ackSubscriber.poll(
            [&](aeron::concurrent::AtomicBuffer& buffer, aeron::util::index_t offset,
                aeron::util::index_t length, aeron::Header& /*header*/) {
                const char* data = reinterpret_cast<const char*>(buffer.buffer()) + offset;
                engine.processAck(data, length);
            }, 10);

        // Process strategy outputs through risk engine
        auto orders = engine.drainOrders();
        for (const auto& orderBuf : orders) {
            MessageHeader hdr(const_cast<char*>(orderBuf.data()), orderBuf.size(),
                              MessageHeader::sbeSchemaVersion());
            if (!mach_zero::ipc::isValidSchema(hdr)) continue;
            OrderRequest req;
            req.wrapForDecode(const_cast<char*>(orderBuf.data()), MessageHeader::encodedLength(),
                              hdr.blockLength(), hdr.version(), orderBuf.size());

            auto result = riskEngine.validate(req);
            if (result.passed) {
                validatedPublisher.publish(orderBuf.data(), orderBuf.size());
            } else {
                size_t rejectLen = riskEngine.createReject(req, result.reason,
                                                           rejectBuf, sizeof(rejectBuf));
                rejectPublisher.publish(rejectBuf, rejectLen);
            }
        }

        if (orders.empty()) {
            std::this_thread::sleep_for(std::chrono::microseconds(100));
        }
    }

    MZ_INFO("Mach-Zero: Strategy Engine Stopped.");
    return 0;
}
