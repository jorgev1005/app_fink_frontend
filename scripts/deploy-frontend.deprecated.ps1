# Script de Despliegue Automatizado - SOLO FRONTEND
# Ejecutar desde la raíz del proyecto: .\scripts\deploy-frontend.ps1

$VPS_USER = "fink"
$VPS_IP = "75.119.154.6"
$VPS_FRONTEND_PATH = "/home/fink/frontend"
$LOCAL_FRONTEND = ".\frontend"

Write-Host "🚀 Iniciando despliegue de FRONTEND..." -ForegroundColor Cyan

# Función auxiliar (simplificada)
function Deploy-Component {
    param (
        [string]$Name,
        [string]$LocalPath,
        [string]$RemotePath,
        [string]$Pm2Name,
        [string[]]$ExcludeList,
        [scriptblock]$PostUploadAction
    )

    Write-Host "`n📦 Procesando $Name..." -ForegroundColor Yellow
    
    $tempDir = Join-Path $env:TEMP ("fink_deploy_${Name}_" + [Guid]::NewGuid().ToString())
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    
    Write-Host "Copiando archivos a temporal..." -ForegroundColor Gray
    $source = Resolve-Path $LocalPath
    Copy-Item -Path "$source\*" -Destination $tempDir -Recurse -Force

    foreach ($item in $ExcludeList) {
        if ($item -like "*\*" -or $item -like "*/*") {
            if (Test-Path "$tempDir\$item") { Remove-Item "$tempDir\$item" -Recurse -Force -ErrorAction SilentlyContinue }
        } else {
            Get-ChildItem -Path $tempDir -Filter $item | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    $archiveName = "${Name}_deploy.tgz"
    $useTar = $false
    Write-Host "Comprimiendo..." -ForegroundColor Gray
    
    if (Get-Command tar -ErrorAction SilentlyContinue) {
        try {
            tar -czf $archiveName -C "$tempDir" .
            if ($LASTEXITCODE -eq 0) { $useTar = $true }
        } catch { Write-Warning "Fallo tar, usando zip fallback." }
    }

    if (-not $useTar) {
        $archiveName = "${Name}_deploy.zip"
        Compress-Archive -Path "$tempDir\*" -DestinationPath $archiveName -Force
    }
    
    Remove-Item $tempDir -Recurse -Force

    if (Test-Path ".\$archiveName") {
        Write-Host "Subiendo $archiveName al VPS..." -ForegroundColor Cyan
        try {
            # Aumentar timeout implícito no es posible directo en scp, pero reintentamos 1 vez si falla
            scp ".\$archiveName" "${VPS_USER}@${VPS_IP}:./$archiveName"
            
            $cmd = "ls -l $archiveName; mkdir -p $RemotePath; "
            if ($useTar) {
                $cmd += "echo '📦 Descomprimiendo TAR...'; tar -xzf ./$archiveName -C $RemotePath; rm ./$archiveName; "
            } else {
                $cmd += "echo '📦 Descomprimiendo ZIP...'; unzip -o ./$archiveName -d $RemotePath; rm ./$archiveName; "
            }
            $cmd += "cd $RemotePath; "
            if ($PostUploadAction) {
                $actionCmd = & $PostUploadAction
                $cmd += $actionCmd
            }
            if ($Pm2Name) {
                $cmd += "echo '♻️  Reiniciando servicio $Pm2Name...'; pm2 restart $Pm2Name; "
            }
            $cmd += "echo '✅ Despliegue $Name completado.'"

            Write-Host "Ejecutando en remoto..." -ForegroundColor Cyan
            ssh "${VPS_USER}@${VPS_IP}" $cmd

        } catch {
            Write-Error "Error en despliegue de ${Name}: ${_}"
        } finally {
            Remove-Item ".\$archiveName" -ErrorAction SilentlyContinue
        }
    } else {
        Write-Error "No se generó el archivo comprimido."
    }
}

Deploy-Component `
    -Name "frontend" `
    -LocalPath $LOCAL_FRONTEND `
    -RemotePath $VPS_FRONTEND_PATH `
    -Pm2Name "fink-frontend" `
    -ExcludeList @("node_modules", ".next", ".git", ".env", ".vscode", "test-results") `
    -PostUploadAction {
        return "echo '🔌 Instalando dependencias...'; npm install --legacy-peer-deps; echo '⚡ Compilando...'; npm run build; "
    }

Write-Host "`n✨ Proceso finalizado." -ForegroundColor Magenta
