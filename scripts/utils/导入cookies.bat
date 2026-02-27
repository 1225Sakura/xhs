@echo off
chcp 65001 >nul
echo === 小红书Cookies导入工具 ===
echo.

REM 检查cookies文件是否存在
if not exist "E:\xhs\my-cookies.json" (
    echo ❌ 错误: 找不到 my-cookies.json 文件
    echo.
    echo 请先按照以下步骤操作：
    echo 1. 在浏览器中登录 xiaohongshu.com
    echo 2. 按F12打开开发者工具
    echo 3. 在Console中运行导出cookies的代码（见 MANUAL_COOKIE_IMPORT.md）
    echo 4. 将导出的JSON保存为 E:\xhs\my-cookies.json
    echo 5. 再次运行此脚本
    pause
    exit /b 1
)

echo ✅ 找到cookies文件
echo.

REM 备份现有cookies
echo 备份现有cookies...
docker exec xhs-mcp-server sh -c "cp /app/data/cookies.json /app/data/cookies.json.backup" 2>nul
echo ✅ 备份完成
echo.

REM 导入新cookies
echo 导入新cookies到MCP服务...
docker cp E:\xhs\my-cookies.json xhs-mcp-server:/app/data/cookies.json
if %errorlevel% equ 0 (
    echo ✅ Cookies导入成功
) else (
    echo ❌ Cookies导入失败
    pause
    exit /b 1
)
echo.

REM 重启MCP服务
echo 重启MCP服务以加载新cookies...
docker-compose restart xiaohongshu-mcp >nul 2>&1
echo ✅ MCP服务已重启
echo.

REM 等待服务启动
echo 等待服务启动（5秒）...
timeout /t 5 /nobreak >nul
echo.

REM 检查登录状态
echo 检查登录状态...
curl -s http://localhost:8080/api/v1/login/status
echo.
echo.

echo 🎉 导入完成！
echo.
echo 现在请：
echo 1. 刷新浏览器页面 http://localhost:3000
echo 2. 检查页面顶部是否显示您的小红书账号
echo 3. 如果显示账号名，说明登录成功
echo 4. 然后就可以发布文案了
echo.

pause
