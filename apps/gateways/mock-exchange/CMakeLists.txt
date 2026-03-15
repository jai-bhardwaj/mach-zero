add_executable(mock_exchange_gateway main.cpp)
target_link_libraries(mock_exchange_gateway PRIVATE mach_zero_common)
target_include_directories(mock_exchange_gateway PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
)
