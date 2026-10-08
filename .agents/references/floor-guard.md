# Floor Guard — Reference Implementation

> Referenciado por `constraint-driven-development` skill. Implementación de los 5 checks del "floor" (piso mínimo de calidad) que se ejecutan en cada diff. Adaptado para ecosistema Rust/Ego.

## Los 5 Checks del Floor

El floor define lo que **nunca** debe pasar, sin importar la configuración del proyecto. Estos checks son:

1. **No nuevas supresiones** — `@ts-ignore`, `eslint-disable`, `# noqa`, `# type: ignore`, `#[allow(...)]` en Rust
2. **No stubs sin implementar** — `throw new Error("Not implemented")`, `unimplemented!()`, `todo!()`, `panic!("not implemented")`
3. **No tests saltados/borrados sin razón** — `#[ignore]`, `.skip`, test file deleted sin explicación en commit
4. **No secrets en fuente** — API keys, tokens, passwords en código
5. **Este archivo no se debilita para que un cambio pase** — CONSTRAINTS.md solo se fortalece

---

## Implementación Rust (Ego)

### Script: `dev-tools/floor-guard.ps1`

```powershell
# Floor Guard para Ego — exit codes: 0=pass, 1=warn, 2=fail
param(
    [string]$BaseBranch = "origin/develop",
    [switch]$DiffOnly = $true
)

$exitCode = 0
$findings = @()

# 1. No nuevas supresiones Rust
$suppressions = git diff $BaseBranch --name-only -- "*.rs" | ForEach-Object {
    git diff $BaseBranch -- $_ | Select-String -Pattern '#\[allow\(|#\[deny\(|#\[warn\('
}
if ($suppressions) {
    $findings += "NEW_SUPPRESSIONS: $($suppressions.Count) nuevas supresiones detectadas"
    $exitCode = 2
}

# 2. No stubs sin implementar
$stubs = git diff $BaseBranch --name-only -- "*.rs" | ForEach-Object {
    git diff $BaseBranch -- $_ | Select-String -Pattern 'unimplemented!|todo!|panic!\("not implemented"'
}
if ($stubs) {
    $findings += "UNIMPLEMENTED_STUBS: $($stubs.Count) stubs detectados"
    $exitCode = 2
}

# 3. Tests ignorados/borrados
$testChanges = git diff $BaseBranch --name-only -- "*test*.rs" "*_test.rs" | ForEach-Object {
    $diff = git diff $BaseBranch -- $_
    if ($diff -match '#\[ignore\]|\.skip') {
        "IGNORED_TEST: $_"
    }
    if (-not (Test-Path $_) -and (git ls-files --error-unmatch $_ 2>$null)) {
        "DELETED_TEST: $_ (sin explicación en commit)"
    }
}
if ($testChanges) {
    $findings += $testChanges
    $exitCode = 2
}

# 4. Secrets (gitleaks)
if (Get-Command gitleaks -ErrorAction SilentlyContinue) {
    $leaks = gitleaks detect --redact --no-banner --source . --config-path=dev-tools/gitleaks.toml 2>$null
    if ($leaks) {
        $findings += "SECRETS_DETECTED: $($leaks.Count) hallazgos"
        $exitCode = 2
    }
}

# 5. CONSTRAINTS.md no debilitado
$constraintsDiff = git diff $BaseBranch -- CONSTRAINTS.md 2>$null
if ($constraintsDiff -match '^-.*\|.*\d+.*\|') {
    # Detectar si se bajó un número en la tabla
    $findings += "CONSTRAINTS_WEAKENED: thresholds lowered in CONSTRAINTS.md"
    $exitCode = 2
}

# Output
if ($findings) {
    Write-Host "FLOOR GUARD FAILED:" -ForegroundColor Red
    $findings | ForEach-Object { Write-Host "  - $_" }
} else {
    Write-Host "FLOOR GUARD PASSED" -ForegroundColor Green
}

exit $exitCode
```

### Config gitleaks: `dev-tools/gitleaks.toml`

```toml
[allowlist]
description = "Ego allowlist"
paths = [
    "*.md",
    "*.txt",
    "*.example",
    "*.sample",
    "test*",
    "*_test.rs",
    "benches/*",
    "examples/*"
]
regexes = [
    '''(?i)(password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]''',
    '''(?i)(api[_-]?key|apikey)\s*[:=]\s*['"][^'"]{16,}['"]''',
    '''(?i)(secret|token)\s*[:=]\s*['"][^'"]{16,}['"]'''
]
```

---

## Integración en Pipeline

### Pre-commit hook (rápido, solo archivos cambiados)
```bash
# .githooks/pre-commit
dev-tools/floor-guard.ps1 -DiffOnly
```

### Pre-push hook (completo)
```bash
# .githooks/pre-push
dev-tools/floor-guard.ps1
```

### CI Gate (en GitHub Actions)
```yaml
- name: Floor Guard
  run: |
    ./dev-tools/floor-guard.ps1 -BaseBranch origin/develop
```

---

## Códigos de Salida

| Código | Significado | Acción |
|--------|-------------|--------|
| 0 | PASS | Continuar |
| 1 | WARN | Log finding, continuar (solo pre-commit) |
| 2 | FAIL | Bloquear commit/push/merge |

---

## Adaptación por Ecosistema

| Check | Rust | TypeScript | Python |
|-------|------|------------|--------|
| Supresiones | `#[allow(...)]` | `@ts-ignore`, `eslint-disable` | `# noqa`, `# type: ignore` |
| Stubs | `unimplemented!()`, `todo!()` | `throw new Error("Not implemented")` | `raise NotImplementedError` |
| Tests | `#[ignore]`, `#[cfg(test)]` removed | `.skip`, `xit`, `test.only` | `@pytest.mark.skip` |
| Secrets | `gitleaks` | `gitleaks` | `gitleaks` |
| Constraints | `CONSTRAINTS.md` | `CONSTRAINTS.md` | `CONSTRAINTS.md` |

---

## Verificación

El floor guard se aplicó correctamente cuando:
- [ ] Script existe y es ejecutable
- [ ] Pre-commit hook llama a floor-guard (diff-only)
- [ ] Pre-push hook llama a floor-guard (completo)
- [ ] CI gate ejecuta floor-guard
- [ ] `gitleaks` configurado con allowlist Ego
- [ ] Exit codes 0/1/2 funcionan según especificación

---

## Véase También

- `constraint-driven-development` skill — Step 6: Guard the bar itself
- `CONSTRAINTS.md` — quality bar con números (si existe)
- `dev-tools/verify.ps1` — verification pipeline completo
- `security-and-hardening` skill — security dimension