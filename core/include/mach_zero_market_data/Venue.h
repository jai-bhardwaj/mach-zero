/* Generated SBE (Simple Binary Encoding) message codec */
#ifndef _MACH_ZERO_MARKET_DATA_VENUE_CXX_H_
#define _MACH_ZERO_MARKET_DATA_VENUE_CXX_H_

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

class Venue
{
public:
    enum Value
    {
        Unknown = static_cast<std::uint8_t>(0),
        Binance = static_cast<std::uint8_t>(1),
        NSE = static_cast<std::uint8_t>(2),
        BSE = static_cast<std::uint8_t>(3),
        NULL_VALUE = static_cast<std::uint8_t>(255)
    };

    static Venue::Value get(const std::uint8_t value)
    {
        switch (value)
        {
            case static_cast<std::uint8_t>(0): return Unknown;
            case static_cast<std::uint8_t>(1): return Binance;
            case static_cast<std::uint8_t>(2): return NSE;
            case static_cast<std::uint8_t>(3): return BSE;
            case static_cast<std::uint8_t>(255): return NULL_VALUE;
        }

        throw std::runtime_error("unknown value for enum Venue [E103]");
    }

    static const char *c_str(const Venue::Value value)
    {
        switch (value)
        {
            case Unknown: return "Unknown";
            case Binance: return "Binance";
            case NSE: return "NSE";
            case BSE: return "BSE";
            case NULL_VALUE: return "NULL_VALUE";
        }

        throw std::runtime_error("unknown value for enum Venue [E103]:");
    }

    template<typename CharT, typename Traits>
    friend std::basic_ostream<CharT, Traits> & operator << (
        std::basic_ostream<CharT, Traits> &os, Venue::Value m)
    {
        return os << Venue::c_str(m);
    }
};

}
}

#endif
