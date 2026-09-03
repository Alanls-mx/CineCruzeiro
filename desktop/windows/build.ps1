param(
  [ValidateSet("Debug", "Release")]
  [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Solution = Join-Path $Root "CineCruzeiroDesktop.sln"
$NuGet = Join-Path $env:TEMP "cine-cruzeiro-nuget.exe"
$VsWhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"

if (-not (Test-Path $VsWhere)) {
  throw "Visual Studio 2022 com o componente Desenvolvimento para desktop com C++ não foi encontrado."
}

$MsBuild = & $VsWhere -latest -products * -requires Microsoft.Component.MSBuild -find MSBuild\**\Bin\MSBuild.exe | Select-Object -First 1
if (-not $MsBuild) { throw "MSBuild não foi encontrado." }

if (-not (Test-Path $NuGet)) {
  Invoke-WebRequest "https://dist.nuget.org/win-x86-commandline/latest/nuget.exe" -OutFile $NuGet
}

& $NuGet restore $Solution -PackagesDirectory (Join-Path $Root "packages") -NonInteractive
if ($LASTEXITCODE -ne 0) { throw "Falha ao restaurar o SDK WebView2." }

& $MsBuild $Solution /m /p:Configuration=$Configuration /p:Platform=x64 /restore:false
if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar o painel desktop." }

$Output = Join-Path $Root "build\$Configuration"
Write-Host "Painel compilado em $Output" -ForegroundColor Green
