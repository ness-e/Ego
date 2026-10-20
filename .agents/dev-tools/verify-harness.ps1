<#
.SYNOPSIS
  Gate único de salud del rack de agentes (T11 / EGO-FIND-64 parcial).

.DESCRIPTION
  Ejecuta las TRES comprobaciones que hasta ahora vivían separadas:

    1. `sync-opencode-agents.ps1 -Check`  → drift `.agents/` vs `.opencode/`
    2. `check-agents-refs.ps1`             → referencias stale en AGENTS.md
    3. `node scripts/verify-harness.mjs`   → frontmatter de `.opencode/agents/*.md`
                                             válido para OpenCode (description +
                                             mode + permission con claves
                                             soportadas) + paridad de comandos.

  La 3ª es un script Node (cross-platform) porque el frontmatter generado es
  lo que OpenCode consume: si una clave de `permission` no está soportada o
  falta `description`, el agente NO se registra — y eso no lo detectaba el
  drift textual ni el anti-stale de referencias.

  Cualquier fallo → exit 1. Sin fallos → exit 0.

.EXAMPLE
  pwsh -NoProfile -ExecutionPolicy Bypass -File .agents/dev-tools/verify-harness.ps1
#>
[CmdletBinding()]
param(
    [switch]$SkipNode   # Omite la comprobacion 3 (si `node` no esta en el PATH)
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$failures = 0

function Invoke-Step {
    param(
        [string]$Name,
        [scriptblock]$Action
    )
    Write-Host "== $Name" -ForegroundColor Cyan
    try {
        & $Action
        if ($LASTEXITCODE -ne 0) {
            Write-Host "   -> FALLO (exit $LASTEXITCODE)" -ForegroundColor Red
            $script:failures++
        } else {
            Write-Host "   -> OK" -ForegroundColor Green
        }
    } catch {
        Write-Host "   -> ERROR: $_" -ForegroundColor Red
        $script:failures++
    }
}

Invoke-Step "1/3 drift .agents/ vs .opencode/ (sync-opencode-agents -Check)" {
    & pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "sync-opencode-agents.ps1") -Check
}

Invoke-Step "2/3 referencias stale en AGENTS.md (check-agents-refs)" {
    & pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "check-agents-refs.ps1")
}

if ($SkipNode) {
    Write-Host "== 3/3 frontmatter OpenCode: OMITIDA (-SkipNode)" -ForegroundColor Yellow
} else {
    Invoke-Step "3/3 frontmatter OpenCode valido + paridad de comandos (verify-harness.mjs)" {
        & node (Join-Path $RepoRoot "scripts\verify-harness.mjs")
    }
}

if ($failures -gt 0) {
    Write-Host "verify-harness: $failures comprobacion(es) fallida(s)" -ForegroundColor Red
    exit 1
}
Write-Host "verify-harness: OK (3/3)" -ForegroundColor Green
exit 0
