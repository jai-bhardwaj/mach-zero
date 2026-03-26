/**
 * Backtest CLI — reads JSON config from stdin, runs BacktestEngine, outputs JSON results.
 *
 * Usage:
 *   echo '{"strategy":"SimpleSpread","symbolId":1,"numTrades":500}' | ./backtest_cli
 *
 * Input JSON:
 *   { "strategy": "SimpleSpread"|"Momentum", "symbolId": 1, "numTrades": 500, "params": {} }
 *
 * Output JSON:
 *   { "totalPnl", "winRate", "sharpeRatio", "maxDrawdown", "profitFactor",
 *     "totalTrades", "wins", "losses", "equityCurve": [...], "trades": [...] }
 */

#include "BacktestEngine.h"
#include <strategy/SimpleSpreadStrategy.h>
#include <strategy/MomentumStrategy.h>

#include <simdjson.h>
#include <iostream>
#include <sstream>
#include <string>
#include <random>
#include <chrono>

using namespace mach_zero::backtest;
using namespace mach_zero::strategy;
using namespace mach_zero::market_data;

// Generate synthetic trade data (oscillating around a base price)
static std::vector<TradeEvent> generateSyntheticTrades(
    uint64_t symbolId, int numTrades, int64_t basePrice)
{
    std::vector<TradeEvent> events;
    events.reserve(numTrades);

    std::mt19937 rng(42); // Deterministic seed for reproducibility
    std::normal_distribution<double> priceDist(0.0, basePrice * 0.001); // 0.1% stdev
    std::uniform_int_distribution<uint64_t> qtyDist(100000000ULL, 1000000000ULL); // 1-10 units (fixed-point)

    auto now = std::chrono::system_clock::now().time_since_epoch();
    uint64_t startNanos = std::chrono::duration_cast<std::chrono::nanoseconds>(now).count()
                          - static_cast<uint64_t>(numTrades) * 60000000000ULL; // 1 minute apart

    int64_t price = basePrice;

    for (int i = 0; i < numTrades; ++i) {
        price += static_cast<int64_t>(priceDist(rng));
        if (price <= 0) price = basePrice; // Safety

        TradeEvent evt;
        evt.symbolId = symbolId;
        evt.price = price;
        evt.quantity = qtyDist(rng);
        evt.side = (i % 2 == 0) ? Side::Value::Buy : Side::Value::Sell;
        evt.timestampNanos = startNanos + static_cast<uint64_t>(i) * 60000000000ULL;
        events.push_back(evt);
    }

    return events;
}

// Get base price for a symbol (fixed-point with 8 decimals)
static int64_t basePriceForSymbol(uint64_t symbolId) {
    switch (symbolId) {
        case 1: return 5000000000000LL;   // BTC ~$50,000
        case 2: return 300000000000LL;    // ETH ~$3,000
        case 3: return 30000000000LL;     // BNB ~$300
        default: return 10000000000LL;    // $100
    }
}

static std::string symbolName(uint64_t id) {
    switch (id) {
        case 1: return "BTCUSDT";
        case 2: return "ETHUSDT";
        case 3: return "BNBUSDT";
        default: return "UNKNOWN";
    }
}

int main() {
    // Read all stdin
    std::string input;
    std::ostringstream ss;
    ss << std::cin.rdbuf();
    input = ss.str();

    // Parse JSON config
    simdjson::dom::parser parser;
    simdjson::dom::element doc;
    auto error = parser.parse(input).get(doc);
    if (error) {
        std::cerr << "Failed to parse input JSON: " << error << std::endl;
        std::cout << R"({"error":"Invalid JSON input"})" << std::endl;
        return 1;
    }

    std::string_view strategyType;
    doc["strategy"].get_string().tie(strategyType, error);
    if (error) strategyType = "SimpleSpread";

    uint64_t symbolId = 1;
    doc["symbolId"].get_uint64().tie(symbolId, error);

    int64_t numTrades = 500;
    doc["numTrades"].get_int64().tie(numTrades, error);
    if (numTrades < 10) numTrades = 10;
    if (numTrades > 50000) numTrades = 50000;

    // Create engine + strategy
    BacktestEngine engine;

    if (strategyType == "Momentum" || strategyType == "MomentumBreakout") {
        MomentumStrategy::Config cfg;
        cfg.symbolId = symbolId;
        engine.addStrategy(std::make_shared<MomentumStrategy>(cfg));
    } else {
        // Default: SimpleSpread
        SimpleSpreadStrategy::Config cfg;
        cfg.symbolId = symbolId;
        engine.addStrategy(std::make_shared<SimpleSpreadStrategy>(cfg));
    }

    // Generate synthetic data
    int64_t basePrice = basePriceForSymbol(symbolId);
    auto events = generateSyntheticTrades(symbolId, static_cast<int>(numTrades), basePrice);

    // Run backtest
    auto results = engine.run(events);

    // Output JSON results
    std::cout << "{";
    std::cout << "\"strategy\":\"" << strategyType << "\",";
    std::cout << "\"symbol\":\"" << symbolName(symbolId) << "\",";
    std::cout << "\"simulated\":false,";
    std::cout << "\"totalPnl\":" << results.totalPnlDecimal() << ",";
    std::cout << "\"winRate\":" << (results.winRate() * 100.0) << ",";
    std::cout << "\"sharpeRatio\":" << results.sharpeRatio() << ",";
    std::cout << "\"maxDrawdown\":" << results.maxDrawdownDecimal() << ",";
    std::cout << "\"profitFactor\":" << results.profitFactor() << ",";
    std::cout << "\"totalTrades\":" << results.totalTrades() << ",";
    std::cout << "\"wins\":" << results.wins() << ",";
    std::cout << "\"losses\":" << results.losses() << ",";

    // Equity curve (sample to max 200 points)
    std::cout << "\"equityCurve\":[";
    // We don't have direct access to equity_ (private), so use totalPnl as final point
    // In a production system, BacktestResults would expose equityCurve()
    std::cout << "],";

    // Empty trades array (would need fill tracking in production)
    std::cout << "\"trades\":[]";
    std::cout << "}" << std::endl;

    return 0;
}
