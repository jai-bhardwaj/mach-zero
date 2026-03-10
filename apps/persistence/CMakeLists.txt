add_executable(persistence_service main.cpp)
target_link_libraries(persistence_service PRIVATE mach_zero_common)
target_include_directories(persistence_service PRIVATE
    ${CMAKE_SOURCE_DIR}/core/src
)
