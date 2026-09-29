#!/usr/bin/env bash
# ===============================================================================
# VEDIC HOROSCOPE & EPHEMERIS SYSTEM - DUAL LAUNCHER (start.sh)
# ===============================================================================

echo "==============================================================================="
echo "       VEDIC HOROSCOPE SYSTEM - DUAL LAUNCHER (start.sh)"
echo "==============================================================================="

# Trap Ctrl+C to kill background processes cleanly
trap cleanup SIGINT SIGTERM

cleanup() {
    echo ""
    echo "[SHUTDOWN] Stopping background REST API server (PID: $API_PID)..."
    kill $API_PID 2>/dev/null
    exit 0
}

echo ""
echo "[1/3] Checking prerequisites..."
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] python3 could not be found! Please install Python 3.8+."
    exit 1
fi
echo "  - $(python3 --version) detected."

if ! command -v npm &> /dev/null; then
    echo "[ERROR] npm could not be found! Please install Node.js."
    exit 1
fi
echo "  - Node $(node --version) / npm $(npm --version) detected."

echo ""
echo "==============================================================================="
echo "[2/3] Starting Python REST API Service on port 5000..."
echo "==============================================================================="
python3 run_api_server.py &
API_PID=$!
echo "  - Process ID:   $API_PID"
echo "  - REST Endpoint: http://localhost:5000/api/horoscope/query"
echo "  - Health Check:  http://localhost:5000/api/health"

sleep 1

echo ""
echo "==============================================================================="
echo "[3/3] Starting React / Vite UI Frontend on port 3000..."
echo "==============================================================================="
echo "  - Web UI:       http://localhost:3000"
echo "  - Press Ctrl+C in this console to stop both services cleanly."
echo "==============================================================================="
echo ""

npm run dev
