param(
  [string]$ProjectRoot = $PSScriptRoot,
  [string]$ApiBaseUrl = "http://127.0.0.1:8000"
)

$ErrorActionPreference = "Stop"

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
    Write-Host "${Label}: process arretes sur le port $Port." -ForegroundColor Yellow
    return
  }

  Write-Host "${Label}: aucun process en ecoute sur le port $Port." -ForegroundColor DarkGray
}

$projectRootResolved = (Resolve-Path $ProjectRoot).Path
$webDir = Join-Path $projectRootResolved "web"

$uri = [System.Uri]$ApiBaseUrl
$backendPort = $uri.Port

# 1) Stop backend listener
Stop-ListeningOnPort -Port $backendPort -Label "Backend"

# 2) Stop next dev node processes for this project
$nextDevNode = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
  Where-Object {
    $_.CommandLine -like "*next*dev*" -and $_.CommandLine -like "*alternance-mails-v2\\web*"
  }
if ($nextDevNode) {
  $nextDevNode | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Write-Host "Frontend: process next dev arretes." -ForegroundColor Yellow
} else {
  Write-Host "Frontend: aucun process next dev detecte." -ForegroundColor DarkGray
}

# 3) Remove stale lock file
$nextLock = Join-Path $webDir ".next\dev\lock"
if (Test-Path $nextLock) {
  Remove-Item $nextLock -Force -ErrorAction SilentlyContinue
  Write-Host "Frontend: lock .next/dev/lock supprime." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Site stoppe (backend + frontend)." -ForegroundColor Green
