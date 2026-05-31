#include <gtest/gtest.h>
#include <strategy/StrategyLoader.h>
#include <filesystem>
#include <fstream>
#include <memory>
#include <string>
#include <vector>

using namespace mach_zero::strategy;

namespace {
std::string writeTemp(const std::string& name, const std::string& content) {
    auto path = (std::filesystem::temp_directory_path() / name).string();
    std::ofstream f(path);
    f << content;
    f.close();
    return path;
}
}  // namespace

TEST(StrategyLoader, LoadsValidConfig) {
    std::string path = writeTemp("mz_strat_valid.json", R"({
        "version": 1,
        "strategies": [
            {"type":"simple_spread","tenantId":1,"symbolId":1,"spreadOffset":5000000000,"orderQuantity":10000000},
            {"type":"momentum","tenantId":2,"symbolId":2,"windowSize":30,"threshold":500000000,"orderQuantity":100000000,"venue":"Binance"}
        ]
    })");
    std::vector<std::shared_ptr<Strategy>> out;
    ASSERT_TRUE(loadStrategiesFromFile(path, out));
    ASSERT_EQ(out.size(), 2u);
    EXPECT_EQ(out[0]->tenantId(), 1u);
    EXPECT_EQ(out[1]->tenantId(), 2u);
    std::filesystem::remove(path);
}

TEST(StrategyLoader, EmptyStrategiesIsValid) {
    std::string path = writeTemp("mz_strat_empty.json", R"({"version":1,"strategies":[]})");
    std::vector<std::shared_ptr<Strategy>> out;
    ASSERT_TRUE(loadStrategiesFromFile(path, out));
    EXPECT_TRUE(out.empty());
    std::filesystem::remove(path);
}

TEST(StrategyLoader, RejectsUnknownType) {
    std::string path = writeTemp("mz_strat_badtype.json",
        R"({"version":1,"strategies":[{"type":"bogus","tenantId":1,"symbolId":1,"orderQuantity":1000}]})");
    std::vector<std::shared_ptr<Strategy>> out;
    EXPECT_FALSE(loadStrategiesFromFile(path, out));
    std::filesystem::remove(path);
}

TEST(StrategyLoader, RejectsMissingVersion) {
    std::string path = writeTemp("mz_strat_nover.json", R"({"strategies":[]})");
    std::vector<std::shared_ptr<Strategy>> out;
    EXPECT_FALSE(loadStrategiesFromFile(path, out));
    std::filesystem::remove(path);
}

TEST(StrategyLoader, RejectsZeroTenant) {
    std::string path = writeTemp("mz_strat_tenant0.json",
        R"({"version":1,"strategies":[{"type":"simple_spread","tenantId":0,"symbolId":1,"orderQuantity":1000}]})");
    std::vector<std::shared_ptr<Strategy>> out;
    EXPECT_FALSE(loadStrategiesFromFile(path, out));
    std::filesystem::remove(path);
}

TEST(StrategyLoader, RejectsZeroOrderQuantity) {
    std::string path = writeTemp("mz_strat_qty0.json",
        R"({"version":1,"strategies":[{"type":"simple_spread","tenantId":1,"symbolId":1,"orderQuantity":0}]})");
    std::vector<std::shared_ptr<Strategy>> out;
    EXPECT_FALSE(loadStrategiesFromFile(path, out));
    std::filesystem::remove(path);
}

TEST(StrategyLoader, RejectsNonPositiveWindowSize) {
    std::string path = writeTemp("mz_strat_window0.json",
        R"({"version":1,"strategies":[{"type":"momentum","tenantId":1,"symbolId":1,"windowSize":0,"orderQuantity":1000}]})");
    std::vector<std::shared_ptr<Strategy>> out;
    EXPECT_FALSE(loadStrategiesFromFile(path, out));
    std::filesystem::remove(path);
}

TEST(StrategyLoader, MomentumWindowSizeDefaultsWhenAbsent) {
    std::string path = writeTemp("mz_strat_window_absent.json",
        R"({"version":1,"strategies":[{"type":"momentum","tenantId":1,"symbolId":1,"orderQuantity":1000}]})");
    std::vector<std::shared_ptr<Strategy>> out;
    ASSERT_TRUE(loadStrategiesFromFile(path, out));
    ASSERT_EQ(out.size(), 1u);
    std::filesystem::remove(path);
}

TEST(StrategyLoader, MissingFileFails) {
    std::vector<std::shared_ptr<Strategy>> out;
    EXPECT_FALSE(loadStrategiesFromFile("/nonexistent/path/strategies.json", out));
}

TEST(StrategyLoader, MalformedJsonFails) {
    std::string path = writeTemp("mz_strat_malformed.json", R"({"version":1,"strategies":[)");
    std::vector<std::shared_ptr<Strategy>> out;
    EXPECT_FALSE(loadStrategiesFromFile(path, out));
    std::filesystem::remove(path);
}
