add_executable(risk_monitor main.cpp)
target_link_libraries(risk_monitor PRIVATE mach_zero_common)
target_include_directories(risk_monitor PRIVATE
    ${CMAKE_SOURCE_DIR}/core/src
)
