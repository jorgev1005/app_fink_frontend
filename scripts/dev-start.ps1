<#
Simple developer start script (PowerShell)

What it does:
- Optionally starts a Docker container named `fink-postgres` if exists but stopped
- Waits for PostgreSQL to accept connections on localhost:5432
- In `backend`: installs dependencies if needed, runs Prisma migrations (deploy) and generates Prisma Client
- Opens two new PowerShell windows: one to run the backend dev script, another for the frontend dev script

Usage:
  pwsh -ExecutionPolicy Bypass -File .\scripts\dev-start.ps1
  pwsh -ExecutionPolicy Bypass -File .\scripts\dev-start.ps1 -UseDocker:$false    # skip docker start attempt

Notes:
- This script is intentionally simple and conservative. If your DB is not in a Docker container
  named `fink-postgres` you can start your DB manually and run this script with -UseDocker:$false
#>

param(
    [switch]$UseDocker = $true,
    [int]$DbWaitSeconds = 60
)

function Write-Heading($s){ Write-Host "`n=== $s ===`n" -ForegroundColor Cyan }

## Calculate repository root (script is in scripts/ so parent of parent)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$Root = Split-Path -Parent $ScriptDir
Write-Heading "Dev start script (root: $Root)"

if ($UseDocker) {
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        Write-Host "Docker CLI found. Checking for container 'fink-postgres'..."
        $inspect = docker inspect -f "{{.State.Running}}" fink-postgres 2>$null
        if ($LASTEXITCODE -eq 0) {
            if ($inspect -eq 'true') {
                Write-Host "Container 'fink-postgres' is already running."
            } else {
                Write-Host "Starting container 'fink-postgres'..."
                docker start fink-postgres | Out-Null
                Start-Sleep -Seconds 2
            }
        } else {
            Write-Host "Container 'fink-postgres' not found. Please start your DB manually or create a container named 'fink-postgres'."
        }
    } else {
        Write-Host "Docker not found in PATH. Skipping Docker start."
    }
} else {
    Write-Host "Skipping Docker start (UseDocker = false)"
}

Write-Host "Waiting up to $DbWaitSeconds seconds for PostgreSQL on localhost:5432..."
$deadline = (Get-Date).AddSeconds($DbWaitSeconds)
$ready = $false
while ((Get-Date) -lt $deadline) {
    try {
        if (Test-NetConnection -ComputerName 'localhost' -Port 5432 -WarningAction SilentlyContinue -InformationLevel Quiet) { $ready = $true; break }
    } catch { }
    Start-Sleep -Seconds 2
}

if (-not $ready) {
    Write-Host "WARNING: PostgreSQL did not respond on 5432 within the timeout. You can still continue, but migrations may fail." -ForegroundColor Yellow
} else {
    Write-Host "PostgreSQL is responding on 5432."
}

Write-Heading "Preparing backend"
Push-Location (Join-Path $Root 'backend')
if (-Not (Test-Path node_modules)) {
    Write-Host "Installing backend dependencies (npm install)..."
    npm install
}

Write-Host "Applying Prisma migrations and generating client (if applicable)..."
try {
    # Use migrate deploy in dev environments too; if you prefer interactive dev use migrate dev manually
    npx prisma migrate deploy
} catch {
    Write-Host "prisma migrate deploy failed (you can run 'npx prisma migrate dev' manually if desired). Continuing to prisma generate..." -ForegroundColor Yellow
}

try {
    npx prisma generate
} catch {
    Write-Host "prisma generate failed. If you see file lock errors, stop running node/npm processes and retry." -ForegroundColor Red
}

Pop-Location

Write-Heading "Starting backend and frontend in new PowerShell windows"

$backendCmd = "cd '$Root\\backend' ; npm run dev"
$frontendCmd = "cd '$Root\\frontend' ; npm run dev"

Write-Host "Opening backend window..."
Start-Process -FilePath 'pwsh' -ArgumentList '-NoExit','-Command',$backendCmd

Start-Sleep -Milliseconds 400
Write-Host "Opening frontend window..."
Start-Process -FilePath 'pwsh' -ArgumentList '-NoExit','-Command',$frontendCmd

Write-Heading "Done"
Write-Host "If either server fails to start, check the corresponding PowerShell window for errors. To run step-by-step manually, see the README instructions shown after this message." -ForegroundColor Green

Write-Host "Manual quick commands (copy/paste if you prefer to run by hand):`n"
Write-Host "pwsh -ExecutionPolicy Bypass -Command 'cd \"$Root\\backend\"; npm install; npx prisma migrate deploy; npx prisma generate; npm run dev'`n"
Write-Host "pwsh -ExecutionPolicy Bypass -Command 'cd \"$Root\\frontend\"; npm install; npm run dev'`n"

Exit 0
