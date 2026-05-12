# Script para iniciar el servidor frontend
Set-Location $PSScriptRoot
Write-Host "Iniciando servidor frontend desde: $PSScriptRoot" -ForegroundColor Cyan
npm run dev
