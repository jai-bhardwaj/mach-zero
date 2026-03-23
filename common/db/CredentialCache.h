#pragma once

#include <string>
#include <unordered_map>
#include <mutex>
#include <thread>
#include <atomic>
#include <chrono>
#include <vector>
#include <optional>
#include <functional>
#include <cstring>
#include <libpq-fe.h>
#include <common/logger/Logger.h>

// OpenSSL for AES-256-GCM decryption (matches Node.js crypto module)
#include <openssl/evp.h>
#include <openssl/err.h>

namespace mach_zero::db {

// Decrypted credentials for a single trading account
struct AccountCredentials {
    std::string accountId;
    std::string name;
    std::string venue;        // "Binance", "NSE"
    bool        testnet;
    std::string baseUrl;
    std::string apiKey;
    std::string secretKey;
};

// Thread-safe in-memory cache of trading account credentials.
// Loads from PostgreSQL on startup, refreshes in a background thread.
//
// Encryption format (matches apps/web/lib/crypto.ts):
//   Base64( IV[12] + AuthTag[16] + Ciphertext )
//   Algorithm: AES-256-GCM
class CredentialCache {
public:
    // connStr: PostgreSQL connection string (Aiven / Neon / local)
    // encryptionKeyHex: 64-char hex string (32 bytes) — same as CREDENTIAL_ENCRYPTION_KEY
    // refreshIntervalSec: how often to reload from DB (default 30s)
    CredentialCache(const std::string& connStr,
                    const std::string& encryptionKeyHex,
                    int refreshIntervalSec = 30)
        : connStr_(connStr), refreshIntervalSec_(refreshIntervalSec)
    {
        if (encryptionKeyHex.size() != 64) {
            MZ_ERROR("CREDENTIAL_ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
            return;
        }
        hexToBytes(encryptionKeyHex, encryptionKey_, 32);
    }

    ~CredentialCache() { stop(); }

    // Load credentials from DB and start background refresh thread.
    // Returns true if initial load succeeded.
    bool start() {
        if (!loadFromDb()) {
            MZ_ERROR("CredentialCache: initial load failed");
            return false;
        }
        running_.store(true);
        refreshThread_ = std::thread([this]() { refreshLoop(); });
        MZ_INFO(("CredentialCache: started (refresh every " + std::to_string(refreshIntervalSec_) + "s)").c_str());
        return true;
    }

    void stop() {
        running_.store(false);
        if (refreshThread_.joinable()) {
            refreshThread_.join();
        }
    }

    // Look up credentials by account ID. Returns nullopt if not found.
    std::optional<AccountCredentials> get(const std::string& accountId) const {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = cache_.find(accountId);
        if (it == cache_.end()) return std::nullopt;
        return it->second;
    }

    // Get all credentials for a given venue (e.g., "Binance")
    std::vector<AccountCredentials> getByVenue(const std::string& venue) const {
        std::lock_guard<std::mutex> lock(mutex_);
        std::vector<AccountCredentials> result;
        for (const auto& [id, cred] : cache_) {
            if (cred.venue == venue) result.push_back(cred);
        }
        return result;
    }

    // Number of cached accounts
    size_t size() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return cache_.size();
    }

private:
    bool loadFromDb() {
        PGconn* conn = PQconnectdb(connStr_.c_str());
        if (PQstatus(conn) != CONNECTION_OK) {
            MZ_ERROR((std::string("CredentialCache: DB connect failed: ") + PQerrorMessage(conn)).c_str());
            PQfinish(conn);
            return false;
        }

        // Query active trading accounts with their config (contains encrypted credentials)
        const char* query = R"(
            SELECT id, name, venue, testnet, config
            FROM "TradingAccount"
            WHERE active = true
        )";

        PGresult* res = PQexec(conn, query);
        if (PQresultStatus(res) != PGRES_TUPLES_OK) {
            MZ_ERROR((std::string("CredentialCache: query failed: ") + PQresultErrorMessage(res)).c_str());
            PQclear(res);
            PQfinish(conn);
            return false;
        }

        std::unordered_map<std::string, AccountCredentials> newCache;
        int rows = PQntuples(res);

