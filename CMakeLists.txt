cmake_minimum_required(VERSION 3.18)
project(mach-zero LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 1. CRITICAL: Generates a JSON file that tells Cursor where headers are
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

include(FetchContent)
FetchContent_Declare(aeron
    GIT_REPOSITORY https://github.com/aeron-io/aeron.git
    GIT_TAG        1.44.1
)
FetchContent_MakeAvailable(aeron)


add_executable(binance_gateway apps/gateways/binance-ws/main.cpp)
add_executable(trade_subscriber apps/gateways/binance-ws/subscriber.cpp)

target_link_libraries(binance_gateway PRIVATE aeron_client)
target_link_libraries(trade_subscriber PRIVATE aeron_client)

target_include_directories(binance_gateway PRIVATE 
    # Use the absolute path to your include folder
    ${CMAKE_CURRENT_SOURCE_DIR}/core/include
    # Use the path where Aeron headers are downloaded
    ${aeron_SOURCE_DIR}/aeron-client/src/main/cpp
)
target_include_directories(trade_subscriber PRIVATE 
    ${CMAKE_CURRENT_SOURCE_DIR}/core/include
    ${aeron_SOURCE_DIR}/aeron-client/src/main/cpp
)