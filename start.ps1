# PowerShell script to start the server with robust port cleanup
# Usage: .\start.ps1

# Require Administrator privileges for reliable process termination
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "`n[WARNING] Not running as Administrator" -ForegroundColor Yellow
    Write-Host "[INFO] Some processes may not be killable without admin rights" -ForegroundColor Yellow
    Write-Host "[TIP] Right-click PowerShell and select 'Run as Administrator' for best results`n" -ForegroundColor Cyan
}

$ErrorActionPreference = "Continue"
$port = 3000
$maxRetries = 3
$retryDelay = 2

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Server Startup Script" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

function Get-ProcessesOnPort {
    param([int]$Port)

    $processes = @()

    # Method 1: Get-NetTCPConnection (Windows 10+)
    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($connections) {
            $processes += $connections | Select-Object -ExpandProperty OwningProcess -Unique
        }
    } catch {
        # Silent fail, will try netstat
    }

    # Method 2: netstat fallback
    if ($processes.Count -eq 0) {
        $netstatOutput = netstat -ano | Select-String ":$Port.*LISTENING"
        if ($netstatOutput) {
            $processes = $netstatOutput | ForEach-Object {
                if ($_ -match '\s+(\d+)\s*$') {
                    [int]$matches[1]
                }
            } | Select-Object -Unique
        }
    }

    return $processes
}

function Kill-ProcessWithRetry {
    param(
        [int]$ProcessId,
        [int]$MaxRetries = 3
    )

    for ($i = 1; $i -le $MaxRetries; $i++) {
        try {
            $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
            if (-not $process) {
                Write-Host "[SUCCESS] Process $ProcessId is no longer running" -ForegroundColor Green
                return $true
            }

            Write-Host "[INFO] Attempt ${i}/${MaxRetries}: Killing process $ProcessId ($($process.ProcessName))..." -ForegroundColor Yellow

            # Try graceful stop first
            if ($i -eq 1) {
                $process.CloseMainWindow() | Out-Null
                Start-Sleep -Milliseconds 500
            }

            # Force kill
            Stop-Process -Id $ProcessId -Force -ErrorAction Stop
            Start-Sleep -Seconds 1

            # Verify
            $stillRunning = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
            if (-not $stillRunning) {
                Write-Host "[SUCCESS] Process $ProcessId terminated" -ForegroundColor Green
                return $true
            }

        } catch {
            if ($i -eq $MaxRetries) {
                Write-Host "[ERROR] Failed to kill process $ProcessId after ${MaxRetries} attempts" -ForegroundColor Red
                Write-Host "[ERROR] $_" -ForegroundColor Red
                return $false
            }
            Start-Sleep -Seconds 1
        }
    }

    return $false
}

# Main logic
Write-Host "[INFO] Checking port $port..." -ForegroundColor Cyan

$attempt = 0
$portCleared = $false

while ($attempt -lt $maxRetries -and -not $portCleared) {
    $attempt++

    if ($attempt -gt 1) {
        Write-Host "[INFO] Retry attempt ${attempt}/${maxRetries}..." -ForegroundColor Yellow
    }

    $processes = Get-ProcessesOnPort -Port $port

    if ($processes.Count -eq 0) {
        Write-Host "[SUCCESS] Port $port is available" -ForegroundColor Green
        $portCleared = $true
        break
    }

    Write-Host "[INFO] Found $($processes.Count) process(es) using port $port" -ForegroundColor Yellow

    # Kill all processes
    $allKilled = $true
    foreach ($processId in $processes) {
        $killed = Kill-ProcessWithRetry -ProcessId $processId -MaxRetries 2
        if (-not $killed) {
            $allKilled = $false
        }
    }

    # Wait for port to be released
    Write-Host "[INFO] Waiting for port to be released..." -ForegroundColor Cyan
    Start-Sleep -Seconds $retryDelay

    # Verify port is free
    $remainingProcesses = Get-ProcessesOnPort -Port $port
    if ($remainingProcesses.Count -eq 0) {
        Write-Host "[SUCCESS] Port $port is now available" -ForegroundColor Green
        $portCleared = $true
    } else {
        Write-Host "[WARNING] Port $port is still in use by $($remainingProcesses.Count) process(es)" -ForegroundColor Yellow
        $retryDelay += 1  # Increase delay for next retry
    }
}

if (-not $portCleared) {
    Write-Host "[ERROR] Failed to clear port $port after ${maxRetries} attempts" -ForegroundColor Red
    Write-Host "[INFO] Manual cleanup required:" -ForegroundColor Yellow
    Write-Host "  1. Run this script as Administrator" -ForegroundColor White
    Write-Host "  2. Or manually kill the process:" -ForegroundColor White

    $processes = Get-ProcessesOnPort -Port $port
    foreach ($processId in $processes) {
        Write-Host "     taskkill /F /PID $processId" -ForegroundColor White
    }

    Write-Host "`n[INFO] Press any key to exit..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host "`n[INFO] Starting server..." -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Start the server
npm start
