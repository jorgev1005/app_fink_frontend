$ErrorActionPreference = 'Stop'
$bin = 'D:\Documentos\espacio_vc\app_fink\backend\tools\poppler\poppler-25.07.0\Library\bin'
$userPath = [Environment]::GetEnvironmentVariable('Path','User')
if (-not $userPath) { $userPath = '' }
if ($userPath -notlike "*poppler-25.07.0*") {
  [Environment]::SetEnvironmentVariable('Path', ($userPath + ';' + $bin).TrimStart(';'), 'User')
  Write-Output "Updated user PATH to include: $bin"
} else {
  Write-Output 'User PATH already contains poppler'
}
# Update current session PATH
$env:Path = $bin + ';' + $env:Path
Write-Output 'Updated session PATH'
try {
  $where = & where.exe pdftoppm 2>$null
  if ($where) {
    Write-Output "pdftoppm found at: $where"
    & pdftoppm -v
  } else {
    Write-Output 'pdftoppm not found in session PATH'
  }
} catch {
  Write-Output 'Error verifying pdftoppm: ' + $_.Exception.Message
}