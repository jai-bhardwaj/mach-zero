#pragma once

#include <ixwebsocket/IXWebSocket.h>
#include <functional>
#include <string>
#include <atomic>
#include <iostream>

namespace mach_zero::gateway {

// WebSocket client wrapper using ixwebsocket.
// Provides automatic reconnection and a message callback interface.
class WebSocketClient {
public:
    using MessageCallback = std::function<void(const std::string& message)>;

    explicit WebSocketClient(const std::string& url)
        : url_(url), connected_(false)
    {
        ws_.setUrl(url_);

        // Auto-reconnect with exponential backoff
        ws_.enableAutomaticReconnection();
        ws_.setMinWaitBetweenReconnectionRetries(1000);   // 1s min
        ws_.setMaxWaitBetweenReconnectionRetries(30000);   // 30s max

        ws_.setOnMessageCallback([this](const ix::WebSocketMessagePtr& msg) {
            switch (msg->type) {
                case ix::WebSocketMessageType::Message:
                    if (onMessage_) {
                        onMessage_(msg->str);
                    }
                    break;
                case ix::WebSocketMessageType::Open:
                    connected_.store(true, std::memory_order_relaxed);
                    std::cerr << "[WS] Connected to " << url_ << std::endl;
                    break;
                case ix::WebSocketMessageType::Close:
                    connected_.store(false, std::memory_order_relaxed);
                    std::cerr << "[WS] Disconnected (code=" << msg->closeInfo.code
                              << ", reason=" << msg->closeInfo.reason << ")" << std::endl;
                    break;
                case ix::WebSocketMessageType::Error:
                    connected_.store(false, std::memory_order_relaxed);
                    std::cerr << "[WS] Error: " << msg->errorInfo.reason << std::endl;
                    break;
                default:
                    break;
            }
        });
    }

    void setOnMessage(MessageCallback cb) { onMessage_ = std::move(cb); }

    void start() { ws_.start(); }
    void stop()  { ws_.stop(); }

    bool isConnected() const { return connected_.load(std::memory_order_relaxed); }

    ~WebSocketClient() { ws_.stop(); }

private:
    std::string url_;
    ix::WebSocket ws_;
    MessageCallback onMessage_;
    std::atomic<bool> connected_;
};

} // namespace mach_zero::gateway
