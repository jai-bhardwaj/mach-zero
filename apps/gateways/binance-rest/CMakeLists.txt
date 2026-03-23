find_package(PostgreSQL REQUIRED)
find_package(OpenSSL REQUIRED)
find_package(CURL REQUIRED)

add_executable(binance_rest_gateway main.cpp)
target_link_libraries(binance_rest_gateway PRIVATE
    mach_zero_common
    PostgreSQL::PostgreSQL
    OpenSSL::Crypto
    CURL::libcurl
)
target_include_directories(binance_rest_gateway PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
)
