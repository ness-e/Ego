#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Lanza la auditoría de diseño del renderer de Ego con ego-browser (ego lite).

.DESCRIPTION
  El runtime de ego-browser expone `taskSpace`/`help` como globales: el
  script NO puede ejecutarse con `node` plano. Además, ese runtime embebido
  **no hereda `process.env`** del proceso padre, así que la configuración
  viaja por un fichero JSON en `os.tmpdir()` (la misma ruta que calcula el
  script con `tmpdir()`).

  Este wrapper:
    1. localiza el binario de ego-browser y lo pone en el PATH (el onboarding
       lo registra en el PATH de USUARIO, pero una terminal ya abierta
       conserva el PATH antiguo → "no se encuentra el comando"),
    2. escribe la configuración en el JSON,
    3. invoca `ego-browser nodejs` con una entrada de UNA LÍNEA y sin comillas
       dobles (Windows PowerShell 5.1 rompe las comillas dobles en los
       argumentos a programas nativos),
    4. propaga el código de salida real, que viaja en `report.json`.

  Códigos de salida: 0 = sin infracciones · 1 = infracciones · 2 = fallo.

.EXAMPLE
  pwsh -File apps/desktop/scripts/run-design-audit.ps1 -Out C:\temp\ego-audit
#>
[CmdletBinding()]
param(
  [string]$Url = 'http://127.0.0.1:5173/',
  [string]$Out = "$env:TEMP\ego-audit",
  [string]$Steps = '',
  [int]$Width = 1512,
  [int]$Height = 950,
  [int]$TimeoutSeconds = 30
)

$ErrorActionPreference = 'Stop'

# 1) Localizar el binario de ego-browser.
$binDir = Join-Path $HOME '.local\share\ego\active_version_dir'
$exe = Join-Path $binDir 'ego-browser.exe'
if (-not (Test-Path $exe)) {
  $cmd = Get-Command ego-browser -ErrorAction SilentlyContinue
  if ($cmd) { $exe = $cmd.Source; $binDir = Split-Path $exe -Parent }
  else {
    Write-Error "ego-browser no encontrado. Abre ego lite (lite.ego.app), completa el onboarding y reintenta."
    exit 2
  }
}
$env:Path = "$binDir;$env:Path"

# 2) Configuración (el runtime embebido no ve process.env).
$cfg = @{
  url        = $Url
  dir        = $Out
  width      = $Width
  height     = $Height
  timeoutMs  = $TimeoutSeconds * 1000
}
if ($Steps) { $cfg['stepsFile'] = (Resolve-Path $Steps).Path }
$cfgPath = Join-Path ([System.IO.Path]::GetTempPath()) 'ego-audit-config.json'
$cfg | ConvertTo-Json | Set-Content -Path $cfgPath -Encoding UTF8

# 3) La entrada de UNA línea: sin comillas dobles (trampa de PS 5.1).
$script = Resolve-Path (Join-Path $PSScriptRoot 'ego-browser-audit.mjs')
$uri = 'file:///' + ($script.Path -replace '\\', '/')
$entry = "await import('$uri')"

# 4) Ejecutar y propagar el código de salida real (viene en report.json).
& $exe nodejs -e $entry
$runtimeExit = $LASTEXITCODE

$reportPath = Join-Path $Out 'report.json'
if (Test-Path $reportPath) {
  try {
    $report = Get-Content $reportPath -Raw | ConvertFrom-Json
    Write-Host ''
    Write-Host "[audit] $($report.summary.stepsOk)/$($report.summary.stepsTotal) pasos ok"
    Write-Host "[audit] infracciones: $($report.summary.totalViolations) $($report.summary.byRule | ConvertTo-Json -Compress)"
    $shots = @($report.steps | Where-Object { $_.screenshot }).Count
    Write-Host "[audit] capturas: $shots · maximizada: $($report.window.maximized) · viewport forzado: $($report.viewportForced)"
    exit [int]$report.exitCode
  } catch {
    Write-Warning "no se pudo leer report.json: $_"
  }
}
exit $runtimeExit
