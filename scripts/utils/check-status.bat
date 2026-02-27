@echo off
REM ========================================
REM XHS System - Check Status
REM ========================================

echo.
echo ========================================
echo   XHS System Status Check
echo ========================================
echo.

REM Check Node.js Server
echo [1/3] Checking Node.js Server...
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Node.js Server: Running on port 3000
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
        echo [INFO] Process ID: %%a
    )
) else (
    echo [ERROR] Node.js Server: Not running
)
echo.

REM Check MCP Container
echo [2/3] Checking MCP Container...
docker ps | findstr xhs-mcp-server >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] MCP Container: Running
    for /f "tokens=*" %%i in ('docker ps ^| findstr xhs-mcp-server') do (
        echo [INFO] %%i
    )
) else (
    echo [ERROR] MCP Container: Not running
)
echo.

REM Check Zombie Processes
echo [3/3] Checking Zombie Processes...
for /f %%i in ('docker exec xhs-mcp-server ps aux ^| findstr defunct ^| find /c /v ""') do set ZOMBIE_COUNT=%%i
echo [INFO] Current zombie processes: %ZOMBIE_COUNT%
if %ZOMBIE_COUNT% GTR 10 (
    echo [WARN] High zombie process count - consider restarting
) else (
    echo [OK] Zombie process count is normal
)
echo.

REM Test MCP Service
echo Testing MCP Service...
curl -s http://localhost:8080/api/v1/login/status >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] MCP Service: Responding
) else (
    echo [WARN] MCP Service: Not responding (may still be starting)
)
echo.

REM Test Node.js API
echo Testing Node.js API...
curl -s http://localhost:3000/api/accounts >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Node.js API: Responding
) else (
    echo [WARN] Node.js API: Not responding
)
echo.

echo ========================================
echo   Status Check Complete
echo ========================================
echo.
echo Access URLs:
echo   - Frontend: http://localhost:3000
echo   - MCP Service: http://localhost:8080
echo.
echo Log Files:
echo   - Node.js: E:\xhs\logs\server.log
echo   - Zombie Cleanup: E:\xhs\logs\zombie-cleanup.log
echo.
pause
