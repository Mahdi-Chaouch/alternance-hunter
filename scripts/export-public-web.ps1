param(
  [Parameter(Mandatory = $true)]
  [string]$PublicRepoUrl,
  [string]$Branch = "main",
  [string]$Prefix = "web",
  [switch]$ForcePush
)

$ErrorActionPreference = "Stop"

function Require-Git {
  try {
    git --version | Out-Null
  } catch {
    throw "Git n'est pas disponible dans le PATH."
  }
}

Require-Git

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

# Validate that prefix exists in current repo.
$prefixPath = Join-Path $repoRoot $Prefix
if (!(Test-Path $prefixPath)) {
  throw "Prefix introuvable: $Prefix"
}

Write-Host "Export du sous-dossier '$Prefix' vers '$PublicRepoUrl' (branche '$Branch')..." -ForegroundColor Cyan

$splitBranch = "public-split-temp"

# Recreate temp branch from subtree split.
git branch -D $splitBranch 2>$null | Out-Null
$splitCommit = (git subtree split --prefix="$Prefix" HEAD).Trim()
if ([string]::IsNullOrWhiteSpace($splitCommit)) {
  throw "Impossible de creer un split pour '$Prefix'."
}

git branch $splitBranch $splitCommit | Out-Null

$remoteName = "public-web-temp"
$existingRemote = git remote
if ($existingRemote -contains $remoteName) {
  git remote remove $remoteName
}

git remote add $remoteName $PublicRepoUrl

try {
  $pushArgs = @("push")
  if ($ForcePush) {
    $pushArgs += "--force-with-lease"
  }
  $pushArgs += @($remoteName, "$splitBranch`:$Branch")
  git @pushArgs
  Write-Host "Publication terminee." -ForegroundColor Green
  Write-Host "Repo public mis a jour: $PublicRepoUrl ($Branch)" -ForegroundColor Green
} finally {
  git remote remove $remoteName
}

