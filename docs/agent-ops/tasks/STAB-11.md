# STAB-11 — Matrix 3 SO + artefactos + nightly + visual baselines

> **Estado:** 🟡 REVIEW-PENDIENTE (6/6 steps ✅ + verifies contrato + commit local; falta veredicto review P2-01 por agente distinto)
> **Plan:** `docs/agent-ops/plans/2026-10-16-plan-estabilizacion-ego.md` Task 12
> **Contrato:** `ci.yml` matrix `[ubuntu,windows,macos]` e2e-electron (fail-soft win/mac inicial) + `xvfb-run -a` + artefactos `playwright-report/test-results/lcov` + `nightly.yml cron` + 3 `toHaveScreenshot` chromium `maxDiffRatio 0.02`
> **SDP:** base-only (CI YAML + Playwright + vitest; keywords: `matrix strategy`, `upload-artifact`, `toHaveScreenshot`, `cron schedule`)
> **Skills cargadas:** base (este runtime no expone MCP campaign/skills: sin `campaign_*`, sin `skill` tool — se trabaja manual + RESULTADO)

## Spec (Gate D — decisiones no declaradas, todas registradas)

| # | Decisión | Opciones | Evidencia (un solo camino viable) |
|---|----------|--------------|-----------------------------------|
| 1 | `integration-real-db` → **hard** (quitar `continue-on-error`) | (a) hard ahora; (b) mantener fail-soft | ✅ (a) — STAB-07 ✅ COMPLETED + review approve Fast; DB real local 5/5 + 3/3; plan Risk Register pre-autoriza: "Job separado fail-soft inicial, **luego hard**" + "**STAB-11 lo endurece**" (`plan:226`). STAB-07 lo permite → hard. Mitigación: `timeout-minutes` + `ls` robusto |
| 2 | Checkout VantaDB `ref: develop` explícito + TODO SHA owner-gated | (a) SHA pinneado; (b) `develop` explícito | ✅ (b) — sin red no se puede resolver un SHA verificado; `smoke-native.yml:57` usa `develop` (verificado 2026-10-13 en checkout local) + override `workflow_dispatch`. Se alinea `ci.yml`/`nightly.yml` al mismo + TODO SHA. Fingir un SHA sin verificar sería peor |
| 3 | Matrix e2e-electron: ubuntu hard + win/mac `continue-on-error` | (a) mixto; (b) todo hard | ✅ (a) — Risk Register plan: "Win/mac rojos bloquean todo → **fail-soft inicial + TODO hard**" (`plan:322`); contrato lo pide explícito |
| 4 | `xvfb-run -a` solo en Linux (runner OS gate) | (a) gate por OS; (b) Xvfb manual `:99` | ✅ (a) — `testing-e2e.md:111` pide `xvfb-run -a`; `-a` elige display libre (runners compartidos); win/mac tienen display nativo. `shell: bash` global en el job (sintaxis `[ ! -f ]` ya usada) |
| 5 | Contrato `maxDiffRatio 0.02` → campo `maxDiffPixelRatio: 0.02` | — | ✅ nombre canónico Playwright 1.49 para ratio 0..1 es `maxDiffPixelRatio` (`expect.toHaveScreenshot`). Mapeo 1:1 documentado en config |
| 6 | Visual en **config separada** `visual.playwright.config.ts` con `webServer` | (a) separada; (b) añadir webServer a `playwright.config.ts` | ✅ (a) — `playwright.config.ts:6-7` documenta "NO hay webServer auto-start: el owner levanta `pnpm dev` a mano". Cambiarlo rompería contrato T22. Separada + `testMatch 14-visual` |
| 7 | Baselines: genero `-windows` local; linux/macos como deuda hard-gated | — | ✅ solo hay runner Windows local; `snapshotPathTemplate` con `{platform}` deja el slot por-OS listo. Job visual fail-soft hasta 3 runs verdes con baselines commiteadas por SO |
| 8 | Coverage semanal **informativo** (`continue-on-error`) | (a) informativo; (b) gate 70% | ✅ (a) — `testing-e2e.md:87-102`: threshold 70% global "rompería la línea base existente". Contrato: "no gate hasta 70% global" |
| 9 | Nightly **hard** (sin `continue-on-error`) | (a) hard; (b) soft | ✅ (a) — nightly no bloquea PRs; hard = señal honesta. Precondición: valido `golden-full` + `crash-resume` en local con DB real antes del commit |
| 10 | Soak 30min como test vitest `tests/chaos/soak-nightly.test.ts` gateado `EGO_SOAK=1` | (a) test gateado; (b) loop bash en YAML | ✅ (a) — reusa runner/assertions/summary JSON artefacto; `skipIf` honesto como `EGO_REAL_DB` (STAB-07). No corre en `verify`/`test:e2e` normal (skip, coste 0) |

## Impacto mapeado (Regla 0)

**Archivos leídos completos:** `.github/workflows/ci.yml` (228L), `.github/workflows/smoke-native.yml` (101L), `tests/gui/playwright.config.ts` (26L), `tests/gui/electron.playwright.config.ts` (29L — ⚠️ plan cita `electron/electron.playwright.config.ts`, path real sin subdir), `tests/gui/electron/shell.electron.ts` (121L), `tests/gui/fixtures/base.ts` (36L), `tests/gui/package.json`, `tests/gui/specs/01-arranque.spec.ts`, `tests/gui/.gitignore`, `tests/vitest.config.ts` (17L), `tests/package.json`, `apps/desktop/renderer/vite.config.ts:53-73` (coverage), `docs/engineering/testing-e2e.md` (118L), `package.json` raíz, `docs/agent-ops/tasks/STAB-07.md`, plan Task 12.

