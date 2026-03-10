# Binance WebSocket Gateway
add_executable(binance_gateway main.cpp)
target_link_libraries(binance_gateway PRIVATE
    mach_zero_common
    simdjson
    ixwebsocket
)
target_include_directories(binance_gateway PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
)

# Market Data Subscriber / Monitor
add_executable(trade_subscriber subscriber.cpp)
target_link_libraries(trade_subscriber PRIVATE mach_zero_common)
