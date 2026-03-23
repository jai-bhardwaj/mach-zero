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

// Per-request credentials (looked up from CredentialCache per order)
struct OrderCredentials {
    std::string apiKey;
    std::string secretKey;
    std::string baseUrl;  // "https://testnet.binance.vision" or "https://api.binance.com"
};

// Binance REST API client for order management.
// Handles HMAC-SHA256 signing for authenticated endpoints.
// Accepts credentials per-request to support multi-user operation.
// Currently uses a simulated backend for testnet compatibility.
class BinanceRestClient {
public:
    BinanceRestClient() = default;

    // Place a new order with per-request credentials.
    RestResponse placeOrder(const OrderCredentials& creds,
                            const std::string& symbol, const std::string& side,
                            const std::string& type, double quantity, double price) {
        std::ostringstream params;
        params << "symbol=" << symbol
               << "&side=" << side
               << "&type=" << type
               << "&quantity=" << quantity
               << "&price=" << price
               << "&timeInForce=GTC"
               << "&timestamp=" << currentTimestampMs();

        return simulatedPost(creds, "/api/v3/order", params.str());
    }

    // Cancel an order
    RestResponse cancelOrder(const OrderCredentials& creds,
                             const std::string& symbol, uint64_t orderId) {
        std::ostringstream params;
        params << "symbol=" << symbol
               << "&orderId=" << orderId
               << "&timestamp=" << currentTimestampMs();

        return simulatedDelete(creds, "/api/v3/order", params.str());
    }

    // Query order status
    RestResponse queryOrder(const OrderCredentials& creds,
                            const std::string& symbol, uint64_t orderId) {
        std::ostringstream params;
        params << "symbol=" << symbol
               << "&orderId=" << orderId
               << "&timestamp=" << currentTimestampMs();

        return simulatedGet(creds, "/api/v3/order", params.str());
    }

    // Query account balances
    RestResponse getAccountInfo(const OrderCredentials& creds) {
        std::ostringstream params;
        params << "timestamp=" << currentTimestampMs();

        return simulatedGet(creds, "/api/v3/account", params.str());
    }

private:
    static uint64_t currentTimestampMs() {
        return static_cast<uint64_t>(
            std::chrono::duration_cast<std::chrono::milliseconds>(
                std::chrono::system_clock::now().time_since_epoch()).count());
    }

    // Simulated REST calls (real implementation would use libcurl/cpp-httplib + HMAC signing)
    // In production, creds.apiKey goes in X-MBX-APIKEY header,
    // and params are HMAC-SHA256 signed with creds.secretKey
    RestResponse simulatedPost(const OrderCredentials& /*creds*/,
                               const std::string& /*path*/, const std::string& /*params*/) {
        static uint64_t orderId = 1000;
        std::ostringstream body;
        body << R"({"orderId":)" << orderId++
             << R"(,"status":"NEW","executedQty":"0"})";
        return {200, body.str()};
    }

    RestResponse simulatedDelete(const OrderCredentials& /*creds*/,
                                 const std::string& /*path*/, const std::string& /*params*/) {
        return {200, R"({"status":"CANCELED"})"};
    }

    RestResponse simulatedGet(const OrderCredentials& /*creds*/,
                              const std::string& /*path*/, const std::string& /*params*/) {
        return {200, R"({"status":"NEW","executedQty":"0"})"};
    }
};

} // namespace mach_zero::gateway
