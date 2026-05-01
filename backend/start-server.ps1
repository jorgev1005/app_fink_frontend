# Script para iniciar el servidor backend
Set-Location $PSScriptRoot
Write-Host "Iniciando servidor backend desde: $PSScriptRoot" -ForegroundColor Green
npm run dev
