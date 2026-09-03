param(
  [string]$Version = "1.1.0",
  [string]$Notes = "Tela cheia, atualização automática e identificação de dispositivos locais."
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path (Split-Path $Root -Parent) -Parent
$Output = Join-Path $Root "build\Release"
$PublicRoot = Join-Path $ProjectRoot "backend\public\downloads\desktop"
$ReleaseRoot = Join-Path $PublicRoot $Version
$PublicBase = "https://lumixengine.com/projects/cinecruzeiro/downloads/desktop"

& (Join-Path $Root "build.ps1") -Configuration Release
if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar a atualização." }

New-Item -ItemType Directory -Force $ReleaseRoot | Out-Null
Copy-Item (Join-Path $Output "CineCruzeiroDesktop.exe") $ReleaseRoot -Force
Copy-Item (Join-Path $Output "WebView2Loader.dll") $ReleaseRoot -Force

$ExeHash = (Get-FileHash (Join-Path $ReleaseRoot "CineCruzeiroDesktop.exe") -Algorithm SHA256).Hash.ToLowerInvariant()
$LoaderHash = (Get-FileHash (Join-Path $ReleaseRoot "WebView2Loader.dll") -Algorithm SHA256).Hash.ToLowerInvariant()
$Manifest = @"
[update]
version=$Version
exe_url=$PublicBase/$Version/CineCruzeiroDesktop.exe
exe_sha256=$ExeHash
loader_url=$PublicBase/$Version/WebView2Loader.dll
loader_sha256=$LoaderHash
notes=$Notes
"@

Set-Content -LiteralPath (Join-Path $PublicRoot "latest.ini") -Value $Manifest -Encoding utf8NoBOM
Write-Host "Atualização $Version publicada em backend/public/downloads/desktop" -ForegroundColor Green
