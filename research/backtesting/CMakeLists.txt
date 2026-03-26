add_executable(backtest_cli main.cpp)
target_link_libraries(backtest_cli PRIVATE
    mach_zero_common
    simdjson
)
target_include_directories(backtest_cli PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_SOURCE_DIR}/core/src
)
