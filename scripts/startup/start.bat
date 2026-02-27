@echo off
REM ========================================
REM XHS System - Start All Services
REM ========================================

echo.
echo ========================================
echo   XHS Publishing System
echo   Starting All Services
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

REM Check Docker
where docker >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker not found
    echo Please install Docker Desktop
    pause
    exit /b 1
)
echo [OK] Docker: Installed

REM Check Docker running
docker ps >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker is not running
    echo Please start Docker Desktop first
    pause
    exit /b 1
)
echo [OK] Docker: Running
echo.

REM ========================================
REM Stop existing services
REM ========================================
echo [Step 1/6] Stopping existing services...
echo.

echo [*] Stopping Node.js servers...
taskkill /F /IM node.exe >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Node.js servers stopped
) else (
    echo [INFO] No Node.js servers running
)

where pm2 >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [*] Stopping pm2 services...
    pm2 stop all >nul 2>nul
    echo [OK] pm2 services stopped
)

echo.

REM ========================================
REM Restart Docker container
REM ========================================
echo [Step 2/6] Restarting Docker container...
echo.

docker ps -a | findstr xhs-mcp-server >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Container xhs-mcp-server not found
    pause
    exit /b 1
)

echo [*] Restarting MCP container...
docker restart xhs-mcp-server >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to restart container
    pause
    exit /b 1
)
echo [OK] MCP container restarted

echo [*] Waiting for container to start (15 seconds)...
timeout /t 15 /nobreak >nul
echo [OK] Container started
echo.

REM Check zombie processes
echo [*] Checking zombie processes...
for /f %%i in ('docker exec xhs-mcp-server ps aux ^| findstr defunct ^| find /c /v ""') do set ZOMBIE_COUNT=%%i
echo [INFO] Current zombie processes: %ZOMBIE_COUNT%
if %ZOMBIE_COUNT% GTR 10 (
    echo [WARN] High zombie process count
)
echo.

REM ========================================
REM Start Node.js backend
REM ========================================
echo [Step 3/6] Starting Node.js backend...
echo.

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
cd /d E:\xhspro
start /B node src\server.js >logs\server.log 2>&1

echo [*] Waiting for server to start (5 seconds)...
timeout /t 5 /nobreak >nul

REM Verify server started
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Node.js server started (http://localhost:3000)
) else (
    echo [ERROR] Node.js server failed to start
    echo [INFO] Check log: E:\xhspro\logs\server.log
    pause
    exit /b 1
)
echo.

REM ========================================
REM Start zombie cleanup service
REM ========================================
echo [Step 4/6] Starting zombie cleanup service...
echo.

if not exist "E:\xhspro\scripts\auto-cleanup-zombies.js" (
    echo [WARN] Zombie cleanup script not found
    echo [INFO] Skipping zombie cleanup service
) else (
    echo [*] Starting auto cleanup service...
    start /B node scripts\auto-cleanup-zombies.js >logs\zombie-cleanup.log 2>&1
    timeout /t 2 /nobreak >nul
    echo [OK] Zombie cleanup service started
)
echo.

REM ========================================
REM Verify all services
REM ========================================
echo [Step 5/6] Verifying service status...
echo.

docker ps | findstr xhs-mcp-server >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] MCP Container: Running
) else (
    echo [ERROR] MCP Container: Not running
)

netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Node.js Server: Running (port 3000)
) else (
    echo [ERROR] Node.js Server: Not running
)

tasklist | findstr node.exe | find /c /v "" >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Zombie Cleanup: Running
) else (
    echo [INFO] Zombie Cleanup: Not running
)

echo.
echo ========================================
echo   All Services Started!
echo ========================================
echo.
echo Access URLs:
echo   - Frontend: http://localhost:3000
echo   - MCP Service: http://localhost:8080
echo.
echo Log Files:
echo   - Node.js Server: E:\xhspro\logs\server.log
echo   - Zombie Cleanup: E:\xhspro\logs\zombie-cleanup.log
echo.
echo Tips:
echo   - Closing this window will NOT stop services
echo   - To stop services, run: stop.bat
echo   - To view logs, check the logs directory
echo.
echo Press any key to open browser...
pause >nul

REM Open browser
start http://localhost:3000

echo.
echo Browser opened. Enjoy!
echo.
pause
