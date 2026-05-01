<#
Quick test script for invoice flow (PowerShell)

Usage:
- Set any of these environment variables before running, or edit the top of the script:
  - $env:BACKEND_URL (default: http://localhost:4001)
  - $env:TEST_TOKEN (Bearer token) OR
  - $env:TEST_EMAIL and $env:TEST_PASSWORD (to login)
  - $env:TEST_PROJECT_ID (optional, for project-scoped threshold/create)

Examples:
$env:BACKEND_URL='http://localhost:4001'
$env:TEST_EMAIL='tester@example.com'; $env:TEST_PASSWORD='password123'; $env:TEST_PROJECT_ID='project-uuid'
pwsh .\test_invoice_flow.ps1

What the script does:
1) Resolve an auth token (use TEST_TOKEN or login with TEST_EMAIL/TEST_PASSWORD)
2) Read current parse-threshold (GET)
3) Save a test parse-threshold (POST)
4) Call parse endpoint with sample text (POST)
5) Create an invoice using the parsed suggestion (POST)

Notes:
- Adjust sample text or payload below if your API expects different shapes.
- The script prints responses as JSON and returns non-zero on failure.
#>

# --- configuration
$BACKEND_URL = $env:BACKEND_URL -or 'http://localhost:4001'
$TEST_TOKEN = $env:TEST_TOKEN
$TEST_EMAIL = $env:TEST_EMAIL
$TEST_PASSWORD = $env:TEST_PASSWORD
$PROJECT_ID = $env:TEST_PROJECT_ID

# helper: perform JSON HTTP request and return parsed object
function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        $Body = $null,
        [string]$Token = $null
    )

    $uri = "$BACKEND_URL$Path"
    $headers = @{
        'Accept' = 'application/json'
    }
    if ($Token) { $headers['Authorization'] = $Token }

    $bodyJson = $null
    if ($null -ne $Body) { $bodyJson = $Body | ConvertTo-Json -Depth 10 }

    try {
        if ($bodyJson) {
            $r = Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -Body $bodyJson -ContentType 'application/json' -ErrorAction Stop
        } else {
            $r = Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -ErrorAction Stop
        }
        return @{ ok = $true; resp = $r }
    } catch {
        $err = $_.Exception.Response
        if ($err) {
            try { $txt = (New-Object System.IO.StreamReader($err.GetResponseStream())).ReadToEnd() } catch { $txt = "<no body>" }
            return @{ ok = $false; status = $_.Exception.StatusCode; body = $txt; error = $_.Exception.Message }
        }
        return @{ ok = $false; error = $_.Exception.Message }
    }
}

# Resolve token
if (-not $TEST_TOKEN) {
    if ($TEST_EMAIL -and $TEST_PASSWORD) {
        Write-Host "No TEST_TOKEN provided; attempting login with TEST_EMAIL/TEST_PASSWORD..."
        $loginPayload = @{ email = $TEST_EMAIL; password = $TEST_PASSWORD }
        $r = Invoke-Api -Method Post -Path '/api/auth/login' -Body $loginPayload
        if ($r.ok) {
            # try common token locations
            $t = $r.resp.token -or $r.resp.accessToken -or $r.resp.data?.token -or $r.resp.data?.accessToken
            if (-not $t) {
                Write-Host "Login succeeded but token not found in response - please provide TEST_TOKEN env var." -ForegroundColor Yellow
            } else {
                $TEST_TOKEN = "Bearer $t"
                Write-Host "Got token via login"
            }
        } else {
            Write-Host "Login failed:" -ForegroundColor Red; Write-Host ($r | ConvertTo-Json -Depth 5)
        }
    } else {
        Write-Host "No TEST_TOKEN or TEST_EMAIL/TEST_PASSWORD provided. Set one and re-run." -ForegroundColor Red
        exit 2
    }
} else {
    if ($TEST_TOKEN -notlike 'Bearer *') { $TEST_TOKEN = "Bearer $TEST_TOKEN" }
}

if (-not $TEST_TOKEN) { Write-Host "No token available. Aborting." -ForegroundColor Red; exit 3 }

