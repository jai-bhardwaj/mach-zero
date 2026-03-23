#pragma once

#include <string>
#include <cstdint>
#include <sstream>
#include <chrono>
#include <functional>
#include <cstdlib>

#include <curl/curl.h>
#include <openssl/hmac.h>

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
// Supports both real HTTP (libcurl) and simulated mode.
class BinanceRestClient {
public:
    // simulated=true for paper trading / testing without hitting Binance
    explicit BinanceRestClient(bool simulated = false)
        : simulated_(simulated)
    {
        if (!simulated_) {
            curl_global_init(CURL_GLOBAL_DEFAULT);
        }
    }

    ~BinanceRestClient() {
        if (!simulated_) {
            curl_global_cleanup();
        }
    }

    // Non-copyable (owns curl global state)
    BinanceRestClient(const BinanceRestClient&) = delete;
    BinanceRestClient& operator=(const BinanceRestClient&) = delete;

    bool isSimulated() const { return simulated_; }

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

        if (simulated_) return simulatedPost(params.str());
        return httpRequest(creds, "POST", "/api/v3/order", params.str());
    }

    // Cancel an order
    RestResponse cancelOrder(const OrderCredentials& creds,
                             const std::string& symbol, uint64_t orderId) {
        std::ostringstream params;
        params << "symbol=" << symbol
               << "&orderId=" << orderId
               << "&timestamp=" << currentTimestampMs();

        if (simulated_) return simulatedDelete();
        return httpRequest(creds, "DELETE", "/api/v3/order", params.str());
    }

    // Query order status
    RestResponse queryOrder(const OrderCredentials& creds,
                            const std::string& symbol, uint64_t orderId) {
        std::ostringstream params;
        params << "symbol=" << symbol
               << "&orderId=" << orderId
               << "&timestamp=" << currentTimestampMs();

        if (simulated_) return simulatedGet();
        return httpRequest(creds, "GET", "/api/v3/order", params.str());
    }

    // Query account balances
    RestResponse getAccountInfo(const OrderCredentials& creds) {
        std::ostringstream params;
        params << "timestamp=" << currentTimestampMs();

        if (simulated_) return simulatedGet();
        return httpRequest(creds, "GET", "/api/v3/account", params.str());
    }

private:
    bool simulated_;

    static uint64_t currentTimestampMs() {
        return static_cast<uint64_t>(
            std::chrono::duration_cast<std::chrono::milliseconds>(
                std::chrono::system_clock::now().time_since_epoch()).count());
    }

    // =========================================================================
    // HMAC-SHA256 signing (Binance authentication)
    // =========================================================================
    static std::string hmacSha256(const std::string& key, const std::string& data) {
        unsigned char digest[EVP_MAX_MD_SIZE];
        unsigned int digestLen = 0;

        HMAC(EVP_sha256(),
             key.c_str(), static_cast<int>(key.size()),
             reinterpret_cast<const unsigned char*>(data.c_str()),
             data.size(),
             digest, &digestLen);

        // Convert to hex string
        std::string hex;
        hex.reserve(digestLen * 2);
        static const char hexChars[] = "0123456789abcdef";
        for (unsigned int i = 0; i < digestLen; i++) {
            hex += hexChars[(digest[i] >> 4) & 0xF];
            hex += hexChars[digest[i] & 0xF];
        }
        return hex;
    }

    // =========================================================================
    // Real HTTP via libcurl
    // =========================================================================
    static size_t writeCallback(char* ptr, size_t size, size_t nmemb, void* userdata) {
        auto* response = static_cast<std::string*>(userdata);
        response->append(ptr, size * nmemb);
        return size * nmemb;
    }

    RestResponse httpRequest(const OrderCredentials& creds,
                             const std::string& method,
                             const std::string& path,
                             const std::string& queryParams) {
        RestResponse resp;

        // Sign the query string
        std::string signature = hmacSha256(creds.secretKey, queryParams);
        std::string signedParams = queryParams + "&signature=" + signature;

        // Build URL
        std::string url;
        if (method == "GET" || method == "DELETE") {
            url = creds.baseUrl + path + "?" + signedParams;
        } else {
            url = creds.baseUrl + path;
        }

        CURL* curl = curl_easy_init();
        if (!curl) {
            resp.statusCode = 0;
            resp.body = R"({"error":"Failed to initialize curl"})";
            return resp;
        }

        std::string responseBody;

        curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, writeCallback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &responseBody);
        curl_easy_setopt(curl, CURLOPT_TIMEOUT, 10L);        // 10s timeout
        curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 5L);   // 5s connect timeout

        // API key header
        struct curl_slist* headers = nullptr;
        std::string apiKeyHeader = "X-MBX-APIKEY: " + creds.apiKey;
        headers = curl_slist_append(headers, apiKeyHeader.c_str());
        headers = curl_slist_append(headers, "Content-Type: application/x-www-form-urlencoded");
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

        // Method-specific options
        if (method == "POST") {
            curl_easy_setopt(curl, CURLOPT_POST, 1L);
            curl_easy_setopt(curl, CURLOPT_POSTFIELDS, signedParams.c_str());
        } else if (method == "DELETE") {
            curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "DELETE");
        }
        // GET is default

        CURLcode res = curl_easy_perform(curl);

        if (res != CURLE_OK) {
            resp.statusCode = 0;
            resp.body = std::string(R"({"error":"curl error: )") +
                        curl_easy_strerror(res) + "\"}";
        } else {
            long httpCode = 0;
            curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &httpCode);
            resp.statusCode = static_cast<int>(httpCode);
            resp.body = std::move(responseBody);
        }

        curl_slist_free_all(headers);
        curl_easy_cleanup(curl);

        return resp;
    }

    // =========================================================================
    // Simulated mode (paper trading / testing)
    // =========================================================================
    static RestResponse simulatedPost(const std::string& /*params*/) {
        static uint64_t orderId = 1000;
        std::ostringstream body;
        body << R"({"orderId":)" << orderId++
             << R"(,"status":"NEW","executedQty":"0"})";
        return {200, body.str()};
    }

    static RestResponse simulatedDelete() {
        return {200, R"({"status":"CANCELED"})"};
    }

    static RestResponse simulatedGet() {
        return {200, R"({"status":"NEW","executedQty":"0"})"};
    }
};

} // namespace mach_zero::gateway