        for (int i = 0; i < rows; i++) {
            std::string id     = PQgetvalue(res, i, 0);
            std::string name   = PQgetvalue(res, i, 1);
            std::string venue  = PQgetvalue(res, i, 2);
            bool testnet       = (std::string(PQgetvalue(res, i, 3)) == "t");
            std::string config = PQgetisnull(res, i, 4) ? "" : PQgetvalue(res, i, 4);

            if (config.empty()) continue;

            // Parse the config JSON to extract encryptedCredentials
            // Config format: {"encryptedCredentials": "<base64>", ...}
            auto encrypted = extractJsonString(config, "encryptedCredentials");
            if (encrypted.empty()) {
                // Try legacy unencrypted format: {"credentials": {"apiKey": "...", "secretKey": "..."}}
                auto apiKey = extractNestedJsonString(config, "credentials", "apiKey");
                auto secretKey = extractNestedJsonString(config, "credentials", "secretKey");
                if (!apiKey.empty()) {
                    AccountCredentials cred;
                    cred.accountId = id;
                    cred.name = name;
                    cred.venue = venue;
                    cred.testnet = testnet;
                    cred.baseUrl = testnet ? "https://testnet.binance.vision" : "https://api.binance.com";
                    cred.apiKey = apiKey;
                    cred.secretKey = secretKey;
                    newCache[id] = std::move(cred);
                }
                continue;
            }

            // Decrypt AES-256-GCM
            auto decrypted = decryptAesGcm(encrypted);
            if (decrypted.empty()) {
                MZ_ERROR(("CredentialCache: failed to decrypt credentials for account " + id).c_str());
                continue;
            }

            // Parse decrypted JSON: {"apiKey": "...", "secretKey": "..."}
            auto apiKey = extractJsonString(decrypted, "apiKey");
            auto secretKey = extractJsonString(decrypted, "secretKey");

            if (apiKey.empty()) continue;

            AccountCredentials cred;
            cred.accountId = id;
            cred.name = name;
            cred.venue = venue;
            cred.testnet = testnet;
            cred.baseUrl = testnet ? "https://testnet.binance.vision" : "https://api.binance.com";
            cred.apiKey = apiKey;
            cred.secretKey = secretKey;
            newCache[id] = std::move(cred);
        }

        PQclear(res);
        PQfinish(conn);

        // Swap the cache atomically
        {
            std::lock_guard<std::mutex> lock(mutex_);
            cache_ = std::move(newCache);
        }

        MZ_INFO(("CredentialCache: loaded " + std::to_string(cache_.size()) + " active account(s)").c_str());
        return true;
    }

    void refreshLoop() {
        while (running_.load()) {
            for (int i = 0; i < refreshIntervalSec_ * 10 && running_.load(); ++i) {
                std::this_thread::sleep_for(std::chrono::milliseconds(100));
            }
            if (!running_.load()) break;
            loadFromDb(); // errors are logged internally
        }
    }

