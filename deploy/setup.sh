#!/bin/bash
# Mach-Zero Oracle VM Setup Script
# Run: bash deploy/setup.sh
set -euo pipefail

echo "=== Mach-Zero Deployment Setup ==="

# 1. Install dependencies
echo "[1/6] Installing dependencies..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
  build-essential cmake git curl \
  libcurl4-openssl-dev libpq-dev libssl-dev \
  python3 python3-pip python3-venv \
  docker.io docker-compose-plugin

# 2. Create user and directories
echo "[2/6] Creating mach-zero user..."
sudo useradd -r -m -s /bin/bash mach-zero 2>/dev/null || true
sudo mkdir -p /opt/mach-zero/{bin,logs,bridge}
sudo chown -R mach-zero:mach-zero /opt/mach-zero

# 3. Build C++ binaries
echo "[3/6] Building C++ engine..."
mkdir -p build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build . --parallel $(nproc)
cd ..

# Copy binaries
sudo cp build/apps/engine/mach_zero_engine /opt/mach-zero/bin/
sudo cp build/apps/gateways/binance-rest/binance_rest_gateway /opt/mach-zero/bin/
sudo cp build/apps/risk-monitor/risk_monitor /opt/mach-zero/bin/
sudo cp build/research/backtesting/backtest_cli /opt/mach-zero/bin/

# 4. Setup Python bridge
echo "[4/6] Setting up Python bridge..."
sudo cp -r apps/web/bridge/* /opt/mach-zero/bridge/
sudo -u mach-zero python3 -m pip install --user fastapi uvicorn websockets

# 5. Install systemd services
echo "[5/6] Installing systemd services..."
sudo cp deploy/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload

# 6. Start QuestDB via Docker
echo "[6/6] Starting QuestDB..."
cd deploy
sudo docker compose up -d questdb
cd ..

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Create /opt/mach-zero/.env with DATABASE_URL and CREDENTIAL_ENCRYPTION_KEY"
echo "  2. Start services:"
echo "     sudo systemctl enable --now mach-zero-engine"
echo "     sudo systemctl enable --now mach-zero-gateway"
echo "     sudo systemctl enable --now mach-zero-bridge"
echo "  3. Verify:"
echo "     curl http://localhost:3002/health"
echo "     curl http://localhost:9000/exec?query=select%201"
echo ""
