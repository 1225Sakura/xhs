@echo off
REM ========================================
REM XHS System - Simple Start (No Docker)
REM ========================================

echo.
echo ========================================
echo   XHS Publishing System
echo   Simple Start (Development Mode)
echo ========================================
echo.

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js: %NODE_VERSION%
echo.

REM Change to project directory
cd /d E:\xhspro

REM Check if node_modules exists
if not exist "node_modules" (
    echo [WARN] Dependencies not installed
    echo [*] Running npm install...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed
    echo.
)

REM Create logs directory if not exists
if not exist "logs" mkdir logs

REM Check port 3000
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [WARN] Port 3000 is in use
    echo [*] Trying to free port...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
        taskkill /F /PID %%a >nul 2>nul
    )
    timeout /t 2 /nobreak >nul
)

echo [*] Starting Node.js server...
echo.

REM Start server in development mode
start /B npm run dev >logs\server.log 2>&1

echo [*] Waiting for server to start (5 seconds)...
timeout /t 5 /nobreak >nul

REM Verify server started
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Node.js server started successfully!
    echo.
    echo ========================================
    echo   Server Running!
    echo ========================================
    echo.
    echo Access URLs:
    echo   - Frontend: http://localhost:3000
    echo   - API Info: http://localhost:3000/api
    echo   - Health Check: http://localhost:3000/api/health
    echo.
    echo Log File:
    echo   - Server: E:\xhspro\logs\server.log
    echo.
    echo Notes:
    echo   - MCP service is NOT started (Docker required)
    echo   - Publishing to Xiaohongshu requires MCP service
    echo   - Knowledge base and AI generation work without MCP
    echo.
    echo Press any key to open browser...
    pause >nul
    start http://localhost:3000
    echo.
    echo Browser opened. Enjoy!
    echo.
) else (
    echo [ERROR] Server failed to start
    echo [INFO] Check log: E:\xhspro\logs\server.log
    echo.
    type logs\server.log
    pause
    exit /b 1
)

pause
