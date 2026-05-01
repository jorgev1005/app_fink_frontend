Write-Host "Stopping development processes..." -ForegroundColor Cyan

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$devDir = Join-Path $repoRoot '.dev'

if (-not (Test-Path $devDir)) { Write-Host "No .dev directory found. Nothing to stop."; exit 0 }

$backendPidFile = Join-Path $devDir 'backend.pid'
$frontendPidFile = Join-Path $devDir 'frontend.pid'

function Stop-If-Running($pidFile) {
  if (Test-Path $pidFile) {
    $pidValue = Get-Content $pidFile | Out-String | ForEach-Object { $_.Trim() };
    if ($pidValue -and (Get-Process -Id $pidValue -ErrorAction SilentlyContinue)) {
      Write-Host "Stopping PID $pidValue" -ForegroundColor Yellow
      Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue
    } else {
      Write-Host "Process $pidValue not running" -ForegroundColor Gray
    }
    Remove-Item $pidFile -ErrorAction SilentlyContinue
  } else {
    Write-Host "PID file $pidFile not found" -ForegroundColor DarkGray
  }
}

Stop-If-Running $backendPidFile
Stop-If-Running $frontendPidFile

Write-Host "Cleanup .dev folder" -ForegroundColor Cyan
Try { Remove-Item -Recurse -Force $devDir -ErrorAction SilentlyContinue } Catch {}

Write-Host "Stopped." -ForegroundColor Green
