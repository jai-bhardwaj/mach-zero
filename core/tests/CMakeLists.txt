# Unit tests using Google Test
add_executable(mach_zero_tests
    test_sbe_roundtrip.cpp
    test_binance_parser.cpp
    test_orderbook.cpp
    test_itch_parser.cpp
    test_risk_engine.cpp
    test_tenant_limits.cpp
    test_tenant_isolation.cpp
    test_strategy_engine.cpp
    test_questdb_sink.cpp
    test_shared_memory.cpp
    test_metrics.cpp
    test_venue_router.cpp
    test_backtest.cpp
    test_latency_regression.cpp
    test_reconnection.cpp
    test_audit_trail.cpp
    test_kill_switch_e2e.cpp
)

target_link_libraries(mach_zero_tests PRIVATE
    mach_zero_common
    simdjson
    GTest::gtest_main
)

target_include_directories(mach_zero_tests PRIVATE
    ${CMAKE_SOURCE_DIR}/apps/gateways/binance-ws
    ${CMAKE_SOURCE_DIR}/apps/gateways/nse-oe-sbe
    ${CMAKE_SOURCE_DIR}/core/src
    ${CMAKE_SOURCE_DIR}
)

include(GoogleTest)
gtest_discover_tests(mach_zero_tests)
