add_executable(nse_oe_gateway main.cpp)
target_link_libraries(nse_oe_gateway PRIVATE mach_zero_common)
target_include_directories(nse_oe_gateway PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
)
