# verify.ps1 — Verificación y Fast Gate Universal (.agents)
# Adaptativo por proyecto: detecta automáticamente stack (Node/TypeScript, Cargo/Rust, Python)
# y ejecuta linters, typechecks, suites de test y anti-drift gates.

param(
    [switch]$Quick,
    [switch]$SkipTests,
    [switch]$TypeCheckOnly,
    [switch]$IncludeCoverage
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
    Write-Host "== Invocando Verificación Rápida de Proyecto ==" -ForegroundColor Cyan
    Write-Host "Workspace: $ProjectRoot" -ForegroundColor DarkGray

    # 1. Anti-drift de referencias de agentes
    $refChecker = Join-Path $PSScriptRoot "check-agents-refs.ps1"
    if (Test-Path $refChecker) {
        run-step "check-agents-refs" {
            powershell -NoProfile -File $refChecker
        }
    }

    # 2. Proyecto Node / TypeScript (Ego stack)
    if (Test-Path "$ProjectRoot\package.json") {
        $pkg = Get-Content "$ProjectRoot\package.json" -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue
        $scripts = if ($pkg -and $pkg.scripts) { $pkg.scripts } else { @{} }
        
        $pm = "npm"
        if (Test-Path "$ProjectRoot\pnpm-lock.yaml") {
            if (Get-Command "pnpm" -ErrorAction SilentlyContinue) { $pm = "pnpm" }
            elseif (Get-Command "pnpm.cmd" -ErrorAction SilentlyContinue) { $pm = "pnpm.cmd" }
            else { $pm = "npx pnpm" }
        } elseif (Test-Path "$ProjectRoot\yarn.lock") {
            $pm = if (Get-Command "yarn" -ErrorAction SilentlyContinue) { "yarn" } else { "npx yarn" }
        }

        # Typecheck
        if ($scripts.PSObject.Properties.Name -contains "typecheck") {
            run-step "typecheck ($pm run typecheck)" { cmd /c "$pm run typecheck" }
        } elseif (Test-Path "$ProjectRoot\tsconfig.json") {
            run-step "typecheck (npx tsc --noEmit)" { cmd /c "npx tsc --noEmit" }
        } elseif (Test-Path "$ProjectRoot\apps\desktop\tsconfig.json") {
            run-step "typecheck (apps/desktop)" { cmd /c "npx tsc --noEmit -p apps/desktop" }
        }

        if (-not $TypeCheckOnly) {
            # Lint
            if ($scripts.PSObject.Properties.Name -contains "lint") {
                run-step "lint ($pm run lint)" { cmd /c "$pm run lint" }
            }

            # Tests
            if (-not $SkipTests -and ($scripts.PSObject.Properties.Name -contains "test")) {
                run-step "test ($pm test)" { cmd /c "$pm test" }
            }
        }
    }

    # 3. Proyecto Cargo / Rust (si aplica)
    if (Test-Path "$ProjectRoot\Cargo.toml") {
        run-step "cargo check" { cargo check }
        if (-not $TypeCheckOnly -and -not $SkipTests) {
            run-step "cargo test" { cargo test }
        }
    }

    # 4. Proyecto Python (si aplica)
    if ((Test-Path "$ProjectRoot\pyproject.toml") -or (Test-Path "$ProjectRoot\pytest.ini")) {
        if (-not $TypeCheckOnly -and -not $SkipTests) {
            if (Get-Command "pytest" -ErrorAction SilentlyContinue) {
                run-step "pytest" { pytest }
            }
        }
    }

    Write-Host "ALL ${pass} PASS" -ForegroundColor Green
    exit 0
} catch {
    if ($fail -eq 0) { $fail = 1 }
    Write-Host "${fail} FAIL" -ForegroundColor Red
    exit 1
}
