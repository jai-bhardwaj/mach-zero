cmake_minimum_required(VERSION 3.18)
project(mach-zero LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# =============================================================================
# Release build optimization
# =============================================================================
if(CMAKE_BUILD_TYPE STREQUAL "Release")
    add_compile_options(-O3 -DNDEBUG)

    # Link-time optimization
    include(CheckIPOSupported)
    check_ipo_supported(RESULT LTO_SUPPORTED)
    if(LTO_SUPPORTED)
        set(CMAKE_INTERPROCEDURAL_OPTIMIZATION ON)
    endif()
endif()

# =============================================================================
# Third-party dependencies via FetchContent
# =============================================================================
include(FetchContent)

# Aeron -- ultra-low latency IPC/transport messaging
# Only build the C++ client library, not the C media driver (runs separately via Java)
set(BUILD_AERON_DRIVER OFF CACHE BOOL "" FORCE)
set(BUILD_AERON_ARCHIVE_API OFF CACHE BOOL "" FORCE)
set(AERON_TESTS OFF CACHE BOOL "" FORCE)
set(AERON_BUILD_SAMPLES OFF CACHE BOOL "" FORCE)
set(AERON_BUILD_DOCUMENTATION OFF CACHE BOOL "" FORCE)
FetchContent_Declare(aeron
    GIT_REPOSITORY https://github.com/aeron-io/aeron.git
    GIT_TAG        1.44.1
)

# simdjson -- high-speed JSON parsing for exchange feeds
FetchContent_Declare(simdjson
    GIT_REPOSITORY https://github.com/simdjson/simdjson.git
    GIT_TAG        v3.10.1
)

# ixwebsocket -- WebSocket client with auto-reconnect
FetchContent_Declare(ixwebsocket
    GIT_REPOSITORY https://github.com/machinezone/IXWebSocket.git
    GIT_TAG        v11.4.5
)

# Google Test -- unit testing framework
FetchContent_Declare(googletest
    GIT_REPOSITORY https://github.com/google/googletest.git
    GIT_TAG        v1.14.0
)

FetchContent_MakeAvailable(aeron simdjson ixwebsocket googletest)

# =============================================================================
# Global include paths
# =============================================================================
set(MACH_ZERO_SBE_INCLUDE ${CMAKE_CURRENT_SOURCE_DIR}/core/include)
set(MACH_ZERO_ROOT_INCLUDE ${CMAKE_CURRENT_SOURCE_DIR})
set(AERON_INCLUDE ${aeron_SOURCE_DIR}/aeron-client/src/main/cpp)

# =============================================================================
# Common library (header-only: logger, ipc wrappers, clock)
# =============================================================================
add_library(mach_zero_common INTERFACE)
target_include_directories(mach_zero_common INTERFACE
    ${MACH_ZERO_ROOT_INCLUDE}
    ${MACH_ZERO_SBE_INCLUDE}
    ${AERON_INCLUDE}
)
target_link_libraries(mach_zero_common INTERFACE aeron_client)

# =============================================================================
# Application targets
# =============================================================================
add_subdirectory(apps/gateways/binance-ws)
add_subdirectory(apps/gateways/binance-rest)
add_subdirectory(apps/gateways/nse-md-itch)
add_subdirectory(apps/engine)
add_subdirectory(apps/persistence)
add_subdirectory(apps/risk-monitor)
add_subdirectory(apps/gateways/nse-oe-sbe)

# =============================================================================
# Tests
# =============================================================================
enable_testing()
add_subdirectory(core/tests)
