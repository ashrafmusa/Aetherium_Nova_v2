#!/usr/bin/env bash
# =============================================================================
# Aetherium Nova — Update script (run on the OCI server)
# Usage: sudo ./update.sh
# =============================================================================
set -euo pipefail

APP_DIR="/opt/aetherium-nova"
SERVICE_NAME="aetherium-nova"

echo "[INFO] Pulling latest code..."
git -C "${APP_DIR}" pull

echo "[INFO] Installing dependencies..."
cd "${APP_DIR}"
npm ci

echo "[INFO] Building..."
npm run build

echo "[INFO] Restarting service..."
systemctl restart "${SERVICE_NAME}"
sleep 3
systemctl status "${SERVICE_NAME}" --no-pager

echo "[INFO] Update complete."
