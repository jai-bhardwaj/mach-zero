#pragma once

#include <atomic>
#include <cstring>
#include <functional>
#include <string>
#include <unordered_map>
#include <thread>
#include <unistd.h>
#include <netinet/in.h>
#include <sys/socket.h>

namespace mach_zero::risk {

// Minimal HTTP server for the risk monitor control plane.
// Runs on a background thread, zero external dependencies.
// Supports GET and POST routes with request body parsing.
class HttpServer {
public:
    using StatusHandler = std::function<std::string()>;
    // ToggleHandler receives the raw request body so it can parse
    // per-tenant targets from JSON. Body is empty for older callers.
    using ToggleHandler = std::function<void(bool, const std::string&)>;
    using PostHandler = std::function<std::string(const std::string& body)>;

    HttpServer(int port, StatusHandler statusFn, ToggleHandler toggleFn)
        : port_(port), statusFn_(std::move(statusFn)), toggleFn_(std::move(toggleFn)) {}

    ~HttpServer() { stop(); }

    // Register a POST route handler that receives the request body
    void addPostRoute(const std::string& path, PostHandler handler) {
        postRoutes_[path] = std::move(handler);
    }

    bool start() {
        serverFd_ = socket(AF_INET, SOCK_STREAM, 0);
        if (serverFd_ < 0) return false;

        int opt = 1;
        setsockopt(serverFd_, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

        sockaddr_in addr{};
        addr.sin_family = AF_INET;
        addr.sin_addr.s_addr = INADDR_ANY;
        addr.sin_port = htons(static_cast<uint16_t>(port_));

        if (bind(serverFd_, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) < 0) {
            close(serverFd_);
            serverFd_ = -1;
            return false;
        }

        if (listen(serverFd_, 8) < 0) {
            close(serverFd_);
            serverFd_ = -1;
            return false;
        }

        running_.store(true);
        thread_ = std::thread([this] { acceptLoop(); });
        return true;
    }

    void stop() {
        running_.store(false);
        if (serverFd_ >= 0) {
            shutdown(serverFd_, SHUT_RDWR);
            close(serverFd_);
            serverFd_ = -1;
        }
        if (thread_.joinable()) thread_.join();
    }

private:
    void acceptLoop() {
        while (running_.load()) {
            sockaddr_in clientAddr{};
            socklen_t clientLen = sizeof(clientAddr);
            int clientFd = accept(serverFd_, reinterpret_cast<sockaddr*>(&clientAddr), &clientLen);
            if (clientFd < 0) continue;

            // Set a read timeout so we don't block forever
            timeval tv{};
            tv.tv_sec = 1;
            setsockopt(clientFd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));

            handleClient(clientFd);
            close(clientFd);
        }
    }

    void handleClient(int fd) {
        char buf[4096];
        ssize_t n = recv(fd, buf, sizeof(buf) - 1, 0);
        if (n <= 0) return;
        buf[n] = '\0';

        std::string request(buf, static_cast<size_t>(n));
        std::string method, path;
        parseRequestLine(request, method, path);

        std::string responseBody;
        int statusCode = 200;

        // Built-in routes
        if (method == "GET" && path == "/status") {
            responseBody = statusFn_();
        } else if (method == "POST" && path == "/kill-switch/on") {
            std::string body = extractBody(request);
            toggleFn_(true, body);
            responseBody = R"({"killSwitch":true,"action":"activated"})";
        } else if (method == "POST" && path == "/kill-switch/off") {
            std::string body = extractBody(request);
            toggleFn_(false, body);
            responseBody = R"({"killSwitch":false,"action":"deactivated"})";
        }
        // Dynamic POST routes
        else if (method == "POST") {
            auto it = postRoutes_.find(path);
            if (it != postRoutes_.end()) {
                std::string body = extractBody(request);
                responseBody = it->second(body);
            } else {
                statusCode = 404;
                responseBody = R"({"error":"not found"})";
            }
        } else {
            statusCode = 404;
            responseBody = R"({"error":"not found"})";
        }

        sendResponse(fd, statusCode, responseBody);
    }

    static std::string extractBody(const std::string& request) {
        // Find blank line separating headers from body
        auto pos = request.find("\r\n\r\n");
        if (pos != std::string::npos) {
            return request.substr(pos + 4);
        }
        pos = request.find("\n\n");
        if (pos != std::string::npos) {
            return request.substr(pos + 2);
        }
        return "";
    }

    static void parseRequestLine(const std::string& req, std::string& method, std::string& path) {
        auto spacePos = req.find(' ');
        if (spacePos == std::string::npos) return;
        method = req.substr(0, spacePos);
        auto pathEnd = req.find(' ', spacePos + 1);
        path = req.substr(spacePos + 1, pathEnd - spacePos - 1);
        // Strip query string
        auto qPos = path.find('?');
        if (qPos != std::string::npos) path = path.substr(0, qPos);
    }

    static void sendResponse(int fd, int statusCode, const std::string& body) {
        const char* statusText = statusCode == 200 ? "OK" : "Not Found";
        std::string response =
            "HTTP/1.1 " + std::to_string(statusCode) + " " + statusText + "\r\n"
            "Content-Type: application/json\r\n"
            "Access-Control-Allow-Origin: *\r\n"
            "Content-Length: " + std::to_string(body.size()) + "\r\n"
            "Connection: close\r\n"
            "\r\n" + body;
        send(fd, response.data(), response.size(), 0);
    }

    int port_;
    int serverFd_ = -1;
    std::atomic<bool> running_{false};
    std::thread thread_;
    StatusHandler statusFn_;
    ToggleHandler toggleFn_;
    std::unordered_map<std::string, PostHandler> postRoutes_;
};

} // namespace mach_zero::risk
