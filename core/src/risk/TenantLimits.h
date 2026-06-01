#pragma once

#include "RiskState.h"
#include <simdjson.h>
#include <array>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <string_view>

namespace mach_zero::risk {

// Per-tenant risk limits. Defaults are permissive; real tenant rows are
// loaded from JSON at engine startup.
struct TenantLimits {
    int64_t  maxPositionLimit   = 1000000000LL;       // 10.0 in fixed-point
    uint64_t maxOrderRatePerSec = 100;
    uint64_t maxOrderSize       = 10000000000ULL;     // 100.0 in fixed-point
    double   priceBandPct       = 0.05;               // 5%
    bool     configured         = false;              // true = explicitly set in JSON
};

// Registry of per-tenant limits. Flat array indexed by engineId matches
// the RiskState layout for consistent cache behavior.
//
// Fail-closed semantics: `isKnown(engineId)` returns whether the tenant
// has an explicit entry. RiskEngine's entry check uses this to reject
// orders from unmapped tenants with InvalidTenant, preventing a new
// tenant (in Postgres, not yet in limits.json) from placing unlimited
// orders between config regeneration and engine restart.
class TenantLimitsRegistry {
public:
    TenantLimitsRegistry() = default;

    const TenantLimits& get(uint32_t engineId) const {
        if (engineId >= RiskState::MAX_TENANTS) return fallback_;
        return limits_[engineId];
    }

    bool isKnown(uint32_t engineId) const {
        if (engineId == 0 || engineId >= RiskState::MAX_TENANTS) return false;
        return limits_[engineId].configured;
    }

    // For tests and the engine startup loader.
    void set(uint32_t engineId, const TenantLimits& lim) {
        if (engineId == 0 || engineId >= RiskState::MAX_TENANTS) return;
        limits_[engineId] = lim;
        limits_[engineId].configured = true;
    }

    // Load from JSON file. Fail-fast on missing/malformed/negative limits;
    // engine startup treats loader failure as fatal (exit(2) at caller).
    // Returns number of tenants loaded on success, or -1 on any failure.
    int loadFromFile(std::string_view path) {
        std::ifstream f(path.data());
        if (!f.is_open()) {
            std::cerr << "FATAL: TENANT_LIMITS_FILE not found or unreadable: " << path << std::endl;
            return -1;
        }
        std::stringstream buf;
        buf << f.rdbuf();
        std::string text = buf.str();

        simdjson::dom::parser parser;
        auto docResult = parser.parse(text);
        if (docResult.error()) {
            std::cerr << "FATAL: TENANT_LIMITS_FILE malformed JSON: "
                      << simdjson::error_message(docResult.error()) << std::endl;
            return -1;
        }
        simdjson::dom::element doc = docResult.value();

        int64_t version = 0;
        if (!doc["version"].get(version) && version != 1) {
            std::cerr << "FATAL: TENANT_LIMITS_FILE unsupported version " << version << std::endl;
            return -1;
        }

        simdjson::dom::object limitsObj;
        if (doc["limits"].get(limitsObj)) {
            std::cerr << "FATAL: TENANT_LIMITS_FILE missing 'limits' object" << std::endl;
            return -1;
        }

        int loaded = 0;
        for (auto [key, val] : limitsObj) {
            uint32_t engineId = 0;
            try {
                engineId = static_cast<uint32_t>(std::stoul(std::string(key)));
            } catch (const std::exception&) {
                std::cerr << "FATAL: TENANT_LIMITS_FILE non-numeric tenant key: " << key << std::endl;
                return -1;
            }
            if (engineId == 0) {
                std::cerr << "FATAL: TENANT_LIMITS_FILE engineId=0 is reserved" << std::endl;
                return -1;
            }
            if (engineId >= RiskState::MAX_TENANTS) {
                std::cerr << "WARN: TENANT_LIMITS_FILE engineId " << engineId
                          << " out of range (MAX_TENANTS=" << RiskState::MAX_TENANTS
                          << "), skipping" << std::endl;
                continue;
            }

            TenantLimits lim;
            int64_t i = 0;
            double d = 0.0;

            if (!val["maxPositionLimit"].get(i)) {
                if (i <= 0) {
                    std::cerr << "FATAL: tenant " << engineId
                              << " maxPositionLimit must be positive" << std::endl;
                    return -1;
                }
                lim.maxPositionLimit = i;
            }
            if (!val["maxOrderRatePerSec"].get(i)) {
                if (i <= 0) {
                    std::cerr << "FATAL: tenant " << engineId
                              << " maxOrderRatePerSec must be positive" << std::endl;
                    return -1;
                }
                lim.maxOrderRatePerSec = static_cast<uint64_t>(i);
            }
            if (!val["maxOrderSize"].get(i)) {
                if (i <= 0) {
                    std::cerr << "FATAL: tenant " << engineId
                              << " maxOrderSize must be positive" << std::endl;
                    return -1;
                }
                lim.maxOrderSize = static_cast<uint64_t>(i);
            }
            if (!val["priceBandPct"].get(d)) {
                if (d <= 0.0) {
                    std::cerr << "FATAL: tenant " << engineId
                              << " priceBandPct must be positive" << std::endl;
                    return -1;
                }
                lim.priceBandPct = d;
            }

            set(engineId, lim);
            ++loaded;
        }

        return loaded;
    }

private:
    std::array<TenantLimits, RiskState::MAX_TENANTS> limits_{};
    TenantLimits fallback_{};   // returned for out-of-range engineId; never configured
};

} // namespace mach_zero::risk
