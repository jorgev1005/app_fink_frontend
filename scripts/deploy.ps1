                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    # Scripts de despliegue principal
# Uso: .\scripts\deploy.ps1

# Configuración
$VPS_IP = "75.119.154.6"
$VPS_USER = "fink"
$VPS_BACKEND_PATH = "/home/fink/backend"

# Rutas Locales
$LOCAL_ROOT = Get-Location
$LOCAL_BACKEND = "$LOCAL_ROOT\backend"

# Comprobaciones iniciales
if (-not (Test-Path $LOCAL_BACKEND)) {
    Write-Error "No se encuentra la carpeta backend en $LOCAL_BACKEND"
    exit 1
}

# Función Helper para desplegar un componente
function Deploy-Component {
    param (
        [string]$Name,
        [string]$LocalPath,
        [string]$RemotePath,
        [string]$Pm2Name,
        [string[]]$ExcludeList,
        [scriptblock]$PostUploadAction
    )

    Write-Host "`n[INFO] Iniciando despliegue de $Name..." -ForegroundColor Green
    
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $archiveName = "deploy-$Name-$timestamp.tar.gz"
    $useTar = $true

    if (Get-Command "tar" -ErrorAction SilentlyContinue) {
        Write-Host "[INFO] Comprimiendo con tar..." -ForegroundColor Gray
        $excludeArgs = @()
        foreach ($ex in $ExcludeList) {
            $excludeArgs += "--exclude=$ex"
        }
        
        Push-Location $LocalPath
        try {
            tar -czf "$LOCAL_ROOT\$archiveName" $excludeArgs .
        } catch {
            Write-Warning "Fallo tar, intentando zip nativo..."
            $useTar = $false
        }
        Pop-Location
    } else {
        $useTar = $false
    }

    if (-not $useTar) {
        $archiveName = "deploy-$Name-$timestamp.zip"
        Write-Host "[INFO] Comprimiendo con Compress-Archive..." -ForegroundColor Gray
        Push-Location $LocalPath
        $tempDir = "$env:TEMP\deploy-$Name-$timestamp"
        New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
        Copy-Item -Path "$LocalPath\*" -Destination $tempDir -Recurse -Force
        
        foreach ($ex in $ExcludeList) {
            if (Test-Path "$tempDir\$ex") { Remove-Item "$tempDir\$ex" -Recurse -Force }
        }
        
        Compress-Archive -Path "$tempDir\*" -DestinationPath "$LOCAL_ROOT\$archiveName" -Force
        Remove-Item $tempDir -Recurse -Force
        Pop-Location
    }

    if (Test-Path "$LOCAL_ROOT\$archiveName") {
        Write-Host "[INFO] Subiendo archivo al VPS ($VPS_IP)..." -ForegroundColor Cyan
        try {
            scp "$LOCAL_ROOT\$archiveName" "${VPS_USER}@${VPS_IP}:./$archiveName"
            
            $cmd = "ls -l $archiveName; mkdir -p $RemotePath; "
            
            if ($useTar) {
                $cmd += "echo 'Descomprimiendo TAR...'; tar -xzf ./$archiveName -C $RemotePath; rm ./$archiveName; "
            } else {
                $cmd += "echo 'Descomprimiendo ZIP...'; unzip -o ./$archiveName -d $RemotePath; rm ./$archiveName; "
            }
            
            $cmd += "cd $RemotePath; "
            
            if ($PostUploadAction) {
                # Execute script block and get result string
                $actionCmd = & $PostUploadAction
                $cmd += $actionCmd
            }
            
            if ($Pm2Name) {
                $cmd += "echo 'Reiniciando servicio $Pm2Name...'; pm2 restart $Pm2Name; "
            }
            
            $cmd += "echo 'Despliegue $Name completado.'"

            Write-Host "Ejecutando en remoto..." -ForegroundColor Cyan
            ssh "${VPS_USER}@${VPS_IP}" $cmd

        } catch {
            Write-Error "Error en despliegue de ${Name}: ${_}"
        } finally {
            Remove-Item "$LOCAL_ROOT\$archiveName" -ErrorAction SilentlyContinue
        }
    } else {
        Write-Error "No se genero el archivo comprimido para $Name"
    }
}

Write-Host "`n[INFO] El Frontend esta alojado en Vercel. Omitiendo despliegue al VPS." -ForegroundColor Cyan

Write-Host "`n[INFO] Preparando Backend..." -ForegroundColor Yellow
if (Test-Path "$LOCAL_BACKEND\prisma\schema.original") { Remove-Item "$LOCAL_BACKEND\prisma\schema.original" }
Copy-Item "$LOCAL_BACKEND\prisma\schema.prisma" "$LOCAL_BACKEND\prisma\schema.original"

$schemaContent = Get-Content "$LOCAL_BACKEND\prisma\schema.prisma" -Raw
$schemaContent = $schemaContent -replace 'provider = "sqlite"', 'provider = "postgresql"'
$schemaContent = $schemaContent -replace 'url\s*=\s*"file:\./dev.db"', 'url      = env("DATABASE_URL")'
Set-Content "$LOCAL_BACKEND\prisma\schema.prisma" $schemaContent

try {
    # Definir el scriptblock action correctamente
    $backendAction = {
        return "echo 'Permisos scripts...'; chmod +x scripts/*.sh; echo 'Dependencias Backend...'; npm install; echo 'Generando Prisma Cliente...'; npx prisma generate; echo 'Compilando Backend...'; npm run build; echo 'Actualizando BD...'; npx prisma db push --accept-data-loss; "
    }

    Deploy-Component `
        -Name "backend" `
        -LocalPath $LOCAL_BACKEND `
        -RemotePath $VPS_BACKEND_PATH `
        -Pm2Name "fink-backend" `
        -ExcludeList @("node_modules", ".env", ".git", "dist", "uploads", "reports", ".dev", "*.log", "prisma/migrations", "*.temp.ts") `
        -PostUploadAction $backendAction
} finally {
    if (Test-Path "$LOCAL_BACKEND\prisma\schema.original") {
        Copy-Item "$LOCAL_BACKEND\prisma\schema.original" "$LOCAL_BACKEND\prisma\schema.prisma" -Force
        Remove-Item "$LOCAL_BACKEND\prisma\schema.original"
    }
}
