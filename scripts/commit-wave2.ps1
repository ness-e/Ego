# Re-division atomica de la Ola 2 + commit del trabajo paralelo de design system.
# Contexto: 0ac5918 son 142 ficheros / +15.096 lineas etiquetados como
# "split main process" -> violacion de la atomicidad de AGENTS.md §5.
# Nada esta publicado (origin/master = 330abdb, anterior a la Ola 1), asi que
# el reset --soft es seguro: no se reescribe historia publicada.
$ErrorActionPreference = "Stop"
Set-Location (Get-Location).Path

$commits = @(
  @{ p = @(
      "packages/avatar",
      "apps/desktop/renderer/floating/vendor/avatar"
    ); m = "fix(avatar): add the warning state and make the studio bridge contract explicit" },

  @{ p = @(
      "packages/runtime", "packages/events"
    ); m = "feat(runtime): execute tool calls concurrently while preserving the tool_use/tool_result order" },

  @{ p = @(
      "packages/tool-call-repair/src", "packages/tool-call-repair/LICENSE.md",
      "packages/knowledge/src"
    ); m = "chore(license): attribute the adapted patterns to their upstream licenses" },

  @{ p = @(
      "packages/decision/package.json", "packages/events/package.json",
      "packages/execution/package.json", "packages/knowledge/package.json",
      "packages/memory/package.json", "packages/models/package.json",
      "packages/runtime/package.json", "packages/security/package.json",
      "packages/tool-call-repair/package.json", "tests/package.json"
    ); m = "chore(packages): align the vitest manifests with the resolved versions" },

  @{ p = @(
      "apps/desktop/src", "apps/desktop/electron.vite.config.ts",
      "apps/desktop/vitest.config.ts", "apps/desktop/package.json",
      "apps/desktop/scripts/drop-empty-imports.cjs",
      "apps/desktop/scripts/prune-unused-imports.cjs",
      "apps/desktop/scripts/srgb-to-oklch.cjs",
      "apps/desktop/scripts/t11-extract-ipc.cjs",
      "apps/desktop/scripts/t11-extract.cjs"
    ); m = "refactor(desktop): split the main process into state and window modules" },

  @{ p = @(
      "apps/desktop/renderer/components", "apps/desktop/renderer/lib",
      "apps/desktop/renderer/hooks", "apps/desktop/renderer/src",
      "apps/desktop/renderer/workers", "apps/desktop/renderer/index.html",
      "apps/desktop/renderer/vite.config.ts", "apps/desktop/renderer/test",
      "apps/desktop/renderer/package.json"
    ); m = "feat(renderer): migrate the primitives to radix and enforce the design system" },

  @{ p = @( "apps/desktop/test" ); m = "test(desktop): add the runtime-state gate and adapt the source-text assertions" },

  @{ p = @( "tests/e2e" ); m = "test(e2e): adapt the resilience contracts to the extracted main process" },

  @{ p = @(
      "docs/adr", "docs/roadmap", "docs/agent-ops", "docs/architecture",
      "docs/product", "docs/research", "docs/engineering", "docs/testing",
      "docs/design", "docs/index.md", "docs/changelog.md", "docs/user",
      "CHANGELOG.md", "AGENTS.md"
    ); m = "docs: record the wave-2 decisions, findings and closure report" },

  @{ p = @(
      "scripts", "package.json", "pnpm-lock.yaml", ".oxlintrc.json",
      ".markdownlint.json", "pnpm-workspace.yaml", ".gitignore", ".husky",
      ".github"
    ); m = "chore(quality): exclude the third-party corpus from lint and recalibrate the baselines" },

  @{ p = @( ".agents/task-system/memory" ); m = "chore(memory): record the wave-2 decision and lessons" }
)

$i = 0

# 1) Deshacer el commit de 142 ficheros CONSERVANDO el contenido (soft reset).
#    Nada esta publicado (origin/master = 330abdb, anterior a la Ola 1), asi que
#    no se reescribe historia publicada.
Write-Host "--- [0] deshaciendo 0ac5918 (142 ficheros) con reset --soft" -ForegroundColor Cyan
& git reset --soft HEAD~1 2>&1 | Out-Null
$after = @(& git status --short -uall)
Write-Host "    $($after.Count) ficheros sin commitear tras el reset" -ForegroundColor DarkGray

foreach ($c in $commits) {
  $i++
  Write-Host "--- [$i/$($commits.Count)] $($c.m)"
  & git reset -q 2>&1 | Out-Null
  & git add -A -- @($c.p) 2>&1 | Out-Null
  $staged = @(& git diff --cached --name-only)
  if ($staged.Count -eq 0) {
    Write-Host "    (sin cambios) — se omite" -ForegroundColor DarkGray
    continue
  }
  & git commit -m $c.m 2>&1 | Select-Object -Last 2 | ForEach-Object { Write-Host "    $_" }
  if ($LASTEXITCODE -ne 0) { Write-Host "    COMMIT FALLIDO" -ForegroundColor Red; exit 1 }
  Write-Host "    $($staged.Count) ficheros" -ForegroundColor DarkGray
}

# 2) El resto: el trabajo paralelo de design system (primitives Radix, puerta
#    design-lint, su paso en CI y su documentacion).
& git reset -q 2>&1 | Out-Null
$left = @(& git status --short -uall)
if ($left.Count -gt 0) {
  Write-Host ""
  Write-Host "--- [resto] $($left.Count) ficheros del trabajo paralelo de design system" -ForegroundColor Yellow
  & git add -A 2>&1 | Out-Null
  & git commit -m "feat(design): enforce the design system with radix primitives and an executable quality gate" 2>&1 | Select-Object -Last 2 | ForEach-Object { Write-Host "    $_" }
  if ($LASTEXITCODE -ne 0) { Write-Host "    COMMIT FALLIDO" -ForegroundColor Red; exit 1 }
}
Write-Host ""
Write-Host "=== RESULTADO ===" -ForegroundColor Cyan
& git log --oneline -14
Write-Host ""
$rest = @(& git status --short -uall)
Write-Host "working tree restante: $($rest.Count) ficheros" -ForegroundColor Cyan

