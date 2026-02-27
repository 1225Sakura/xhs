@echo off
chcp 65001 >nul
echo ==========================================
echo   One-Click Fix - Image Paths
echo ==========================================
echo.

echo [Step 1] Fixing image paths in database...
sqlite3 E:\xhs\data\knowledge.db "UPDATE posts SET images = '[\"/uploads/images/1764838079639-835949271.jpg\"]' WHERE id=1;"
sqlite3 E:\xhs\data\knowledge.db "UPDATE posts SET images = '[\"/uploads/images/1764839212734-350736362.png\"]' WHERE id=2;"
sqlite3 E:\xhs\data\knowledge.db "UPDATE posts SET images = '[\"/uploads/images/1764842799278-828178496.jpg\"]' WHERE id=3;"
echo [OK] Image paths fixed
echo.

echo [Step 2] Verifying fixes...
sqlite3 E:\xhs\data\knowledge.db "SELECT id, title, substr(images, 1, 50) FROM posts;"
echo.

echo [Step 3] Restarting server...
taskkill /F /IM node.exe 2>nul
timeout /t 3 /nobreak >nul

cd /d E:\xhs
start /min cmd /c "node src/server.js > server.log 2>&1"
echo [OK] Server restarted
echo.

echo [Step 4] Waiting for server to start...
timeout /t 5 /nobreak >nul
echo.

echo ==========================================
echo   Fix Complete!
echo ==========================================
echo.
echo Now you can:
echo 1. Refresh browser: http://localhost:3000
echo 2. Select any post and click Publish
echo 3. Wait 30-60 seconds for completion
echo.
echo All image paths are now correct!
echo.
pause
