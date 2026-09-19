$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $root
try {
  Push-Location backend
  npm run build
  Pop-Location

  Push-Location frontend
  $env:VITE_BASE_URL = "/projects/cinecruzeiro/admin/whatsapp/"
  npm run build
  Pop-Location

  $target = Join-Path $root "..\backend\public\whatsapp"
  New-Item -ItemType Directory -Path $target -Force | Out-Null
  Copy-Item -Path (Join-Path $root "frontend\dist\*") -Destination $target -Recurse -Force

  Write-Host "Build concluido. Publique pelo deploy coordenado do Cine Cruzeiro e siga WhatsApp API/DEPLOY.md para atualizar o serviço privado." -ForegroundColor Green
} finally {
  Pop-Location
}
