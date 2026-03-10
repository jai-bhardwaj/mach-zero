add_executable(binance_rest_gateway main.cpp)
target_link_libraries(binance_rest_gateway PRIVATE mach_zero_common)
target_include_directories(binance_rest_gateway PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
)
