# Run start.ps1 with Administrator privileges
# Usage: .\start-admin.ps1

$scriptPath = Join-Path $PSScriptRoot "start.ps1"

if (-not (Test-Path $scriptPath)) {
    Write-Host "[ERROR] start.ps1 not found in current directory" -ForegroundColor Red
    exit 1
}

# Check if already running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if ($isAdmin) {
    Write-Host "[INFO] Already running as Administrator" -ForegroundColor Green
    & $scriptPath
} else {
    Write-Host "[INFO] Requesting Administrator privileges..." -ForegroundColor Yellow
    Start-Process powershell.exe -ArgumentList "-ExecutionPolicy Bypass -File `"$scriptPath`"" -Verb RunAs
}
