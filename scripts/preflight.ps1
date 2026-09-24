# Aestrial Impact Protocol - pre-flight de demo
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\preflight.ps1
# Comprueba que produccion, la base de datos y la testnet estan vivas antes de presentar.
# (Archivo ASCII a proposito: PowerShell 5.1 lo lee como ANSI y rompe con acentos.)

param(
  [string]$BaseUrl = "https://ong-pulso-omega.vercel.app",
  [string]$DefaultContract = "CCZBRUVFYUBH7DMWCQFL7LYO2V5UNVPSI2HAK7HCJA3IWCEE2QGFO5ZA"
)

$ErrorActionPreference = "SilentlyContinue"
$script:failed = 0

function Report([string]$name, [bool]$ok, [string]$detail = "") {
  $suffix = ""
  if ($detail -ne "") { $suffix = " - " + $detail }
  if ($ok) {
    Write-Host ("  [PASS] " + $name + $suffix) -ForegroundColor Green
  } else {
    Write-Host ("  [FAIL] " + $name + $suffix) -ForegroundColor Red
    $script:failed++
  }
}

$root = Split-Path -Parent $PSScriptRoot
$rootEnv = Join-Path $root ".env"
$owner = ""
if (Test-Path $rootEnv) {
  Get-Content $rootEnv | ForEach-Object {
    if ($_ -match '^OWNER_ADDRESS=(.+)$') { $owner = $matches[1].Trim() }
  }
}

Write-Host ""
Write-Host "AESTRIAL IMPACT PROTOCOL - pre-flight" -ForegroundColor Cyan
Write-Host ("Base: " + $BaseUrl)
Write-Host ""

# 1. Status del servidor
try {
  $s = Invoke-RestMethod -Uri "$BaseUrl/api/status" -TimeoutSec 30
  Report "API /api/status responde" $true
  Report "Storage = mongodb" ($s.storage -eq "mongodb") $s.storage
  Report "Deploy habilitado" ([bool]$s.deployEnabled) ("deployEnabled=" + $s.deployEnabled)
  Report "MONGODB_URI configurada" ([bool]$s.deployConfigured.mongodb) ("mongodb=" + $s.deployConfigured.mongodb)
  Report "Claves de deploy presentes" ($s.deployConfigured.secretKey -and $s.deployConfigured.ownerAddress -and $s.deployConfigured.deployToken)
  Report "Red = testnet" ($s.network -like "*testnet*") $s.network
} catch {
  Report "API /api/status responde" $false $_.Exception.Message
}

# 2. Indice de acuerdos (MongoDB)
try {
  $r = Invoke-RestMethod -Uri "$BaseUrl/api/agreements" -TimeoutSec 60
  $count = @($r.agreements).Count
  Report "GET /api/agreements" $true ("storage=" + $r.storage + " acuerdos=" + $count)
  Report "Indice con acuerdos" ($count -ge 1)
} catch {
  Report "GET /api/agreements" $false "503/timeout - Atlas pausado o IP bloqueada?"
}

# 3. Paginas
try {
  $h = Invoke-WebRequest -Uri "$BaseUrl/" -TimeoutSec 30 -UseBasicParsing
  Report "Home responde 200" ($h.StatusCode -eq 200)
} catch {
  Report "Home responde 200" $false $_.Exception.Message
}
try {
  Invoke-WebRequest -Uri "$BaseUrl/pagina-inexistente" -TimeoutSec 20 -UseBasicParsing | Out-Null
  Report "404 personalizado" $false "devolvio 200"
} catch {
  $code = 0
  if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
  Report "404 personalizado" ($code -eq 404) ("status=" + $code)
}

# 4. RPC Soroban testnet
try {
  $health = Invoke-RestMethod -Uri "https://soroban-testnet.stellar.org" -Method Post `
    -ContentType "application/json" -Body '{"jsonrpc":"2.0","id":1,"method":"getHealth","params":{}}' -TimeoutSec 30
  $st = $health.result.status
  Report "Soroban RPC testnet" (($st -eq "OK") -or ($st -eq "healthy")) $st
} catch {
  Report "Soroban RPC testnet" $false $_.Exception.Message
}

# 5. Horizon testnet
try {
  $hz = Invoke-RestMethod -Uri "https://horizon-testnet.stellar.org/" -TimeoutSec 30
  Report "Horizon testnet" ($null -ne $hz.horizon_version) ("v" + $hz.horizon_version)
} catch {
  Report "Horizon testnet" $false $_.Exception.Message
}

# 6. Contrato por defecto en la chain (stellar CLI si esta disponible)
$cli = Get-Command stellar -ErrorAction SilentlyContinue
if ($cli -and $owner) {
  $status = stellar contract invoke --id $DefaultContract --source-account $owner `
    --network testnet --send=no -- get_status 2>&1 | Out-String
  $ok = $status -match 'Active|Draft|Paused|Completed|Cancelled|Archived'
  Report "Contrato default on-chain (get_status)" $ok $status.Trim()
} else {
  Report "Contrato default on-chain (get_status)" $false "sin CLI o sin OWNER_ADDRESS"
}

# 7. Cuenta con fondos para fees
if ($owner) {
  try {
    $acct = Invoke-RestMethod -Uri "https://horizon-testnet.stellar.org/accounts/$owner" -TimeoutSec 30
    $xlm = [double](($acct.balances | Where-Object { $_.asset_type -eq "native" }).balance)
    Report "Cuenta deploy con saldo (>= 10 XLM)" ($xlm -ge 10) ("saldo=" + $xlm + " XLM")
  } catch {
    Report "Cuenta deploy con saldo (>= 10 XLM)" $false $_.Exception.Message
  }
}

Write-Host ""
if ($script:failed -eq 0) {
  Write-Host "TODO EN VERDE - listo para la demo." -ForegroundColor Green
} else {
  Write-Host ($script:failed + " comprobacion(es) fallando - revisa antes de presentar.") -ForegroundColor Red
}
Write-Host ""
exit $script:failed
