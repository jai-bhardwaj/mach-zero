add_executable(nse_itch_gateway main.cpp)
target_link_libraries(nse_itch_gateway PRIVATE mach_zero_common)
target_include_directories(nse_itch_gateway PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_SOURCE_DIR}/core/src
)
