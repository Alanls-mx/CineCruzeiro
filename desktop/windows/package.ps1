param(
  [ValidateSet("Debug", "Release")]
  [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Output = Join-Path $Root "build\$Configuration"
$ArtifactDirectory = Join-Path (Split-Path (Split-Path $Root -Parent) -Parent) "artifacts\desktop"
$PackageDirectory = Join-Path $ArtifactDirectory "Painel-Cine-Cruzeiro"
$Archive = Join-Path $ArtifactDirectory "Painel-Cine-Cruzeiro-Windows-x64.zip"

& (Join-Path $Root "build.ps1") -Configuration $Configuration
if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar antes do empacotamento." }

New-Item -ItemType Directory -Force $PackageDirectory | Out-Null
Copy-Item (Join-Path $Output "CineCruzeiroDesktop.exe") $PackageDirectory -Force
Copy-Item (Join-Path $Output "WebView2Loader.dll") $PackageDirectory -Force
Copy-Item (Join-Path $Root "README.md") (Join-Path $PackageDirectory "LEIA-ME.md") -Force

if (Test-Path $Archive) { Remove-Item -LiteralPath $Archive -Force }
Compress-Archive -Path (Join-Path $PackageDirectory "*") -DestinationPath $Archive -CompressionLevel Optimal
Write-Host "Pacote criado em $Archive" -ForegroundColor Green
