#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Lanza la auditoría de diseño del renderer de Ego.

.DESCRIPTION
  Hay DOS caminos, y ambos comparten el MISMO spec (selectores, contrato y
  medición) — `apps/desktop/scripts/design-audit-spec.mjs`:

    1. **ego-browser (ego lite)** — el camino de REFERENCIA: ve la app real
       con su ventana real. El runtime de ego-browser expone
       `taskSpace`/`help` como globales: el script NO puede ejecutarse con
       `node` plano. Además, ese runtime embebido **no hereda
       `process.env`** del proceso padre, así que la configuración viaja por
       un fichero JSON en `os.tmpdir()` (la misma ruta que calcula el
       script con `tmpdir()`).

    2. **Chromium headless (Playwright)** — el camino de RESCATE. No depende
       del compositor de ego lite, que **puede dejar de producir frames**
       (la corrida anterior dio 0/6 por el compositor, no por los
       selectores). "Reiniciar la app" no es un plan: este camino sí lo es.

  El wrapper:
    1. localiza el binario de ego-browser y lo pone en el PATH (el onboarding
       lo registra en el PATH de USUARIO, pero una terminal ya abierta
       conserva el PATH antiguo → "no se encuentra el comando"),
    2. escribe la configuración en el JSON (la comparten los dos caminos),
    3. invoca `ego-browser nodejs` con una entrada de UNA LÍNEA y sin comillas
       dobles (Windows PowerShell 5.1 rompe las comillas dobles en los
       argumentos a programas nativos),
    4. **si ese camino no produce un informe con pasos** (compositor muerto,
       runtime ausente), cae al camino headless en vez de perder la corrida,
    5. propaga el código de salida real, que viaja en `report.json`.

  Códigos de salida: 0 = sin infracciones · 1 = infracciones · 2 = fallo.

.PARAMETER Headless
  Fuerza el camino de rescate (Chromium headless) y NO intenta ego lite.

.EXAMPLE
  pwsh -File apps/desktop/scripts/run-design-audit.ps1 -Out C:\temp\ego-audit

.EXAMPLE
  pwsh -File apps/desktop/scripts/run-design-audit.ps1 -Headless
#>
[CmdletBinding()]
param(
  [string]$Url = 'http://127.0.0.1:5173/',
  [string]$Out = "$env:TEMP\ego-audit",
  [string]$Steps = '',
  [int]$Width = 1512,
  [int]$Height = 950,
  [int]$TimeoutSeconds = 30,
  [switch]$Headless
)

$ErrorActionPreference = 'Stop'

$reportPath = Join-Path $Out 'report.json'

# 0) Configuración (el runtime embebido de ego lite no ve process.env; el
#    camino headless lee el MISMO JSON → los dos caminos son comparables).
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

# 1) Localizar el binario de ego-browser (camino de referencia).
$exe = $null
$binDir = Join-Path $HOME '.local\share\ego\active_version_dir'
$candidate = Join-Path $binDir 'ego-browser.exe'
if (Test-Path $candidate) {
  $exe = $candidate
} else {
  $cmd = Get-Command ego-browser -ErrorAction SilentlyContinue
  if ($cmd) {
    $exe = $cmd.Source
    $binDir = Split-Path $exe -Parent
  }
}
if ($exe) { $env:Path = "$binDir;$env:Path" }

# 2) Estado del compositor de ego lite.
#
#    Ola 5 · T4: si el compositor no produce frames, la corrida se pierde
#    (0/6 capturas y un informe que no distingue "el compositor murió" de
#    "la app está rota"). Se guarda el estado en un fichero: mientras siga
#    muerto, NO se intenta de nuevo (cada intento cuesta ~30 s y no puede
#    dar nada) y se cae al camino de rescate con un aviso explícito.
$statePath = Join-Path ([System.IO.Path]::GetTempPath()) 'ego-audit-compositor.json'
$compositorDead = $false
if (Test-Path $statePath) {
  try {
    $state = Get-Content $statePath -Raw | ConvertFrom-Json
    if ($state.dead -eq $true) {
      $ageHours = ((Get-Date) - ([DateTime]::Parse($state.at))).TotalHours
      if ($ageHours -lt 24) { $compositorDead = $true }
    }
  } catch {
    # Estado ilegible: se reintenta (no se fía de un fichero corrupto).
  }
}

# 3) Ejecutar el camino de referencia (ego lite), si procede.
$runtimeExit = 2
if (-not $Headless -and $compositorDead) {
  Write-Host '[audit] el compositor de ego lite se sabe MUERTO (última comprobación en las últimas 24 h): se usa el camino de rescate.'
  $needFallback = $true
} elseif (-not $Headless) {
  if (-not $exe) {
    Write-Warning "ego-browser no encontrado: se usará el camino de rescate (Chromium headless)."
  } else {
    # La entrada de UNA línea: sin comillas dobles (trampa de PS 5.1).
    $script = Resolve-Path (Join-Path $PSScriptRoot 'ego-browser-audit.mjs')
    $uri = 'file:///' + ($script.Path -replace '\\', '/')
    $entry = "await import('$uri')"

    & $exe nodejs -e $entry
    $runtimeExit = $LASTEXITCODE
  }
}

# 4) ¿El camino de referencia produjo un informe CON pasos? Si no (compositor
#    muerto, runtime ausente, tiempo agotado), se cae al camino de rescate.
#    OJO: `stepsOk === 0` con `stepsTotal > 0` es el fallo CLÁSICO del
#    compositor (`Page.captureScreenshot` expira en los 6 pasos): el informe
#    decía "0 infracciones" y salía verde sin haber auditado nada.
$needFallback = $Headless -or (-not (Test-Path $reportPath))
if (-not $needFallback) {
  try {
    $r = Get-Content $reportPath -Raw | ConvertFrom-Json
    if (-not $r.summary -or $r.summary.stepsTotal -eq 0 -or $r.summary.stepsOk -eq 0) {
      $needFallback = $true
    }
  } catch {
    $needFallback = $true
  }
}

# 5) Si el camino de referencia no dio pasos, el compositor está muerto: se
#    deja constancia (con fecha) para no volver a intentarlo en cada corrida.
if ($needFallback -and -not $Headless -and -not $compositorDead) {
  try {
    @{ dead = $true; at = (Get-Date).ToString('o') } |
      ConvertTo-Json | Set-Content -Path $statePath -Encoding UTF8
    Write-Host '[audit] el compositor de ego lite no produjo frames: se marca como muerto (24 h sin reintento) y se usa el camino de rescate.'
  } catch {
    # Best-effort: si no se puede guardar el estado, la corrida sigue.
  }
}

if ($needFallback) {
  Write-Host '[audit] camino de rescate: Chromium headless (no depende del compositor de ego lite).'
  # OJO: la variable local NO puede llamarse `$headless` (PowerShell no
  # distingue mayúsculas → colisionaría con el switch `$Headless` y el
  # binding fallaría al asignarle un string).
  $headlessScript = Join-Path $PSScriptRoot 'design-audit-headless.mjs'
  & node $headlessScript
  $runtimeExit = $LASTEXITCODE
}

# 4) Propagar el código de salida real (viene en report.json).
if (Test-Path $reportPath) {
  try {
    $report = Get-Content $reportPath -Raw | ConvertFrom-Json
    Write-Host ''
    Write-Host "[audit] runner: $($report.runner)"
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
