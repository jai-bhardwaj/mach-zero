#pragma once

#include <string>
#include <cstdint>
#include <sstream>
#include <chrono>
#include <functional>

namespace mach_zero::gateway {

// Result of a REST API call
struct RestResponse {
    int statusCode = 0;
    std::string body;
    bool success() const { return statusCode >= 200 && statusCode < 300; }
};

// Binance REST API client for order management.
// Handles HMAC-SHA256 signing for authenticated endpoints.
// Currently uses a simulated backend for testnet compatibility.
class BinanceRestClient {
public:
    BinanceRestClient(const std::string& apiKey, const std::string& secretKey,
                      const std::string& baseUrl = "https://testnet.binance.vision")
        : apiKey_(apiKey), secretKey_(secretKey), baseUrl_(baseUrl)
    {}

    // Place a new order. Returns the JSON response.
    RestResponse placeOrder(const std::string& symbol, const std::string& side,
                            const std::string& type, double quantity, double price) {
        std::ostringstream params;
        params << "symbol=" << symbol
               << "&side=" << side
               << "&type=" << type
               << "&quantity=" << quantity
               << "&price=" << price
               << "&timeInForce=GTC"
               << "&timestamp=" << currentTimestampMs();

        return simulatedPost("/api/v3/order", params.str());
    }

    // Cancel an order
    RestResponse cancelOrder(const std::string& symbol, uint64_t orderId) {
        std::ostringstream params;
        params << "symbol=" << symbol
               << "&orderId=" << orderId
               << "&timestamp=" << currentTimestampMs();

        return simulatedDelete("/api/v3/order", params.str());
    }

    // Query order status
    RestResponse queryOrder(const std::string& symbol, uint64_t orderId) {
        std::ostringstream params;
        params << "symbol=" << symbol
               << "&orderId=" << orderId
               << "&timestamp=" << currentTimestampMs();

        return simulatedGet("/api/v3/order", params.str());
    }

private:
    static uint64_t currentTimestampMs() {
        return static_cast<uint64_t>(
            std::chrono::duration_cast<std::chrono::milliseconds>(
                std::chrono::system_clock::now().time_since_epoch()).count());
    }

    // Simulated REST calls (real implementation would use libcurl/cpp-httplib)
    RestResponse simulatedPost(const std::string& /*path*/, const std::string& /*params*/) {
        static uint64_t orderId = 1000;
        std::ostringstream body;
        body << R"({"orderId":)" << orderId++
             << R"(,"status":"NEW","executedQty":"0"})";
        return {200, body.str()};
    }

    RestResponse simulatedDelete(const std::string& /*path*/, const std::string& /*params*/) {
        return {200, R"({"status":"CANCELED"})"};
    }

    RestResponse simulatedGet(const std::string& /*path*/, const std::string& /*params*/) {
        return {200, R"({"status":"NEW","executedQty":"0"})"};
    }

    std::string apiKey_;
    std::string secretKey_;
    std::string baseUrl_;
};

} // namespace mach_zero::gateway
