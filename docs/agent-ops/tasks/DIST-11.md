# DIST-11 — Lint real o retirar claim

| Campo | Valor |
|---|---|
| Estado | ✅ COMPLETED (esta invocación; sin commit por contrato ego-lead de task) |
| Ruta | ego-lead (solo esta task; NO commit, NO tag, NO push) |
| Contrato | Linter con gate en CI que falle ante violaciones, o `AGENTS.md`/scripts sin claim falso |
| SDP | `ci-cd-and-automation` (cargada; resto base-only — tarea config+gate sin código funcional nuevo) |
| Plan | `docs/agent-ops/plans/2026-10-13-plan-deuda-residual.md` §Task 16 |

## DISCOVERY (zero-code planning)

### Archivos leídos (completos)
- `package.json` — script `lint`: `oxlint --ignore-path .gitignore apps packages tests && pnpm run typecheck` (l.19); `oxlint: 1.87.0` pineado en devDependencies (l.26, herencia F6T12).
- `AGENTS.md` §3 — claim: `Lint: pnpm lint` (l.127). El script existe y corre; el claim es literalmente cierto, pero la mitad oxlint del gate era vacua (ver hallazgo).
- `.github/workflows/ci.yml` — step `Run Linter`: `pnpm exec oxlint --ignore-path .gitignore apps packages tests` (l.70-71) + step `Run Typecheck` separado (l.73-74). Equivalente funcional a `pnpm lint`; corre en cada push/PR a main.
- `docs/agent-ops/tasks/DIST-10.md` — patrón de taskfile (DISCOVERY → Steps → EJECUCIÓN → Review → Evidencia → Rollback).
- `.gitignore` — l.2 `.*` ignora todos los dotfiles con excepciones `!.gitignore/!.github//!.agents/`; NO había excepción para config de linter.
- No existe `eslint.config.*` ni `.oxlintrc.*` (verificado por glob: 0 hits). El Backlog cita `eslint.config.*` como archivo esperado; oxlint es el linter ya pineado y basta.

### Hallazgo central (evidencia mecánica, no opinión)
oxlint sin archivo de config reporta TODAS las reglas como `warning` y sale con exit 0 **incluso ante violaciones de correctness**: probado en scratch con `debugger` (`eslint/no-debugger`) y `case` duplicado (`eslint/no-duplicate-case`) → ambos `warning`, `EXIT:0`. Solo `--deny-warnings` los hacía fallar (`EXIT:1`). Conclusión: el gate pre-DIST-11 **nunca podía fallar por lint** (solo el typecheck encadenado podía); el claim `pnpm lint` era formalmente cierto pero materialmente débil. Rama elegida del contrato: **lint real** (no retirar claim).

### Baseline del árbol (2026-10-13, oxlint 1.87.0, formato unix)
- 90 warnings / 0 errores / exit 0. Por regla: `no-unused-vars` 38, `no-unsafe-optional-chaining` 24, `no-useless-escape` 11, `unicorn/no-useless-fallback-in-spread` 11, `no-control-regex` 5, `unicorn/no-new-array` 1.
- 0 hits para las 8 candidatas a deny (`no-debugger`, `no-duplicate-case`, `no-self-assign`, `no-unsafe-finally`, `no-sparse-arrays`, `no-ex-assign`, `no-explicit-any`, `no-fallthrough`).
- `any` explícitos siguen existiendo fuera de `main.ts` (grep en `apps/` trae hits en tests y `WindowStateManager.ts`, `useActivityState.ts`, `DailyDashboard.tsx`) → `typescript/no-explicit-any` se EXCLUYE de la deny-list (pondría el árbol en rojo; es follow-up, no esta task).

### Impacto mapeado (Regla 0)
- Archivos leídos completos: los 6 de arriba.
- Referencias hacia dentro: `.oxlintrc.json` (nuevo) → consumido automáticamente por las dos invocaciones existentes (`package.json#lint` y `ci.yml` l.71) por descubrimiento desde cwd=root; sin cambios en comandos. `.gitignore` (1 línea: excepción de tracking).
- Referencias entrantes: ninguna (ningún `src/` importa config de lint; CI la levanta del checkout).
- Veredicto: cambio neto = 1 archivo nuevo (config) + 1 línea en `.gitignore` + este taskfile. CERO código `src/` funcional, CERO firmados, CERO `.agents/**`. Rev tier: Fast.

