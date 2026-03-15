#!/usr/bin/env bash
# ── Oracle Cloud Always Free VM Setup ────────────────────────────────
# Run this on a fresh Oracle Cloud ARM instance (Ampere A1, 4 cores, 24GB RAM)
# OS: Ubuntu 22.04 (or 24.04) Minimal
#
# Usage: ssh ubuntu@<VM_IP> 'bash -s' < infra/setup-oracle-vm.sh
# ─────────────────────────────────────────────────────────────────────

set -euo pipefail

echo "── [1/6] System update ──"
sudo apt-get update -qq
sudo apt-get upgrade -y -qq

echo "── [2/6] Install Docker ──"
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  echo "Docker installed. You may need to log out and back in for group changes."
fi

echo "── [3/6] Install Docker Compose plugin ──"
if ! docker compose version &>/dev/null; then
  sudo apt-get install -y -qq docker-compose-plugin
fi

echo "── [4/6] Configure shared memory for Aeron IPC ──"
# Aeron needs large /dev/shm — set to 2GB
CURRENT_SHM=$(df /dev/shm | awk 'NR==2{print $2}')
if [ "$CURRENT_SHM" -lt 2000000 ]; then
  echo "Increasing /dev/shm to 2G..."
  echo 'tmpfs /dev/shm tmpfs defaults,size=2G 0 0' | sudo tee -a /etc/fstab
  sudo mount -o remount /dev/shm
fi

echo "── [5/6] Open firewall ports ──"
# Oracle Cloud uses iptables by default on Ubuntu images
# QuestDB and risk-monitor are localhost-only in docker-compose.prod.yml
# Only SSH (22) needs to be open externally
sudo iptables -I INPUT -p tcp --dport 22 -j ACCEPT
sudo iptables-save | sudo tee /etc/iptables/rules.v4 >/dev/null 2>&1 || true

echo "── [6/6] Create project directory ──"
mkdir -p ~/mach-zero
echo ""
echo "========================================"
echo "  VM setup complete!"
echo ""
echo "  Next steps:"
echo "  1. Clone your repo:  cd ~/mach-zero && git clone <repo-url> ."
echo "  2. Build & start:    cd infra && docker compose -f docker-compose.prod.yml up -d --build"
echo "  3. Check status:     docker compose -f docker-compose.prod.yml ps"
echo "  4. View logs:        docker compose -f docker-compose.prod.yml logs -f"
echo "========================================"
