add_executable(strategy_engine main.cpp)
target_link_libraries(strategy_engine PRIVATE mach_zero_common)
target_include_directories(strategy_engine PRIVATE
    ${CMAKE_SOURCE_DIR}/core/src
)
