#pragma once

#include "Strategy.h"
#include "SimpleSpreadStrategy.h"
#include "MomentumStrategy.h"
#include <simdjson.h>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <memory>
#include <sstream>
#include <string>
#include <string_view>
#include <vector>

namespace mach_zero::strategy {

// Loads trading strategies from a JSON config file so the engine runs
// user-defined strategies (written from the dashboard/DB) instead of
// hardcoded ones.
//
// Fail-closed: any malformed or invalid entry aborts the whole load and
// returns false. A financial engine must not run a partially or incorrectly
// configured strategy set — the caller treats failure as fatal.
//
// Format (version 1):
// {
//   "version": 1,
//   "strategies": [
//     {"type":"simple_spread","tenantId":1,"symbolId":1,
//      "spreadOffset":5000000000,"orderQuantity":10000000,"venue":"Binance"},
//     {"type":"momentum","tenantId":2,"symbolId":2,
//      "windowSize":20,"threshold":500000000,"orderQuantity":100000000}
//   ]
// }
inline bool loadStrategiesFromFile(
    std::string_view path,
    std::vector<std::shared_ptr<Strategy>>& out)
{
    std::ifstream file(path.data());
    if (!file.is_open()) {
        std::cerr << "FATAL: STRATEGIES_FILE not found or unreadable: " << path << std::endl;
        return false;
    }
    std::stringstream ss;
    ss << file.rdbuf();
    std::string text = ss.str();

    simdjson::dom::parser parser;
    auto docResult = parser.parse(text);
    if (docResult.error()) {
        std::cerr << "FATAL: STRATEGIES_FILE malformed JSON: "
                  << simdjson::error_message(docResult.error()) << std::endl;
        return false;
    }
    simdjson::dom::element doc = docResult.value();

    int64_t version = 0;
    if (doc["version"].get(version) || version != 1) {
        std::cerr << "FATAL: STRATEGIES_FILE missing or unsupported version (expected 1)" << std::endl;
        return false;
    }

    simdjson::dom::array arr;
    if (doc["strategies"].get(arr)) {
        std::cerr << "FATAL: STRATEGIES_FILE missing 'strategies' array" << std::endl;
        return false;
    }

    std::vector<std::shared_ptr<Strategy>> loaded;
    size_t idx = 0;
    for (simdjson::dom::element entry : arr) {
        std::string_view type;
        if (entry["type"].get(type)) {
            std::cerr << "FATAL: STRATEGIES_FILE entry " << idx << " missing 'type'" << std::endl;
            return false;
        }

        // Optional strategyId — the engine strategy id used to attribute
        // executions back to a strategy/account/mode on the web side.
        // Absent or non-integer leaves it 0 (unattributed); not fatal.
        int64_t strategyId = 0;
        if (auto e = entry["strategyId"].get(strategyId); e) strategyId = 0;

        int64_t tenantId = 0;
        int64_t symbolId = 0;
        if (entry["tenantId"].get(tenantId) || tenantId <= 0) {
            std::cerr << "FATAL: STRATEGIES_FILE entry " << idx
                      << " missing or invalid 'tenantId' (must be > 0)" << std::endl;
            return false;
        }
        if (entry["symbolId"].get(symbolId) || symbolId <= 0) {
            std::cerr << "FATAL: STRATEGIES_FILE entry " << idx
                      << " missing or invalid 'symbolId' (must be > 0)" << std::endl;
            return false;
        }

        // Venue is optional and defaults to Binance.
        Venue::Value venue = Venue::Binance;
        std::string_view venueStr;
        if (!entry["venue"].get(venueStr)) {
            if (venueStr == "Binance") venue = Venue::Binance;
            else if (venueStr == "NSE") venue = Venue::NSE;
            else {
                std::cerr << "FATAL: STRATEGIES_FILE entry " << idx
                          << " unknown venue: " << venueStr << std::endl;
                return false;
            }
        }

        int64_t i = 0;
        if (type == "simple_spread") {
            SimpleSpreadStrategy::Config cfg;
            cfg.tenantId = static_cast<uint32_t>(tenantId);
            cfg.strategyId = static_cast<uint64_t>(strategyId);
            cfg.symbolId = static_cast<uint64_t>(symbolId);
            cfg.venue = venue;
            if (!entry["spreadOffset"].get(i)) cfg.spreadOffset = i;
            if (!entry["orderQuantity"].get(i)) cfg.orderQuantity = static_cast<uint64_t>(i);
            if (cfg.orderQuantity == 0) {
                std::cerr << "FATAL: STRATEGIES_FILE entry " << idx
                          << " orderQuantity must be > 0" << std::endl;
                return false;
            }
            loaded.push_back(std::make_shared<SimpleSpreadStrategy>(cfg));
        } else if (type == "momentum") {
            MomentumStrategy::Config cfg;
            cfg.tenantId = static_cast<uint32_t>(tenantId);
            cfg.strategyId = static_cast<uint64_t>(strategyId);
            cfg.symbolId = static_cast<uint64_t>(symbolId);
            cfg.venue = venue;
            // windowSize is optional (defaults via Config), but if present it
            // must be valid — fail closed on a bad value rather than silently
            // keeping the default, consistent with every other validated field.
            int64_t windowSize = 0;
            if (!entry["windowSize"].get(windowSize)) {
                if (windowSize <= 0) {
                    std::cerr << "FATAL: STRATEGIES_FILE entry " << idx
                              << " windowSize must be > 0" << std::endl;
                    return false;
                }
                cfg.windowSize = static_cast<size_t>(windowSize);
            }
            if (!entry["threshold"].get(i)) cfg.threshold = i;
            if (!entry["orderQuantity"].get(i)) cfg.orderQuantity = static_cast<uint64_t>(i);
            if (cfg.orderQuantity == 0) {
                std::cerr << "FATAL: STRATEGIES_FILE entry " << idx
                          << " orderQuantity must be > 0" << std::endl;
                return false;
            }
            loaded.push_back(std::make_shared<MomentumStrategy>(cfg));
        } else {
            std::cerr << "FATAL: STRATEGIES_FILE entry " << idx
                      << " unknown strategy type: " << type << std::endl;
            return false;
        }
        ++idx;
    }

    out = std::move(loaded);
    return true;
}

} // namespace mach_zero::strategy
