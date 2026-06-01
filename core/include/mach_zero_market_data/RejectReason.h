/* Generated SBE (Simple Binary Encoding) message codec */
#ifndef _MACH_ZERO_MARKET_DATA_REJECTREASON_CXX_H_
#define _MACH_ZERO_MARKET_DATA_REJECTREASON_CXX_H_

#if !defined(__STDC_LIMIT_MACROS)
#  define __STDC_LIMIT_MACROS 1
#endif

#include <cstdint>
#include <iomanip>
#include <limits>
#include <ostream>
#include <stdexcept>
#include <sstream>
#include <string>

#define SBE_NULLVALUE_INT8 (std::numeric_limits<std::int8_t>::min)()
#define SBE_NULLVALUE_INT16 (std::numeric_limits<std::int16_t>::min)()
#define SBE_NULLVALUE_INT32 (std::numeric_limits<std::int32_t>::min)()
#define SBE_NULLVALUE_INT64 (std::numeric_limits<std::int64_t>::min)()
#define SBE_NULLVALUE_UINT8 (std::numeric_limits<std::uint8_t>::max)()
#define SBE_NULLVALUE_UINT16 (std::numeric_limits<std::uint16_t>::max)()
#define SBE_NULLVALUE_UINT32 (std::numeric_limits<std::uint32_t>::max)()
#define SBE_NULLVALUE_UINT64 (std::numeric_limits<std::uint64_t>::max)()

namespace mach_zero {
namespace market_data {

class RejectReason
{
public:
    enum Value
    {
        None = static_cast<std::uint8_t>(0),
        PriceBand = static_cast<std::uint8_t>(1),
        PositionLimit = static_cast<std::uint8_t>(2),
        OrderRate = static_cast<std::uint8_t>(3),
        MaxOrderSize = static_cast<std::uint8_t>(4),
        KillSwitch = static_cast<std::uint8_t>(5),
        InsufficientFunds = static_cast<std::uint8_t>(6),
        InvalidSymbol = static_cast<std::uint8_t>(7),
        ExchangeReject = static_cast<std::uint8_t>(8),
        InvalidTenant = static_cast<std::uint8_t>(9),
        NULL_VALUE = static_cast<std::uint8_t>(255)
    };

    static RejectReason::Value get(const std::uint8_t value)
    {
        switch (value)
        {
            case static_cast<std::uint8_t>(0): return None;
            case static_cast<std::uint8_t>(1): return PriceBand;
            case static_cast<std::uint8_t>(2): return PositionLimit;
            case static_cast<std::uint8_t>(3): return OrderRate;
            case static_cast<std::uint8_t>(4): return MaxOrderSize;
            case static_cast<std::uint8_t>(5): return KillSwitch;
            case static_cast<std::uint8_t>(6): return InsufficientFunds;
            case static_cast<std::uint8_t>(7): return InvalidSymbol;
            case static_cast<std::uint8_t>(8): return ExchangeReject;
            case static_cast<std::uint8_t>(9): return InvalidTenant;
            case static_cast<std::uint8_t>(255): return NULL_VALUE;
        }

        throw std::runtime_error("unknown value for enum RejectReason [E103]");
    }

    static const char *c_str(const RejectReason::Value value)
    {
        switch (value)
        {
            case None: return "None";
            case PriceBand: return "PriceBand";
            case PositionLimit: return "PositionLimit";
            case OrderRate: return "OrderRate";
            case MaxOrderSize: return "MaxOrderSize";
            case KillSwitch: return "KillSwitch";
            case InsufficientFunds: return "InsufficientFunds";
            case InvalidSymbol: return "InvalidSymbol";
            case ExchangeReject: return "ExchangeReject";
            case InvalidTenant: return "InvalidTenant";
            case NULL_VALUE: return "NULL_VALUE";
        }

        throw std::runtime_error("unknown value for enum RejectReason [E103]:");
    }

    template<typename CharT, typename Traits>
    friend std::basic_ostream<CharT, Traits> & operator << (
        std::basic_ostream<CharT, Traits> &os, RejectReason::Value m)
    {
        return os << RejectReason::c_str(m);
    }
};

}
}

#endif
