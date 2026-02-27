@echo off
echo ========================================
echo   XiaoHongShu Login Tool
echo ========================================
echo.
echo This tool will:
echo 1. Open browser window
echo 2. Show XiaoHongShu login page
echo 3. After you scan QR code, it saves cookies
echo 4. Copy cookies to MCP service
echo.
echo Press any key to start...
pause >nul
echo.

cd /d E:\xhs\external\xiaohongshu-mcp

echo [Step 1] Running login tool...
echo.
echo Tips:
echo - Browser window will open automatically
echo - Scan QR code with XiaoHongShu APP
echo - After login success, press Ctrl+C to stop
echo.

xiaohongshu-login-windows-amd64.exe

echo.
echo [Step 2] Checking cookies file...
if exist "cookies.json" (
    echo [OK] Found cookies file
    echo.

    echo [Step 3] Copying cookies to MCP service...
    docker cp cookies.json xhs-mcp-server:/app/data/cookies.json
    if %errorlevel% equ 0 (
        echo [OK] Cookies copied to MCP service
    ) else (
        echo [ERROR] Copy failed, check if Docker is running
        pause
        exit /b 1
    )

    echo.
    echo [Step 4] Restarting MCP service...
    cd /d E:\xhs
    docker-compose restart xiaohongshu-mcp
    echo [OK] MCP service restarted

    echo.
    echo [Step 5] Waiting for service to start...
    timeout /t 5 /nobreak >nul

    echo.
    echo [Step 6] Checking login status...
    curl -s http://localhost:8080/api/v1/login/status
    echo.

) else (
    echo [ERROR] Cookies file not found
    echo Possible reasons:
    echo 1. Login not completed
    echo 2. Login tool was closed early
    echo.
    echo Please run this script again
)

echo.
echo ========================================
echo Done!
echo.
echo Now please:
echo 1. Refresh browser http://localhost:3000
echo 2. Check if your XHS account is shown
echo 3. Try to publish a post
echo ========================================
echo.
pause
