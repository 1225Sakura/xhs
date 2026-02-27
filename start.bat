@echo off
chcp 65001 >nul 2>&1

echo [INFO] Checking port 3000...

REM Kill all processes using port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo [INFO] Killing process %%a on port 3000...
    taskkill /F /PID %%a >nul 2>&1
)

REM Wait for port to be released
timeout /t 2 /nobreak >nul 2>&1

echo [INFO] Starting server...
npm start
