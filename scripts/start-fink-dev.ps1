<#
start-fink-dev.ps1

Detecta la IP local (LAN) y arranca backend + frontend en nuevas terminales.
Uso:
  -Modo dev (por defecto): arranca backend `npm run dev` y frontend `npx next dev`.
  -Modo prod: compila y arranca las builds (npm run build y node/dist / next start).

Ejemplo:
  pwsh -ExecutionPolicy Bypass -File .\scripts\start-fink-dev.ps1 -Mode dev

Requisitos:
  - PowerShell 7+ (pwsh)
  - Node.js y npm instalados
  - Ejecutar desde la máquina que contiene el repo (script asume estructura /backend y /frontend)
#>

param(
  [ValidateSet('dev','prod')]
  [string]$Mode = 'dev',
  [int]$BackendPort = 4002,
  [int]$FrontendPort = 3000
)

Write-Host "start-fink-dev.ps1 — modo: $Mode"

# Detectar IP LAN preferida (192.168.* o 10.*)
$ipObj = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -match '^(192\.168|10\.)' -and $_.IPAddress -ne '127.0.0.1' } | Select-Object -First 1
$ip = $ipObj?.IPAddress
if (-not $ip) {
  Write-Warning "No se detectó automáticamente una IP LAN (192.168.* o 10.*)."
  $manual = Read-Host "Introduce la IP a usar (o presiona Enter para usar 'localhost')"
  if ([string]::IsNullOrWhiteSpace($manual)) { $ip = 'localhost' } else { $ip = $manual }
}

Write-Host "Usando IP: $ip"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
$backendDir = Resolve-Path (Join-Path $repoRoot 'backend')
$frontendDir = Resolve-Path (Join-Path $repoRoot 'frontend')

Write-Host "Repositorio: $repoRoot"
Write-Host "Backend: $backendDir"
Write-Host "Frontend: $frontendDir"

if ($Mode -eq 'dev') {
  $backendCmd = "cd '$backendDir'; `$env:PORT='$BackendPort'; `$env:CORS_ORIGIN='http://localhost:$($FrontendPort),http://$($ip):$($FrontendPort)'; npm run dev"
  $frontendCmd = "cd '$frontendDir'; `$env:NEXT_PUBLIC_API_URL='http://$($ip):$($BackendPort)/api'; `$env:NEXTAUTH_URL='http://$($ip):$($FrontendPort)'; npx next dev -H 0.0.0.0 -p $($FrontendPort)"
} else {
  $backendCmd = "cd '$backendDir'; `$env:PORT='$BackendPort'; `$env:CORS_ORIGIN='http://localhost:$($FrontendPort),http://$($ip):$($FrontendPort)'; npm run build; node dist/index.js"
  $frontendCmd = "cd '$frontendDir'; `$env:NEXT_PUBLIC_API_URL='http://$($ip):$($BackendPort)/api'; `$env:NEXTAUTH_URL='http://$($ip):$($FrontendPort)'; npm run build; npx next start -H 0.0.0.0 -p $($FrontendPort)"
}

# Si se solicita, intentar abrir el firewall para los puertos indicados (requiere ejecutar PowerShell como Administrador)
# Uso: -OpenFirewall (boolean switch)
param(
  [switch]$OpenFirewall
)

function Add-FirewallRuleIfNeeded {
  param(
    [int]$Port,
    [string]$Name
  )
  try {
    Write-Host "Intentando añadir regla de firewall: $Name (puerto $Port)"
    netsh advfirewall firewall add rule name="$Name" dir=in action=allow protocol=TCP localport=$Port | Out-Null
    Write-Host "Regla $Name creada o ya existente."
  } catch {
    Write-Warning "No se pudo crear la regla $Name. Asegúrate de ejecutar PowerShell como Administrador."
  }
}

if ($OpenFirewall) {
  $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if ($isAdmin) {
    Add-FirewallRuleIfNeeded -Port $BackendPort -Name "Fink Backend $BackendPort"
    Add-FirewallRuleIfNeeded -Port $FrontendPort -Name "Fink Frontend $FrontendPort"
  } else {
    Write-Warning "Para abrir las reglas del firewall automáticamente debes ejecutar este script como Administrador."
    Write-Host "Puedes ejecutar manualmente estos comandos en una PowerShell con privilegios de Administrador:"
    Write-Host "  netsh advfirewall firewall add rule name=\"Fink Backend $BackendPort\" dir=in action=allow protocol=TCP localport=$BackendPort"
    Write-Host "  netsh advfirewall firewall add rule name=\"Fink Frontend $FrontendPort\" dir=in action=allow protocol=TCP localport=$FrontendPort"
  }
}

Write-Host "Abriendo terminal para backend..."
Start-Process pwsh -ArgumentList "-NoExit","-Command",$backendCmd

Start-Sleep -Milliseconds 300

Write-Host "Abriendo terminal para frontend..."
Start-Process pwsh -ArgumentList "-NoExit","-Command",$frontendCmd

Write-Host "Backend: http://$($ip):$($BackendPort)"
Write-Host "Frontend: http://$($ip):$($FrontendPort)"
Write-Host "Listo. Revisa las nuevas ventanas de terminal para ver logs y errores."
