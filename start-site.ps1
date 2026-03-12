param(
  [string]$ProjectRoot = $PSScriptRoot
)

$ErrorActionPreference = "Stop"

function Get-EnvValue {
  param(
    [string]$FilePath,
    [string]$Key
  )

  if (!(Test-Path $FilePath)) {
    return ""
  }

  $line = Get-Content $FilePath | Where-Object { $_ -match "^$Key=" } | Select-Object -First 1
  if (!$line) {
    return ""
  }

  return $line.Substring($Key.Length + 1).Trim()
}

function Escape-SingleQuotes {
  param([string]$Value)
  return $Value -replace "'", "''"
}

function To-EncodedCommand {
  param([string]$CommandText)
  return [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($CommandText))
}

function Stop-ListeningOnPort {
  param(
    [int]$Port,
    [string]$Label
  )

  $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
  if ($listeners) {
    foreach ($listenerPid in $listeners) {
      Stop-Process -Id $listenerPid -Force -ErrorAction SilentlyContinue
    }
    Write-Host "${Label}: anciens process arretes sur le port $Port." -ForegroundColor Yellow
  }
}

$projectRootResolved = (Resolve-Path $ProjectRoot).Path
$webDir = Join-Path $projectRootResolved "web"
$webEnvPath = Join-Path $webDir ".env.local"

if (!(Test-Path $webDir)) {
  throw "Dossier web introuvable: $webDir"
}

$apiBaseUrl = Get-EnvValue -FilePath $webEnvPath -Key "PIPELINE_API_BASE_URL"
if ([string]::IsNullOrWhiteSpace($apiBaseUrl)) {
  $apiBaseUrl = "http://127.0.0.1:8000"
}

$apiToken = Get-EnvValue -FilePath $webEnvPath -Key "PIPELINE_API_TOKEN"
if ([string]::IsNullOrWhiteSpace($apiToken)) {
  $apiToken = $env:PIPELINE_API_TOKEN
}
if ([string]::IsNullOrWhiteSpace($apiToken)) {
  $apiToken = "mon_super_token_local"
  Write-Host "PIPELINE_API_TOKEN absent, fallback utilise: $apiToken" -ForegroundColor Yellow
}

$uri = [System.Uri]$apiBaseUrl
$backendHost = $uri.Host
$backendPort = $uri.Port
$healthUrl = $apiBaseUrl.TrimEnd("/") + "/healthz"
Stop-ListeningOnPort -Port $backendPort -Label "Backend"

$nextDevNode = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
  Where-Object {
    $_.CommandLine -like "*next*dev*" -and $_.CommandLine -like "*alternance-mails-v2\\web*"
  }
if ($nextDevNode) {
  $nextDevNode | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Write-Host "Frontend: anciens process next dev arretes." -ForegroundColor Yellow
}

$nextLock = Join-Path $webDir ".next\dev\lock"
if (Test-Path $nextLock) {
  Remove-Item $nextLock -Force -ErrorAction SilentlyContinue
}

$escapedRoot = Escape-SingleQuotes $projectRootResolved
$escapedWeb = Escape-SingleQuotes $webDir
$escapedToken = Escape-SingleQuotes $apiToken
$pythonExe = (Get-Command python -ErrorAction Stop).Source
$escapedPython = Escape-SingleQuotes $pythonExe

try {
  & $pythonExe -c "import uvicorn" | Out-Null
} catch {
  throw "uvicorn n'est pas installe sur cet interpreteur Python ($pythonExe). Installe-le: python -m pip install uvicorn fastapi"
}

$backendCommand = @"
`$Host.UI.RawUI.WindowTitle = 'Alternance Backend'
Set-Location '$escapedRoot'
`$env:PIPELINE_API_TOKEN = '$escapedToken'
`$env:API_TOKEN = '$escapedToken'
& '$escapedPython' -m uvicorn backend_api:app --host $backendHost --port $backendPort
"@

$frontendCommand = @"
`$Host.UI.RawUI.WindowTitle = 'Alternance Frontend'
Set-Location '$escapedWeb'
`$env:PIPELINE_API_BASE_URL = '$apiBaseUrl'
`$env:PIPELINE_API_TOKEN = '$escapedToken'
`$env:API_TOKEN = '$escapedToken'
npm run dev
"@

$backendEncoded = To-EncodedCommand $backendCommand
$frontendEncoded = To-EncodedCommand $frontendCommand

Start-Process powershell -ArgumentList "-NoExit", "-EncodedCommand", $backendEncoded | Out-Null

for ($i = 0; $i -lt 15; $i++) {
  Start-Sleep -Seconds 1
  try {
    $health = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 2
    if ($health.ok -eq $true) {
      $backendUp = $true
      break
    }
  } catch {
    # Retry until timeout.
  }
}

Start-Process powershell -ArgumentList "-NoExit", "-EncodedCommand", $frontendEncoded | Out-Null

Write-Host ""
Write-Host "Backend:  $apiBaseUrl" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000 (ou port auto si deja pris)" -ForegroundColor Green
Write-Host "Token source: $webEnvPath" -ForegroundColor DarkGray
Write-Host ""
if ($backendUp) {
  Write-Host "API OK: healthcheck reussi." -ForegroundColor Green
} else {
  Write-Host "API non detectee apres 15s. Ouvre le terminal 'Alternance Backend' pour voir l'erreur exacte." -ForegroundColor Yellow
  Write-Host "Commande backend attendue: $pythonExe -m uvicorn backend_api:app --host $backendHost --port $backendPort" -ForegroundColor Yellow
}
Write-Host "Deux terminaux ont ete ouverts (backend + frontend)." -ForegroundColor Cyan
