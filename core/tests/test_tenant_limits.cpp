#include <gtest/gtest.h>
#include <risk/TenantLimits.h>
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <string>

using namespace mach_zero::risk;

namespace {

// Write s to a temp file and return its path. Caller must unlink it.
std::string writeTmp(const std::string& s) {
    char name[] = "/tmp/mz_tenant_limits_XXXXXX.json";
    int fd = mkstemps(name, 5);
    EXPECT_GE(fd, 0);
    close(fd);
    std::ofstream f(name);
    f << s;
    f.close();
    return name;
}

} // namespace

TEST(TenantLimitsRegistry, LoadFromValidJson) {
    auto path = writeTmp(R"({
        "version": 1,
        "limits": {
            "1": {"maxPositionLimit": 2000000000, "maxOrderRatePerSec": 50, "maxOrderSize": 500000000, "priceBandPct": 0.1},
            "2": {"maxPositionLimit": 3000000000, "maxOrderRatePerSec": 200, "maxOrderSize": 750000000, "priceBandPct": 0.03}
        }
    })");

    TenantLimitsRegistry reg;
    int loaded = reg.loadFromFile(path);
    std::remove(path.c_str());

    ASSERT_EQ(loaded, 2);
    EXPECT_TRUE(reg.isKnown(1));
    EXPECT_TRUE(reg.isKnown(2));
    EXPECT_FALSE(reg.isKnown(3));
    EXPECT_FALSE(reg.isKnown(0));

    auto& l1 = reg.get(1);
    EXPECT_EQ(l1.maxPositionLimit, 2000000000LL);
    EXPECT_EQ(l1.maxOrderRatePerSec, 50u);
    EXPECT_EQ(l1.maxOrderSize, 500000000u);
    EXPECT_DOUBLE_EQ(l1.priceBandPct, 0.1);

    auto& l2 = reg.get(2);
    EXPECT_EQ(l2.maxPositionLimit, 3000000000LL);
}

TEST(TenantLimitsRegistry, FailsOnMissingFile) {
    TenantLimitsRegistry reg;
    int loaded = reg.loadFromFile("/tmp/definitely_does_not_exist_mz_test.json");
    EXPECT_EQ(loaded, -1);
}

TEST(TenantLimitsRegistry, FailsOnMalformedJson) {
    auto path = writeTmp("{ not valid json at all");
    TenantLimitsRegistry reg;
    int loaded = reg.loadFromFile(path);
    std::remove(path.c_str());
    EXPECT_EQ(loaded, -1);
}

TEST(TenantLimitsRegistry, FailsOnNegativeLimit) {
    auto path = writeTmp(R"({
        "version": 1,
        "limits": {
            "1": {"maxPositionLimit": -100, "maxOrderRatePerSec": 50}
        }
    })");
    TenantLimitsRegistry reg;
    int loaded = reg.loadFromFile(path);
    std::remove(path.c_str());
    EXPECT_EQ(loaded, -1);
}

TEST(TenantLimitsRegistry, FailsOnZeroLimit) {
    auto path = writeTmp(R"({
        "version": 1,
        "limits": {
            "1": {"maxOrderSize": 0}
        }
    })");
    TenantLimitsRegistry reg;
    int loaded = reg.loadFromFile(path);
    std::remove(path.c_str());
    EXPECT_EQ(loaded, -1);
}

TEST(TenantLimitsRegistry, RejectsReservedEngineIdZero) {
    auto path = writeTmp(R"({
        "version": 1,
        "limits": {
            "0": {"maxPositionLimit": 100}
        }
    })");
    TenantLimitsRegistry reg;
    int loaded = reg.loadFromFile(path);
    std::remove(path.c_str());
    EXPECT_EQ(loaded, -1);
}

TEST(TenantLimitsRegistry, SkipsOutOfRangeEngineId) {
    // MAX_TENANTS=1024, so engineId=2000 is out of range — skipped, not fatal.
    auto path = writeTmp(R"({
        "version": 1,
        "limits": {
            "1": {"maxPositionLimit": 100},
            "2000": {"maxPositionLimit": 200}
        }
    })");
    TenantLimitsRegistry reg;
    int loaded = reg.loadFromFile(path);
    std::remove(path.c_str());
    EXPECT_EQ(loaded, 1);            // only "1" was loaded
    EXPECT_TRUE(reg.isKnown(1));
    EXPECT_FALSE(reg.isKnown(2000));
}

TEST(TenantLimitsRegistry, SetAndGet) {
    TenantLimitsRegistry reg;
    TenantLimits lim;
    lim.maxPositionLimit = 999;
    lim.maxOrderRatePerSec = 77;
    reg.set(42, lim);

    EXPECT_TRUE(reg.isKnown(42));
    EXPECT_EQ(reg.get(42).maxPositionLimit, 999);
    EXPECT_EQ(reg.get(42).maxOrderRatePerSec, 77u);
}

TEST(TenantLimitsRegistry, SetIgnoresEngineIdZero) {
    TenantLimitsRegistry reg;
    TenantLimits lim;
    lim.maxPositionLimit = 500;
    reg.set(0, lim);
    EXPECT_FALSE(reg.isKnown(0));
}
