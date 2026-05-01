$ErrorActionPreference='Stop'
Write-Output "Querying GitHub for poppler-windows latest release..."
$rel = Invoke-RestMethod -Uri 'https://api.github.com/repos/oschwartz10612/poppler-windows/releases/latest' -Headers @{ 'User-Agent'='vscode' }
$asset = $rel.assets | Where-Object { $_.name -match '\.zip$' } | Select-Object -First 1
if ($null -eq $asset) { Write-Error 'No zip asset found'; exit 1 }
$dl = $asset.browser_download_url
Write-Output "Found asset: $($asset.name)"
$tools = 'd:\Documentos\espacio_vc\app_fink\backend\tools'
$dest = Join-Path $tools 'poppler.zip'
New-Item -ItemType Directory -Path $tools -Force | Out-Null
Write-Output "Downloading $dl -> $dest"
$wc = New-Object System.Net.WebClient
$wc.Headers.Add('User-Agent','vscode')
$wc.DownloadFile($dl, $dest)
Write-Output "Extracting to $tools\poppler ..."
Expand-Archive -Path $dest -DestinationPath (Join-Path $tools 'poppler') -Force
Write-Output "Searching for pdftoppm.exe under extracted files..."
$bin = Get-ChildItem (Join-Path $tools 'poppler') -Directory -Recurse | Where-Object { Test-Path (Join-Path $_.FullName 'bin\\pdftoppm.exe') } | Select-Object -First 1
if ($bin) {
  $binPath = Join-Path $bin.FullName 'bin'
  $env:Path = $binPath + ';' + $env:Path
  Write-Output "Added to PATH for this session: $binPath"
} else {
  Write-Warning 'pdftoppm.exe not found in extracted content'
}
Write-Output 'Verification: where pdftoppm'
where.exe pdftoppm
