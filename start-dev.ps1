param(
  [int]$BackendPort = 4002,
  [int]$FrontendPort = 3001,
  [switch]$AllowExternal
)

Write-Host "Starting development environment..." -ForegroundColor Cyan

# Resolve repository root (script location)
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $repoRoot

# Helper: get a usable IPv4 address on the active interfaces
function Get-LocalIPv4 {
  $candidates = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '169.*' -and $_.IPAddress -ne '127.0.0.1' } | Sort-Object -Property PrefixOrigin
  if ($candidates -and $candidates.Count -gt 0) { return $candidates[0].IPAddress }
  return '127.0.0.1'
}

$localIp = Get-LocalIPv4

if (-not $AllowExternal) {
  $answer = Read-Host "Allow access from other devices on the same LAN (phone)? (y/N)"
  if ($answer -match '^[Yy]') { $AllowExternal = $true }
}

if ($AllowExternal) {
  if ($localIp -eq '127.0.0.1') {
    Write-Warning "Could not detect a LAN IP address; external access may not work. Defaulting to localhost."
    $apiHost = 'localhost'
  } else {
    $apiHost = $localIp
  }
} else {
  $apiHost = 'localhost'
}

$apiUrl = "http://${apiHost}:${BackendPort}"

Write-Host "API URL will be: $apiUrl" -ForegroundColor Green

# Prepare .dev folder to store pids
$devDir = Join-Path $repoRoot '.dev'
if (-not (Test-Path $devDir)) { New-Item -ItemType Directory -Path $devDir | Out-Null }

# Start backend in a new PowerShell window and record PID
$backendPath = Join-Path $repoRoot 'backend'
$corsOrigins = "http://localhost:$FrontendPort,http://127.0.0.1:$FrontendPort"
if ($AllowExternal -and $apiHost -ne 'localhost') { $corsOrigins += ",http://${apiHost}:${FrontendPort}" }

$backendCommand = "`$env:PORT=$BackendPort; `$env:CORS_ORIGIN='$corsOrigins'; cd '$backendPath'; npm run dev"
Write-Host "Starting backend (port $BackendPort) with CORS: $corsOrigins" -ForegroundColor Cyan
$bProc = Start-Process -FilePath pwsh -ArgumentList '-NoExit','-Command',$backendCommand -PassThru
if ($bProc) { $bProc.Id | Out-File (Join-Path $devDir 'backend.pid') }

# Start frontend in a new PowerShell window and record PID
$frontendPath = Join-Path $repoRoot 'frontend'
$frontendCommand = "`$env:PORT=$FrontendPort; `$env:NEXT_PUBLIC_API_URL='$apiUrl'; cd '$frontendPath'; npm run dev"
Write-Host "Starting frontend (port $FrontendPort) -> NEXT_PUBLIC_API_URL=$apiUrl" -ForegroundColor Cyan
$fProc = Start-Process -FilePath pwsh -ArgumentList '-NoExit','-Command',$frontendCommand -PassThru
if ($fProc) { $fProc.Id | Out-File (Join-Path $devDir 'frontend.pid') }

Write-Host "Started backend PID: $($bProc.Id)" -ForegroundColor Green
Write-Host "Started frontend PID: $($fProc.Id)" -ForegroundColor Green

Write-Host "Open in your laptop: http://localhost:$FrontendPort" -ForegroundColor Yellow
if ($AllowExternal -and $apiHost -ne 'localhost') {
  Write-Host "Open in other devices on the network (phone): http://${apiHost}:${FrontendPort}" -ForegroundColor Yellow
  Write-Host "Make sure your firewall allows incoming connections to ports $FrontendPort and $BackendPort." -ForegroundColor Magenta
}

Write-Host "Logs will remain visible in the opened PowerShell windows." -ForegroundColor Cyan

Write-Host "To stop these processes later run: .\stop-dev.ps1" -ForegroundColor Cyan
# Script para iniciar el entorno de desarrollo de FINK
# Ejecutar con: .\start-dev.ps1

Write-Host "🚀 Iniciando FINK - Sistema Administrativo" -ForegroundColor Cyan
Write-Host ""

# Verificar Docker
Write-Host "📦 Verificando Docker..." -ForegroundColor Yellow
$dockerRunning = docker ps 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker Desktop no está corriendo" -ForegroundColor Red
    Write-Host "   Iniciando Docker Desktop..." -ForegroundColor Yellow
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    Write-Host "   Esperando a que Docker inicie (30 segundos)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
}

# Iniciar PostgreSQL
Write-Host "🐘 Iniciando PostgreSQL..." -ForegroundColor Yellow
$postgresStatus = docker ps --filter "name=fink-postgres" --format "{{.Status}}"
if ($postgresStatus -notlike "*Up*") {
    docker start fink-postgres
    Write-Host "   ✅ PostgreSQL iniciado" -ForegroundColor Green
    Start-Sleep -Seconds 3
} else {
    Write-Host "   ✅ PostgreSQL ya está corriendo" -ForegroundColor Green
}

Write-Host ""
Write-Host "🎯 Configurando política de ejecución..." -ForegroundColor Yellow
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process -Force

Write-Host ""
Write-Host "🔧 Iniciando servidores de desarrollo..." -ForegroundColor Cyan
Write-Host ""
Write-Host "   Backend:  http://localhost:4000" -ForegroundColor Green
Write-Host "   Frontend: http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host "   Credenciales:" -ForegroundColor Yellow
Write-Host "   Email:    admin@fink.com" -ForegroundColor White
Write-Host "   Password: Admin123!" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  Presiona Ctrl+C para detener todos los servidores" -ForegroundColor Yellow
Write-Host ""

# Usar Start-Process para abrir terminales separadas
$backendPath = Join-Path $PSScriptRoot "backend"
$frontendPath = Join-Path $PSScriptRoot "frontend"

# Iniciar Backend en nueva terminal (con variables de entorno)
$backendCommand = "`$env:PORT=${BackendPort}; `$env:CORS_ORIGIN='${corsOrigins}'; cd '${backendPath}'; npm run dev"
$bProc = Start-Process pwsh -ArgumentList "-NoExit","-Command",$backendCommand -PassThru
if ($bProc) { $bProc.Id | Out-File (Join-Path $devDir 'backend.pid') }

# Esperar 5 segundos para que el backend inicie
Start-Sleep -Seconds 5

# Iniciar Frontend en nueva terminal (con NEXT_PUBLIC_API_URL)
$frontendCommand = "`$env:PORT=${FrontendPort}; `$env:NEXT_PUBLIC_API_URL='${apiUrl}'; Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process -Force; cd '${frontendPath}'; npm run dev"
$fProc = Start-Process pwsh -ArgumentList "-NoExit","-Command",$frontendCommand -PassThru
if ($fProc) { $fProc.Id | Out-File (Join-Path $devDir 'frontend.pid') }

Write-Host "✅ Servidores iniciados en terminales separadas" -ForegroundColor Green
