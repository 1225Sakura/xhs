@echo off
chcp 65001 >nul
REM ========================================
REM 小红书知识库发布系统 - 停止所有服务
REM ========================================

echo.
echo ========================================
echo   小红书知识库发布系统
echo   停止所有服务
echo ========================================
echo.

REM ========================================
REM 停止 Node.js 服务
REM ========================================
echo [1/3] 停止 Node.js 服务...
echo.

tasklist | findstr node.exe >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [*] 正在停止 Node.js 进程...
    taskkill /F /IM node.exe >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo [√] Node.js 服务已停止
    ) else (
        echo [×] 停止 Node.js 服务失败
    )
) else (
    echo [i] 没有运行中的 Node.js 服务
)
echo.

REM ========================================
REM 停止 pm2 服务
REM ========================================
echo [2/3] 停止 pm2 服务...
echo.

where pm2 >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [*] 正在停止 pm2 服务...
    pm2 stop all >nul 2>nul
    pm2 delete all >nul 2>nul
    echo [√] pm2 服务已停止
) else (
    echo [i] 未安装 pm2
)
echo.

REM ========================================
REM 停止 Docker 容器（可选）
REM ========================================
echo [3/3] 停止 Docker 容器（可选）...
echo.

echo [?] 是否停止 MCP 容器？
echo     注意：停止容器会导致登录状态失效
echo.
echo     1 = 停止容器
echo     2 = 保持容器运行（推荐）
echo.
choice /C 12 /N /M "请选择 [1/2]: "

if %ERRORLEVEL% EQU 1 (
    echo.
    echo [*] 正在停止 MCP 容器...
    docker stop xhs-mcp-server >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo [√] MCP 容器已停止
    ) else (
        echo [×] 停止 MCP 容器失败
    )
) else (
    echo.
    echo [i] 保持 MCP 容器运行
)

echo.
echo ========================================
echo   所有服务已停止
echo ========================================
echo.
echo 提示:
echo   - Node.js 服务器已停止
echo   - 僵尸进程清理服务已停止
echo   - MCP 容器状态: 根据您的选择
echo.
echo 如需重新启动，请运行 启动.bat
echo.
pause
