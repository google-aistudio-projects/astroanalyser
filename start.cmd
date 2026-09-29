@echo off
setlocal enabledelayedexpansion

title Vedic Horoscope System - Dual Service Launcher

echo ===============================================================================
echo        VEDIC HOROSCOPE & EPHEMERIS SYSTEM - DUAL LAUNCHER (start.cmd)
echo ===============================================================================
echo.
echo [1/3] Checking prerequisites...

where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python not found in PATH! Please install Python 3.8+ or add it to PATH.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version') do set PYTHON_VER=%%i
echo   - %PYTHON_VER% detected.

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found in PATH! Please install Node.js 18+ or add it to PATH.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo   - Node.js %NODE_VER% detected.
echo.

echo ===============================================================================
echo [2/3] Starting Python REST API Service (Port 5000)...
echo ===============================================================================
start "Vedic REST API Server (:5000)" cmd /k "echo Starting Python REST API... && python run_api_server.py"

echo   - Process launched in dedicated window: "Vedic REST API Server (:5000)"
echo   - Endpoint:     http://localhost:5000/api/horoscope/query
echo   - Health Check: http://localhost:5000/api/health
echo   - Mode:         Standalone / PostgreSQL Auto-Fallback Active
echo.

echo ===============================================================================
echo [3/3] Starting React / Vite UI Frontend (Port 3000)...
echo ===============================================================================
echo   - Web URL:      http://localhost:3000
echo   - Interactive:  REST API Studio & Ephemeris Visualizer
echo.
echo Press Ctrl+C in this console to stop the UI.
echo ===============================================================================
echo.

npm run dev
