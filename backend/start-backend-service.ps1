<#
Starts the backend in a detached/background process on Windows.

Usage:
  # Start in dev mode (uses nodemon + ts-node if available)
  .\start-backend-service.ps1 -Mode dev

  # Start in prod-like mode (runs ts-node directly)
  .\start-backend-service.ps1 -Mode prod

Notes:
 - The script uses cmd.exe to run the npx command so the process stays detached.
 - Logs are written to backend-service.log inside the backend folder.
 - To stop the process, find the node process and stop it or use Task Manager.
#>

param(
  [ValidateSet("dev","prod")]
  [string]$Mode = "dev"
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
$log = Join-Path $root 'backend-service.log'

if ($Mode -eq 'dev') {
  # Prefer nodemon (dev) if available
  $cmd = "cd /d `"$root`" && npx nodemon --exec ts-node src/index.ts > `"$log`" 2>&1"
} else {
  $cmd = "cd /d `"$root`" && npx ts-node src/index.ts > `"$log`" 2>&1"
}

Write-Host "Starting backend in $Mode mode (detached). Logs -> $log"
Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $cmd -WindowStyle Hidden -WorkingDirectory $root
Start-Sleep -Seconds 1
Write-Host "Backend start command launched. Check the log file or use Get-Process to find node processes."
