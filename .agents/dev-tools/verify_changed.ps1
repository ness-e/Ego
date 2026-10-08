# verify_changed.ps1 — Verificación Rápida de Archivos Modificados (.agents)
param(
    [string]$BaseRef = "HEAD"
)

$ErrorActionPreference = "Stop"

# Resolución dinámica de la raíz del proyecto (fuera de .agents)
$ProjectRoot = $PSScriptRoot
while ($ProjectRoot -and (Split-Path -Leaf $ProjectRoot) -ne ".agents") {
    $parent = Split-Path -Parent $ProjectRoot
    if ($parent -eq $ProjectRoot -or [string]::IsNullOrEmpty($parent)) { break }
    $ProjectRoot = $parent
}
if ($ProjectRoot -and (Split-Path -Leaf $ProjectRoot) -eq ".agents") {
    $ProjectRoot = Split-Path -Parent $ProjectRoot
}
Set-Location $ProjectRoot

$pass = 0
$fail = 0

function run-step($name, [scriptblock]$action) {
    Write-Host "  ${name}..." -ForegroundColor Yellow -NoNewline
    try {
        & $action
        if ($LASTEXITCODE -eq 0 -or $null -eq $LASTEXITCODE) {
            Write-Host " ok" -ForegroundColor Green
            $script:pass++
        } else {
            Write-Host " FAIL (exit code $LASTEXITCODE)" -ForegroundColor Red
            $script:fail++
            throw "Step '$name' falló con código de salida $LASTEXITCODE"
        }
    } catch {
        Write-Host " FAIL" -ForegroundColor Red
        Write-Host "    $($_.Exception.Message)" -ForegroundColor Red
        $script:fail++
        throw $_
    }
}

try {
    Write-Host "== Invocando Verificación Rápida de Cambios (Diff-scoped) ==" -ForegroundColor Cyan
    $changed = git diff --name-only $BaseRef 2>$null
    if (-not $changed) {
        $changed = git diff --name-only HEAD~1 2>$null
    }

    if (-not $changed) {
        Write-Host "Sin cambios detectados contra $BaseRef." -ForegroundColor Green
        exit 0
    }

    $changedList = @($changed | Where-Object { $_ -and $_.Trim() -ne "" })
    Write-Host "Archivos modificados: $($changedList.Count)" -ForegroundColor DarkGray

    # 1. CodeGraph blast radius (si está instalado y configurado)
    $cg = Get-Command "codegraph" -ErrorAction SilentlyContinue
    if ($cg -and (Test-Path "$ProjectRoot\.codegraph\codegraph.db")) {
        $affected = $changedList | & "codegraph" affected --stdin --quiet 2>$null
        if ($affected) { Write-Host "  CodeGraph affected: $($affected.Count) files" -ForegroundColor Magenta }
    }

    # 2. Anti-drift de AGENTS.md si fue modificado
    if ($changedList -match 'AGENTS\.md$') {
        $refChecker = Join-Path $PSScriptRoot "check-agents-refs.ps1"
        if (Test-Path $refChecker) {
            run-step "check-agents-refs" {
                powershell -NoProfile -File $refChecker
            }
        }
    }

    # 3. Floor Guard para diff
    $floorGuard = Join-Path $PSScriptRoot "floor-guard.ps1"
    if (Test-Path $floorGuard) {
        run-step "floor-guard" {
            powershell -NoProfile -File $floorGuard -DiffOnly
        }
    }

    # 4. Scope Node / TypeScript
    $tsFiles = @($changedList | Where-Object { $_ -match '\.(ts|tsx|js|jsx|json)$' })
    if ($tsFiles.Count -gt 0 -and (Test-Path "$ProjectRoot\package.json")) {
        $pm = if (Test-Path "$ProjectRoot\pnpm-lock.yaml") { "pnpm" } elseif (Test-Path "$ProjectRoot\yarn.lock") { "yarn" } else { "npm" }
        $pkg = Get-Content "$ProjectRoot\package.json" -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue
        $scripts = if ($pkg -and $pkg.scripts) { $pkg.scripts } else { @{} }

        if ($scripts.PSObject.Properties.Name -contains "typecheck") {
            run-step "typecheck ($pm run typecheck)" { & $pm run typecheck }
        } elseif (Test-Path "$ProjectRoot\tsconfig.json") {
            run-step "typecheck (tsc --noEmit)" { npx tsc --noEmit }
        } elseif (Test-Path "$ProjectRoot\apps\desktop\tsconfig.json") {
            run-step "typecheck (apps/desktop)" { npx tsc --noEmit -p apps/desktop }
        }
    }

    # 5. Scope Rust / Cargo
    $rsFiles = @($changedList | Where-Object { $_ -match '\.(rs|toml)$' })
    if ($rsFiles.Count -gt 0 -and (Test-Path "$ProjectRoot\Cargo.toml")) {
        run-step "cargo check" { cargo check }
    }

    Write-Host "ALL ${pass} PASS" -ForegroundColor Green
    exit 0
} catch {
    if ($fail -eq 0) { $fail = 1 }
    Write-Host "${fail} FAIL" -ForegroundColor Red
    exit 1
}
