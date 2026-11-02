# NativeSense launcher — starts server + web, opens the browser, avoids duplicate processes.
# Called by start.bat; do not double-click this directly.

$ErrorActionPreference = 'Stop'
$ProjectRoot = $PSScriptRoot
$Host.UI.RawUI.WindowTitle = 'NativeSense launcher'

function Test-PortListening([int]$Port) {
  return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Wait-ForUrl([string]$Url, [int]$MaxSeconds = 30) {
  for ($i = 1; $i -le $MaxSeconds; $i++) {
    try {
      $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 1
      if ($resp.StatusCode -ge 200) { return $true }
    } catch {
      Start-Sleep -Seconds 1
    }
  }
  return $false
}

Write-Host '=== NativeSense launcher ===' -ForegroundColor Cyan
Write-Host "Project root: $ProjectRoot"

# 1. Sanity check: npm must be on PATH.
try {
  $null = Get-Command npm -ErrorAction Stop
} catch {
  Write-Host 'ERROR: npm not found on PATH. Install Node.js 20+ and reopen this launcher.' -ForegroundColor Red
  Read-Host 'Press Enter to exit'
  exit 1
}

# 2. Are both services already up?
$backendUp = Test-PortListening 3001
$frontendUp = Test-PortListening 5173

if ($backendUp -and $frontendUp) {
  Write-Host 'NativeSense is already running (ports 3001 + 5173 occupied). Opening browser.' -ForegroundColor Green
  Start-Process 'http://localhost:5173'
  Start-Sleep -Seconds 1
  exit 0
}

if ($backendUp -or $frontendUp) {
  Write-Host "WARNING: Only one port is occupied (backend=$backendUp, frontend=$frontendUp)." -ForegroundColor Yellow
  Write-Host 'Starting a fresh stack anyway — if you see an "address already in use" error in the log window, close it and stop the leftover process manually.'
}

# 3. Start the dev stack in a separate visible window (logs stay there).
Write-Host 'Starting server + web in a new window...' -ForegroundColor Cyan
Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', 'npm run dev' -WorkingDirectory $ProjectRoot

# 4. Poll the frontend until it responds (max 30s).
Write-Host 'Waiting for http://localhost:5173 ...' -NoNewline
$ok = Wait-ForUrl 'http://localhost:5173' -MaxSeconds 30
if (-not $ok) {
  Write-Host ''
  Write-Host 'ERROR: Frontend did not respond within 30 seconds.' -ForegroundColor Red
  Write-Host 'Check the open "NativeSense" log window above for errors (port in use, npm install missing, Ollama offline).'
  Read-Host 'Press Enter to exit'
  exit 1
}

Write-Host ' ready.' -ForegroundColor Green
Start-Process 'http://localhost:5173'
Write-Host 'Browser opened. Close the black "NativeSense" window to stop the server.' -ForegroundColor Cyan
Start-Sleep -Seconds 2
