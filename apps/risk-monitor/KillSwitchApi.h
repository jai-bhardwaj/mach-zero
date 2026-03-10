#pragma once

#include <risk/KillSwitch.h>
#include <common/metrics/Metrics.h>
#include <cstdint>
#include <string>
#include <functional>
#include <sstream>
#include <thread>
#include <atomic>
#include <sys/socket.h>
#include <netinet/in.h>
#include <unistd.h>
#include <cstring>

namespace mach_zero::risk {

// Simple HTTP API for kill switch control.
// Endpoints:
//   GET  /status       - System status JSON
//   POST /kill-switch/on  - Activate kill switch
//   POST /kill-switch/off - Deactivate kill switch
class KillSwitchApi {
public:
    explicit KillSwitchApi(KillSwitch& killSwitch, uint16_t port = 8080)
        : killSwitch_(killSwitch), port_(port) {}

    ~KillSwitchApi() { stop(); }

    bool start() {
        serverFd_ = socket(AF_INET, SOCK_STREAM, 0);
        if (serverFd_ < 0) return false;

        int opt = 1;
        setsockopt(serverFd_, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

        struct sockaddr_in addr;
        std::memset(&addr, 0, sizeof(addr));
        addr.sin_family = AF_INET;
        addr.sin_addr.s_addr = INADDR_ANY;
        addr.sin_port = htons(port_);

        if (bind(serverFd_, (struct sockaddr*)&addr, sizeof(addr)) < 0) {
            close(serverFd_);
            return false;
        }

        if (listen(serverFd_, 5) < 0) {
            close(serverFd_);
            return false;
        }

        running_ = true;
        thread_ = std::thread([this]() { acceptLoop(); });
        return true;
    }

    void stop() {
        running_ = false;
        if (serverFd_ >= 0) {
            ::close(serverFd_);
            serverFd_ = -1;
        }
        if (thread_.joinable()) {
            thread_.join();
        }
    }

private:
    void acceptLoop() {
        while (running_) {
            struct sockaddr_in clientAddr;
            socklen_t len = sizeof(clientAddr);
            int clientFd = accept(serverFd_, (struct sockaddr*)&clientAddr, &len);
            if (clientFd < 0) continue;

            handleRequest(clientFd);
            ::close(clientFd);
        }
    }

    void handleRequest(int clientFd) {
        char buf[4096];
        ssize_t n = recv(clientFd, buf, sizeof(buf) - 1, 0);
        if (n <= 0) return;
        buf[n] = '\0';

        std::string request(buf);
        std::string response;

        if (request.find("GET /status") != std::string::npos) {
            response = handleStatus();
        } else if (request.find("POST /kill-switch/on") != std::string::npos) {
            killSwitch_.activate();
            response = jsonResponse(200, R"({"killSwitch":"activated"})");
        } else if (request.find("POST /kill-switch/off") != std::string::npos) {
            killSwitch_.deactivate();
            response = jsonResponse(200, R"({"killSwitch":"deactivated"})");
        } else if (request.find("GET /") != std::string::npos) {
            response = handleDashboard();
        } else {
            response = jsonResponse(404, R"({"error":"not found"})");
        }

        send(clientFd, response.c_str(), response.size(), 0);
    }

    std::string handleStatus() {
        std::ostringstream json;
        json << "{"
             << "\"killSwitch\":" << (killSwitch_.isActive() ? "true" : "false")
             << "}";
        return jsonResponse(200, json.str());
    }

    std::string handleDashboard() {
        std::string html = R"(<!DOCTYPE html>
<html><head><title>Mach-Zero Risk Monitor</title>
<style>
body { font-family: monospace; background: #1a1a2e; color: #eee; padding: 20px; }
.status { font-size: 24px; padding: 20px; border-radius: 8px; margin: 10px 0; }
.safe { background: #16213e; border: 2px solid #0f3460; }
.danger { background: #4a0000; border: 2px solid #ff0000; }
button { padding: 15px 30px; font-size: 18px; cursor: pointer; border: none;
         border-radius: 5px; margin: 5px; font-family: monospace; }
.btn-kill { background: #ff0000; color: white; }
.btn-resume { background: #00aa00; color: white; }
</style></head><body>
<h1>Mach-Zero Risk Monitor</h1>
<div id="status" class="status safe">Loading...</div>
<div>
<button class="btn-kill" onclick="killSwitch('on')">ACTIVATE KILL SWITCH</button>
<button class="btn-resume" onclick="killSwitch('off')">DEACTIVATE</button>
</div>
<script>
async function refresh() {
  const r = await fetch('/status');
  const d = await r.json();
  const el = document.getElementById('status');
  if (d.killSwitch) {
    el.className = 'status danger';
    el.textContent = 'KILL SWITCH ACTIVE - ALL ORDERS HALTED';
  } else {
    el.className = 'status safe';
    el.textContent = 'System Normal - Orders Flowing';
  }
}
async function killSwitch(state) {
  await fetch('/kill-switch/' + state, {method: 'POST'});
  refresh();
}
setInterval(refresh, 1000);
refresh();
</script></body></html>)";
        return httpResponse(200, "text/html", html);
    }

    std::string jsonResponse(int code, const std::string& body) {
        return httpResponse(code, "application/json", body);
    }

    std::string httpResponse(int code, const std::string& contentType, const std::string& body) {
        std::ostringstream oss;
        oss << "HTTP/1.1 " << code << " OK\r\n"
            << "Content-Type: " << contentType << "\r\n"
            << "Content-Length: " << body.size() << "\r\n"
            << "Access-Control-Allow-Origin: *\r\n"
            << "\r\n"
            << body;
        return oss.str();
    }

    KillSwitch& killSwitch_;
    uint16_t port_;
    int serverFd_ = -1;
    std::atomic<bool> running_{false};
    std::thread thread_;
};

} // namespace mach_zero::risk