**Referencias hacia dentro (el cambio depende de):** `actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4`, `dtolnay/rust-toolchain@stable` (mismos pins que `ci.yml`/`smoke-native.yml`); `actions/upload-artifact@v4` (nuevo, pin v4); Playwright `1.49` API (`toHaveScreenshot`, `snapshotPathTemplate {platform}`, `webServer.cwd`); `EgoMemoryAdapter.put/get/delete` (`packages/memory/EgoMemoryAdapter.ts:533,545,638`); vitest `describe.skipIf` (patrón `EGO_REAL_DB`, STAB-07).

**Referencias entrantes (dependen del cambio):** STAB-07 (su job se endurece); `testing-e2e.md` § TODO matriz (se cierra); futuros hardenings win/mac + SHA (TODOs marcados).

**Veredicto:** blast radius 8 archivos (1 edit `ci.yml`, 2 workflows nuevos, 1 edit electron config, 1 config visual nueva, 1 spec visual nuevo + snapshots, 1 soak test nuevo, 1 docs). Cero código producto (memoria/agentes/UX intactos). Prohibidos intactos: `.ego-worktrees/`, `dist/`, `out/`, `verify-audit.jsonl` ajeno (modificado en worktree, NO tocar ni commitear).

## Steps

- [x] **Step 1 — DISCOVERY:** cero-código, Spec + Impacto arriba, RED documentado (ubuntu-only, Xvfb crudo, sin artefactos, retries 0, 0 screenshots, 0 cron)
- [x] **Step 2 — `ci.yml`:** matrix 3 SO e2e-electron (fail-soft win/mac) + `xvfb-run -a` + artefactos + harden `integration-real-db` (hard + `ref: develop` + `ls` robusto) + html reporter electron config + job `visual` (ubuntu chromium fail-soft + stub + artefactos)
- [x] **Step 3 — `nightly.yml` + `coverage.yml`:** cron `0 2 * * *` (golden-full + crash-resume + soak 30min, DB real, hard) + semanal domingo `--coverage` informativo con lcov
- [x] **Step 4 — Visual:** `visual.playwright.config.ts` + `specs/14-visual.spec.ts` (3 shots, `maxDiffPixelRatio 0.02`, `{platform}`) + 3 baselines `-win32` generadas local + pin exacto `@playwright/test 1.64.0` + `tsconfig` gui amplía include (+`lib DOM` por `document` preexistente en 10-a11y) + gate exime 14-visual de T10 (exige STAB-11) + fix conteo dirs
- [x] **Step 5 — Soak + docs:** `tests/chaos/soak-nightly.test.ts` (gate `EGO_SOAK=1`, summary JSON, `tests/.gitignore`) + `testing-e2e.md` (matrix/nightly/visual/coverage, TODOs cerrados)
- [x] **Step 6 — Cierre:** verifies contrato + commit local (NUNCA push) + review pendiente + RESULTADO

## Verify contrato (2026-10-15)

| Check | Resultado |
|---|---|
| `ci.yml` + `nightly.yml` + `coverage.yml` YAML parse | ✅ 4 jobs (`verify, integration-real-db, e2e-electron, visual`); matrix 3 SO + `continue-on-error` solo win/mac; crons `0 2 * * *` / `0 3 * * 0` |
| `golden-full` + `crash-resume` local DB real | ✅ 2/2 (3.39s, `EGO_REAL_DB=1`) — precondición nightly hard cumplida |
| soak smoke `EGO_SOAK_MINUTES=1` | ✅ 1686 ops, 0 errores, p95 77ms (<5000); summary JSON escrito |
| soak sin flag → skip honesto | ✅ 1 skipped, coste 0 en `test:e2e` normal |
| visual 3 shots local (baselines `-win32`) | ✅ 3/3 (shell-full 173KB, panel-chat 24KB, area-trabajo 88KB) |
| gui `tsc` + gate estático | ✅ 0 errores; GATE VERDE 14 specs |
| `e2e-tests` typecheck (mi archivo) | ✅ 0 errores en `soak-nightly.test.ts` (resto preexistente STAB-10 strict, fuera de blast radius) |
| `pnpm test:e2e` completo | ⚠️ 4f/6t `FjallError: Locked` en corridas whole-suite SIN `EGO_REAL_DB` — **ambiental, no mío**: en HEAD limpio (stash) los mismos archivos pasan aislados 3/3; varía entre corridas (4f→2f); nightly corre por-archivo como STAB-07 (patrón probado). → FIND para orquestador |
| `verify.ps1` repo-wide | ⚠️ FAIL preexistente en `packages/*` (STAB-10 strict fallout + agentes paralelos en vuelo) — ningún path mío implicado |

## Review (P2-01)

- **Tier:** Fast (paths: `.github/workflows/**`, `tests/gui/**`, `tests/chaos/soak-*`, `tests/.gitignore`, docs — ningún glob adversarial).
- **Veredicto:** pendiente por agente distinto (orquestador). Spot-check sugerido: `ci.yml` matrix + job `visual`, `nightly.yml`, `14-visual.spec.ts` + config, `soak-nightly.test.ts:16-26` (gates env).

## Incidente stash (2026-10-15, recuperado sin pérdidas)

- `git stash -u` (para probar HEAD limpio) barrió ~30 paths de agentes paralelos (STAB-12/13 en vuelo en el mismo árbol) + `pop` abortó por `preload.ts` re-modificado en paralelo.
- Recuperación: `checkout stash@{0}` de los 33 paths trackeados EXCEPTO `preload.ts` (worktree = superset con bloque STAB-12 fork, 0 líneas solo-en-stash), untracked ya restaurados por el pop, `stash drop` + `git reset`. Verificado path por path. Lección: en árbol compartido con waves paralelas, verificar con `git worktree` o copiar archivos en vez de `stash -u`.
