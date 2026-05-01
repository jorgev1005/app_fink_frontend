$ErrorActionPreference='Stop'
Write-Output 'Stopping all node processes (may include frontend)'
Get-Process node -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Output "Killing PID $($_.Id)"
  try { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue } catch {}
}

Write-Output 'Starting backend with PDFTOPPM_BIN via npm script (dev:with-poppler)'
Push-Location "d:\Documentos\espacio_vc\app_fink\backend"
# Start in a new window using cmd.exe so it remains running
Start-Process -FilePath cmd.exe -ArgumentList '/k','npm run dev:with-poppler' -WorkingDirectory (Get-Location).Path
Pop-Location
Write-Output 'Backend start requested (new terminal window).'
