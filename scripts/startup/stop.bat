@echo off
REM ========================================
REM XHS System - Stop All Services
REM ========================================

echo.
echo ========================================
echo   XHS Publishing System
echo   Stopping All Services
echo ========================================
echo.

REM Stop Node.js services
echo [Step 1/3] Stopping Node.js services...
echo.

tasklist | findstr node.exe >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [*] Stopping Node.js processes...
    taskkill /F /IM node.exe >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo [OK] Node.js services stopped
    ) else (
        echo [ERROR] Failed to stop Node.js services
    )
) else (
    echo [INFO] No Node.js services running
)
echo.

REM Stop pm2 services
echo [Step 2/3] Stopping pm2 services...
echo.

where pm2 >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [*] Stopping pm2 services...
    pm2 stop all >nul 2>nul
    pm2 delete all >nul 2>nul
    echo [OK] pm2 services stopped
) else (
    echo [INFO] pm2 not installed
)
echo.

REM Stop Docker container (optional)
echo [Step 3/3] Stop Docker container (optional)...
echo.

echo [?] Do you want to stop MCP container?
echo     Note: Stopping container will lose login status
echo.
echo     1 = Stop container
echo     2 = Keep container running (Recommended)
echo.
choice /C 12 /N /M "Please choose [1/2]: "

if %ERRORLEVEL% EQU 1 (
    echo.
    echo [*] Stopping MCP container...
    docker stop xhs-mcp-server >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo [OK] MCP container stopped
    ) else (
        echo [ERROR] Failed to stop MCP container
    )
) else (
    echo.
    echo [INFO] Keeping MCP container running
)

echo.
echo ========================================
echo   All Services Stopped
echo ========================================
echo.
echo Status:
echo   - Node.js Server: Stopped
echo   - Zombie Cleanup: Stopped
echo   - MCP Container: Based on your choice
echo.
echo To restart, run: start.bat
echo.
pause
