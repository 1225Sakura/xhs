@echo off
REM 启动僵尸进程自动清理服务

echo ========================================
echo MCP 容器僵尸进程自动清理服务
echo ========================================
echo.

REM 检查 Node.js 是否安装
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo 错误: 未找到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

REM 检查 Docker 是否运行
docker ps >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo 错误: Docker 未运行，请先启动 Docker Desktop
    pause
    exit /b 1
)

echo 正在启动自动清理服务...
echo.
echo 配置:
echo   - 僵尸进程阈值: 10
echo   - 检查间隔: 60 秒
echo   - 日志文件: logs/zombie-cleanup.log
echo.
echo 按 Ctrl+C 停止服务
echo.

REM 启动服务
node scripts/auto-cleanup-zombies.js

pause