Write-Host "Using backend: $BACKEND_URL"

# 1) Read current parse threshold
Write-Host "\n1) GET parse-threshold" -ForegroundColor Cyan
$path = '/api/settings/parse-threshold'
if ($PROJECT_ID) { $path = "$path?projectId=$PROJECT_ID" }
$r = Invoke-Api -Method Get -Path $path -Token $TEST_TOKEN
if ($r.ok) { Write-Host ($r.resp | ConvertTo-Json -Depth 5) } else { Write-Host ($r | ConvertTo-Json -Depth 5); exit 4 }

# 2) Save parse threshold
Write-Host "\n2) POST save parse-threshold (0.9)" -ForegroundColor Cyan
$payload = @{ projectId = $PROJECT_ID; threshold = 0.9; scope = ($PROJECT_ID ? 'project' : 'user') }
$r = Invoke-Api -Method Post -Path '/api/settings/parse-threshold' -Body $payload -Token $TEST_TOKEN
if ($r.ok) { Write-Host ($r.resp | ConvertTo-Json -Depth 5) } else { Write-Host ($r | ConvertTo-Json -Depth 5); exit 5 }

# 3) Parse sample text
Write-Host "\n3) POST parse sample text" -ForegroundColor Cyan
$sample = 'Factura INV-123 por 150 USD a Juan Perez, vence 2025-12-31'
$r = Invoke-Api -Method Post -Path '/api/entries/parse' -Body @{ text = $sample } -Token $TEST_TOKEN
if (-not $r.ok) { Write-Host ($r | ConvertTo-Json -Depth 5); exit 6 }
Write-Host "Parse response:"; Write-Host ($r.resp | ConvertTo-Json -Depth 10)

# Decide invoice payload: if suggestion indicates INVOICE use it, otherwise create a simple invoice
$suggestion = $r.resp.data?.suggestion
if ($suggestion -and $suggestion.mode -and $suggestion.mode -match 'INVOICE') {
    Write-Host "Building invoice payload from suggestion..."
    $invoiceObj = @{
        code = $suggestion.invoiceCode -or ('INV-' + (Get-Random -Maximum 10000))
        type = 'INVOICE'
        issueDate = (Get-Date -Format 'yyyy-MM-dd')
        dueDate = ($suggestion.dueDate -or ((Get-Date).AddDays(30).ToString('yyyy-MM-dd')))
        currency = $suggestion.currency -or 'USD'
        total = $suggestion.amount -or 0
        lines = @()
        customerId = $null
        vendorId = $null
    }
    # if suggestion provides contactName we put it in notes (you can map to contactPerson lookup in your app)
    if ($suggestion.contactName) { $invoiceObj.notes = "Suggested contact: $($suggestion.contactName)" }
} else {
    Write-Host "No invoice suggestion received; creating a sample invoice payload..." -ForegroundColor Yellow
    $invoiceObj = @{
        code = 'INV-' + (Get-Random -Maximum 10000)
        type = 'INVOICE'
        issueDate = (Get-Date -Format 'yyyy-MM-dd')
        dueDate = ((Get-Date).AddDays(30).ToString('yyyy-MM-dd'))
        currency = 'USD'
        total = 150
        lines = @(@{ description = 'Servicio X'; quantity = 1; unitPrice = 150 })
        customerId = $null
    }
}

# 4) Create invoice
Write-Host "\n4) POST create invoice via /api/entries/create" -ForegroundColor Cyan
$createPayload = @{
    mode = 'INVOICE'
    projectId = $PROJECT_ID
    createdBy = 'script-test'
    invoice = $invoiceObj
    autoPost = $true
}
$r = Invoke-Api -Method Post -Path '/api/entries/create' -Body $createPayload -Token $TEST_TOKEN
if ($r.ok) {
    Write-Host "Create response:"; Write-Host ($r.resp | ConvertTo-Json -Depth 10)
} else {
    Write-Host "Create failed:"; Write-Host ($r | ConvertTo-Json -Depth 10); exit 7
}

Write-Host "\nScript finished successfully." -ForegroundColor Green
exit 0
