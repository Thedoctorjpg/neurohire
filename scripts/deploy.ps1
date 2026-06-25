# NeuroHire deployment helper — run after authenticating with your chosen platform.
# Usage examples:
#   .\scripts\deploy.ps1 -Platform render
#   .\scripts\deploy.ps1 -Platform railway
#   .\scripts\deploy.ps1 -Platform fly

param(
  [ValidateSet('render', 'railway', 'fly')]
  [string]$Platform = 'render'
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

switch ($Platform) {
  'render' {
    Write-Host 'Render: push to GitHub, then in Render dashboard create a Blueprint from render.yaml'
    Write-Host 'Repo: https://github.com/Thedoctorjpg/neurohire'
    Write-Host 'Set ADMIN_TOKEN in the Render service environment after first deploy.'
  }
  'railway' {
    cmd /c "npx.cmd @railway/cli link"
    cmd /c "npx.cmd @railway/cli up --detach"
    Write-Host 'Set ADMIN_TOKEN: npx @railway/cli variables set ADMIN_TOKEN=<secret>'
  }
  'fly' {
    if (-not (Get-Command fly -ErrorAction SilentlyContinue)) {
      Write-Host 'Install flyctl: https://fly.io/docs/hands-on/install-flyctl/'
      exit 1
    }
    fly auth login
    fly launch --no-deploy --copy-config
    fly volumes create neurohire_data --region syd --size 1
    fly secrets set ADMIN_TOKEN=(openssl rand -hex 32)
    fly deploy
  }
}