    // =========================================================================
    // AES-256-GCM decryption (matches Node.js crypto.ts)
    // Input: base64( IV[12] + AuthTag[16] + Ciphertext )
    // =========================================================================
    std::string decryptAesGcm(const std::string& base64Input) const {
        // Base64 decode
        auto packed = base64Decode(base64Input);
        if (packed.size() < 28) return ""; // 12 (IV) + 16 (tag) minimum

        const unsigned char* iv         = packed.data();
        const unsigned char* authTag    = packed.data() + 12;
        const unsigned char* ciphertext = packed.data() + 28;
        int ciphertextLen = static_cast<int>(packed.size()) - 28;

        if (ciphertextLen <= 0) return "";

        std::vector<unsigned char> plaintext(ciphertextLen + 16);
        int outLen = 0, finalLen = 0;

        EVP_CIPHER_CTX* ctx = EVP_CIPHER_CTX_new();
        if (!ctx) return "";

        bool ok = true;
        ok = ok && EVP_DecryptInit_ex(ctx, EVP_aes_256_gcm(), nullptr, nullptr, nullptr);
        ok = ok && EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN, 12, nullptr);
        ok = ok && EVP_DecryptInit_ex(ctx, nullptr, nullptr, encryptionKey_, iv);
        ok = ok && EVP_DecryptUpdate(ctx, plaintext.data(), &outLen, ciphertext, ciphertextLen);
        ok = ok && EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_TAG, 16,
                                        const_cast<unsigned char*>(authTag));
        ok = ok && (EVP_DecryptFinal_ex(ctx, plaintext.data() + outLen, &finalLen) > 0);

        EVP_CIPHER_CTX_free(ctx);

        if (!ok) return "";
        return std::string(reinterpret_cast<char*>(plaintext.data()), outLen + finalLen);
    }

    // =========================================================================
    // Minimal JSON helpers (no dependency on simdjson for this header-only lib)
    // =========================================================================
    static std::string extractJsonString(const std::string& json, const std::string& key) {
        std::string needle = "\"" + key + "\"";
        auto pos = json.find(needle);
        if (pos == std::string::npos) return "";
        pos = json.find(':', pos + needle.size());
        if (pos == std::string::npos) return "";
        pos = json.find('"', pos + 1);
        if (pos == std::string::npos) return "";
        auto end = json.find('"', pos + 1);
        if (end == std::string::npos) return "";
        return json.substr(pos + 1, end - pos - 1);
    }

    static std::string extractNestedJsonString(const std::string& json,
                                                const std::string& outerKey,
                                                const std::string& innerKey) {
        std::string needle = "\"" + outerKey + "\"";
        auto pos = json.find(needle);
        if (pos == std::string::npos) return "";
        pos = json.find('{', pos);
        if (pos == std::string::npos) return "";
        auto end = json.find('}', pos);
        if (end == std::string::npos) return "";
        std::string inner = json.substr(pos, end - pos + 1);
        return extractJsonString(inner, innerKey);
    }

    // =========================================================================
    // Base64 decode
    // =========================================================================
    static std::vector<unsigned char> base64Decode(const std::string& input) {
        static const unsigned char table[256] = {
            64,64,64,64,64,64,64,64,64,64,64,64,64,64,64,64,
            64,64,64,64,64,64,64,64,64,64,64,64,64,64,64,64,
            64,64,64,64,64,64,64,64,64,64,64,62,64,64,64,63,
            52,53,54,55,56,57,58,59,60,61,64,64,64,65,64,64,
            64, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,
            15,16,17,18,19,20,21,22,23,24,25,64,64,64,64,64,
            64,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,
            41,42,43,44,45,46,47,48,49,50,51,64,64,64,64,64,
            64,64,64,64,64,64,64,64,64,64,64,64,64,64,64,64,
            64,64,64,64,64,64,64,64,64,64,64,64,64,64,64,64,
            64,64,64,64,64,64,64,64,64,64,64,64,64,64,64,64,
            64,64,64,64,64,64,64,64,64,64,64,64,64,64,64,64,
            64,64,64,64,64,64,64,64,64,64,64,64,64,64,64,64,
            64,64,64,64,64,64,64,64,64,64,64,64,64,64,64,64,
            64,64,64,64,64,64,64,64,64,64,64,64,64,64,64,64,
            64,64,64,64,64,64,64,64,64,64,64,64,64,64,64,64
        };

        size_t inLen = input.size();
        while (inLen > 0 && input[inLen - 1] == '=') inLen--;

        size_t outLen = inLen * 3 / 4;
        std::vector<unsigned char> out(outLen);

        size_t j = 0;
        uint32_t buf = 0;
        int bits = 0;
        for (size_t i = 0; i < inLen; i++) {
            unsigned char c = table[static_cast<unsigned char>(input[i])];
            if (c >= 64) continue;
            buf = (buf << 6) | c;
            bits += 6;
            if (bits >= 8) {
                bits -= 8;
                if (j < outLen) out[j++] = static_cast<unsigned char>((buf >> bits) & 0xFF);
            }
        }
        out.resize(j);
        return out;
    }

    // =========================================================================
    // Hex string to bytes
    // =========================================================================
    static void hexToBytes(const std::string& hex, unsigned char* out, size_t outLen) {
        for (size_t i = 0; i < outLen && i * 2 + 1 < hex.size(); i++) {
            auto nibble = [](char c) -> unsigned char {
                if (c >= '0' && c <= '9') return c - '0';
                if (c >= 'a' && c <= 'f') return c - 'a' + 10;
                if (c >= 'A' && c <= 'F') return c - 'A' + 10;
                return 0;
            };
            out[i] = (nibble(hex[i * 2]) << 4) | nibble(hex[i * 2 + 1]);
        }
    }

    std::string connStr_;
    int refreshIntervalSec_;
    unsigned char encryptionKey_[32]{};

    mutable std::mutex mutex_;
    std::unordered_map<std::string, AccountCredentials> cache_;

    std::atomic<bool> running_{false};
    std::thread refreshThread_;
};

} // namespace mach_zero::db
