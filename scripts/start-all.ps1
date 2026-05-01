<#
start-all.ps1
Script para intentar levantar Postgres (servicio), backend y frontend.
Ejecútalo como Administrador para que la parte de servicios funcione.

Uso:
- Abrir PowerShell como Administrador
- Ejecutar: .\scripts\start-all.ps1

Ajusta las rutas si tus instalaciones son diferentes.
#>
param(
  [string]$PostgresServiceName = 'PostgreSQL_For_Odoo',
  # Rutas detectadas en este equipo. Ajusta si tu instalación está en otra carpeta.
  [string]$PgCtlPath = 'C:\Program Files\Odoo 17.0.20240626\PostgreSQL\bin\pg_ctl.exe',
  [string]$PgDataDir = 'C:\Program Files\Odoo 17.0.20240626\PostgreSQL\data',
  [string]$BackendDir = 'D:\Documentos\espacio_vc\app_fink\backend',
  [string]$FrontendDir = 'D:\Documentos\espacio_vc\app_fink\frontend',
  [int]$PgPort = 5432,
  [int]$PortWaitSeconds = 30,
  [switch]$ForcePgCtlStart  # si se pasa, intentará usar pg_ctl aunque no detecte PG_VERSION (no recomendado)
)

function Wait-ForPort {
  param($port, $timeoutSec = 30)
  $end = (Get-Date).AddSeconds($timeoutSec)
  while((Get-Date) -lt $end) {
    if (netstat -ano | Select-String ":$port" -Quiet) {
      return $true
    }
    Start-Sleep -Seconds 1
  }
  return $false
}

Write-Host "=== start-all.ps1: Comenzando ==="

# Intentar Start-Service
Write-Host "1) Intentando arrancar servicio Windows '$PostgresServiceName'..."
try {
  Start-Service -Name $PostgresServiceName -ErrorAction Stop
  Write-Host "Start-Service: comando enviado correctamente."
} catch {
  Write-Warning "Start-Service falló: $($_.Exception.Message)"
  Write-Host "Comprobando si '$PgDataDir' es un clúster PostgreSQL válido..."
  $pgVersion = Test-Path (Join-Path $PgDataDir 'PG_VERSION')
  if (-not $pgVersion) {
    Write-Warning "No se encontró PG_VERSION en $PgDataDir -> no parece ser un clúster válido."
    Write-Host "Buscando clústeres posibles bajo 'C:\\Program Files' (esto puede tardar)..."
    $found = Get-ChildItem -Path 'C:\Program Files' -Recurse -Force -ErrorAction SilentlyContinue -Filter 'PG_VERSION' | Select-Object -First 20 -ExpandProperty FullName
    if ($found) {
      Write-Host "Se encontraron posibles PG_VERSION en las siguientes rutas:";
      $found | ForEach-Object { Write-Host " - $_" }
      Write-Host "Puedes volver a ejecutar el script pasando -PgDataDir con la ruta correcta o editar este script.";
    } else {
      Write-Warning "No se encontraron clústeres PostgreSQL bajo 'C:\\Program Files'.";
    }
    if ($ForcePgCtlStart) {
      Write-Warning "Se forzará intento de arranque con pg_ctl aunque no se detectó PG_VERSION (no recomendado)."
    } else {
      Write-Warning "No intentaré arrancar pg_ctl automáticamente porque no se detectó un clúster. Usa -ForcePgCtlStart para forzar.";
    }
  }
  # Si hay pg_ctl y (hay PG_VERSION o se forzó), intentamos pg_ctl
  if ((Test-Path $PgCtlPath -PathType Leaf) -and ($pgVersion -or $ForcePgCtlStart)) {
    Write-Host "Ejecutando: $PgCtlPath start -D $PgDataDir -l $env:TEMP\pg_start.log -w"
    try {
      & $PgCtlPath start -D $PgDataDir -l "$env:TEMP\pg_start.log" -w
      Write-Host "pg_ctl ha ejecutado. Revisa el log en $env:TEMP\pg_start.log"
    } catch {
      Write-Warning "pg_ctl falló: $($_.Exception.Message)"
      if (Test-Path "$env:TEMP\pg_start.log") { Write-Host "Últimas líneas del log:"; Get-Content "$env:TEMP\pg_start.log" -Tail 200 }
    }
  } else {
    if (-not (Test-Path $PgCtlPath -PathType Leaf)) { Write-Warning "No se encontró pg_ctl en '$PgCtlPath'. Ajusta -PgCtlPath." }
  }
}

Write-Host "2) Esperando que Postgres escuche en el puerto $PgPort (timeout ${PortWaitSeconds}s)..."
if (Wait-ForPort -port $PgPort -timeoutSec $PortWaitSeconds) {
  Write-Host "Postgres está escuchando en el puerto $PgPort."
} else {
  Write-Warning "Postgres no respondió en el puerto $PgPort dentro del timeout. Revisa logs y permisos antes de continuar."
}

Write-Host "3) Iniciando backend (abrir nueva terminal)..."
Start-Process -FilePath "pwsh.exe" -ArgumentList "-NoExit","-Command","cd '$BackendDir'; npm run dev" -WindowStyle Normal

Write-Host "4) Iniciando frontend (abrir nueva terminal)..."
Start-Process -FilePath "pwsh.exe" -ArgumentList "-NoExit","-Command","cd '$FrontendDir'; npm run dev" -WindowStyle Normal

Write-Host "=== start-all.ps1: Finalizado. Revisa las nuevas consolas para ver logs. ==="