### Gate D (Zero Silent Assumptions — sin tool interactivo en este contexto; decisiones del lead)
1. **¿oxlint basta como "lint real" o hay que migrar a Biome/ESLint?** → Basta (Recomendado). Pineado 1.87.0, reglas bug-catching reales, 0 errores base, corre en CI. Migrar sería sobreingeniería.
2. **¿`--deny-warnings` global en vez de deny-list?** → NO (Recomendado). Pondría el árbol en rojo por los 90 warnings preexistentes (mayoría en tests, fuera de alcance). Deny-list de 7 reglas zero-hit: árbol sigue verde + gate falla ante violaciones reales.
3. **¿Tocar `package.json#lint` o `ci.yml`?** → NO (Recomendado). Ambos ya corren la invocación exacta que descubre la config; cambiarlos sería churn sin efecto.
4. **¿Cambiar `AGENTS.md` §3?** → NO (Recomendado). Con el gate real, el claim `Lint: pnpm lint` es verdadero en sentido fuerte. Sin diff.
5. **¿Ratchet `--max-warnings=90`?** → NO en esta task (documentado como follow-up opcional abajo). Determinista con pin fijo, pero un fallo críptico de presupuesto ante cualquier warning nuevo es peor que 7 denies explícitos y auditables.

## Steps
1. ✅ `.oxlintrc.json` con deny-list de 7 reglas bug-catching zero-hit.
2. ✅ Excepción `!.oxlintrc.json` en `.gitignore` (el `.*` lo invisibilizaba para git y CI).
3. ✅ Verify mecánico: verde en árbol limpio + rojo ante violación real + `pnpm lint` completo + este taskfile con RESULTADO §7.

## EJECUCIÓN
- Step 1: creado → `Test-Path node_modules/oxlint/configuration_schema.json` = True (el `$schema` resuelve local, sin red).
- Step 2: 1 línea; `git status` muestra `?? .oxlintrc.json` (rastreable) — antes del fix, `git check-ignore` lo marcaba ignorado por `.gitignore:2`.
- Step 3: verde `WARNINGS:90 ERRORS:0 EXIT:0` (idéntico al baseline → la config no introduce ruido); rojo con probe in-tree `packages/__dist11-probe__/probe.ts` (`debugger` + `case` duplicado → 2 × `[Error/...]`, `RED_EXIT:1`); probe eliminado (`Test-Path` = False, `POST_REVERT_EXIT:0`); `pnpm lint` (oxlint + `pnpm -r typecheck`) `LINT_EXIT:0`.
- Fuera de alcance tocado: nada. `git status` muestra ediciones ajenas (orquestador/otros workers: `decisions.md`, plan file, `verify-audit.jsonl`, `pipeline-state.json`) que NO se tocan y NO se commitean. Los 90 warnings preexistentes y los `any` fuera de `main.ts` quedan como están (follow-ups abajo, no FIX_PROPUESTO porque no son fixes fuera de alcance sino deuda consciente en alcance futuro).

## Review
- Tier: Fast (solo config de linter + 1 línea de `.gitignore` + taskfile; sin `src/`, sin firmados, sin `.agents/**`).
- Verify mecánico: schema resuelve ✅ · verde 90/0 exit 0 ✅ · rojo 2 errores exit 1 ✅ · revert limpio + verde ✅ · `pnpm lint` exit 0 ✅ · `git status` solo 3 paths propios ✅. Veredicto: approve.
- DoD: correctness (gate falla ante violación real, pasa en limpio), quality (sin cambios fuera de scope, warnings intactos), integration (CI corre la misma invocación → hereda el gate sin diff), docs (taskfile), ship-readiness (rollback trivial abajo).

## Evidencia
- Gate real: `no-debugger` + `no-duplicate-case` → `[Error/...]` → `exit 1` (antes: `warning` → `exit 0`).
- Limpio: `WARNINGS:90 ERRORS:0`, `pnpm lint` → `LINT_EXIT:0` (typecheck recursivo incluido).
- CI: `ci.yml` l.70-71 invoca `pnpm exec oxlint --ignore-path .gitignore apps packages tests` desde root = comando verificado localmente; la config viaja en el checkout tras commit (excepción `.gitignore` verificada). Sin diff de workflow necesario.
- Deuda consciente (follow-ups, no bloquean): (a) 90 warnings preexistentes como advisory — subir reglas a deny exige fijar el árbol; (b) `any` fuera de `main.ts` impide denegar `no-explicit-any`; (c) ratchet `--max-warnings` opcional cuando (a) baje.

## Rollback
`git checkout -- .gitignore` + `rm .oxlintrc.json docs/agent-ops/tasks/DIST-11.md`. Sin migraciones, sin estado. (Los 4 archivos ajenos modificados NO se tocan.)
