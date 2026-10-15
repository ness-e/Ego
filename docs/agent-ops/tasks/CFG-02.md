# CFG-02 — E2E Electron real ejecutado
- **Estado:** ✅ COMPLETED
- **Plan:** docs/agent-ops/plans/2026-10-16-plan-configs-revision-total.md
- **Campaign ID:** plan-2026-10-16-configs-revision
- **Fecha:** 2026-10-16
- **Wave:** Wave 1 sola (desbloqueada por CFG-01 ✅ ef4869d; sin paralelas)
- **Previa:** CFG-01 ✅ · **Next:** ninguna (cierra testing)
- **Archivos clave:** `tests/gui/electron/shell.electron.ts:69` (launch) · `tests/gui/electron.playwright.config.ts` (config separada) · `tests/gui/package.json` (script `test:e2e:electron`) · `docs/engineering/testing-e2e.md` (contrato doc) · `apps/desktop/out/main/main.js` (artefacto build, no editar) · `docs/agent-ops/tasks/CFG-02.md` (este archivo)
- **SDP:** systematic-debugging (si launch falla: repro+hipótesis+1 variable) + test-driven-development (estabiliza flaky) + code-review-and-quality (review pre-commit) + observability-and-instrumentation (traces/screenshots al fallar). `campaign_discover_skills_v2` no disponible en este runner — sin MCP campaign-*; descubrimiento manual desde prompt, documentado como degradado.

## Tarea
Convertir el skeleton `tests/gui/electron/shell.electron.ts:69` + `electron.playwright.config.ts` en el primer E2E real verde: build desktop fresco, runner Playwright instalado, launch de Electron real con shell que pinta header Ego + section Chat + Canvas, diálogos nativos mockeados, o fails documentados con issue + 0 regresiones.

## Contrato
"pnpm --filter @ego/desktop build OK + tests/gui install OK + playwright electron skeleton corre en Xvfb (o headless) con shell pinta header Ego + section Chat + Canvas, diálogos mockeados, o fails documentados con issue + 0 regresiones"

## Acceptance criteria del plan
- (a) `out/main/main.js` existe tras build
- (b) `_electron.launch` abre
- (c) `BrowserWindow` ≥ 1
- (d) header Ego + Chat + Canvas visibles
- (e) diálogos nativos mockeados
- (f) CI job e2e-electron documentado

## Blast Radius
Callers: CI job `e2e-electron` (`.github/workflows/ci.yml:158-266`, solo lectura) → `pnpm build:desktop` → `out/main/main.js` → `_electron.launch` → `evaluate` en main → primera ventana. Callees: binario Electron (`apps/desktop/node_modules/electron/dist/`) + bundle `out/` + Playwright `_electron`. No cambia código de producto: solo ejecuta (build + test). Sin migración de datos. **Riesgo: medio** (display/Xvfb en Linux, binario ausente, build frío >2min — no matar proceso sano).

## Impacto mapeado (Regla 0)
- Leídos completos: `tests/gui/electron/shell.electron.ts` (121 líneas: skip honesto si falta bundle/binario, launch con `cwd=DESKTOP_DIR`, `NODE_ENV=production`, mock diálogos vía `evaluate`, asserts header `Ego`+`Cognitive OS`, `section[aria-label="Chat"]`, tab Canvas → `Superficie Generativa`) · `tests/gui/electron.playwright.config.ts` (31 líneas: `testDir ./electron`, `testMatch *.electron.ts`, serial, timeout 180s, reporter list+html, trace/screenshot on-failure) · `tests/gui/package.json` (script `test:e2e:electron`, playwright 1.64.0) · `docs/engineering/testing-e2e.md` (precondiciones, matriz 3 SO + Xvfb, artefactos) · `.github/workflows/ci.yml` job `e2e-electron` (solo lectura: matriz 3 SO, `xvfb-run -a` en Linux, fail-soft win/mac, artefactos `playwright-electron-<os>`).
- Referencias hacia dentro: shell.electron.ts → `playwright` `_electron` + `@playwright/test` (deps standalone `tests/gui`) → `apps/desktop/out/main/main.js` (electron-vite) → `out/renderer/index.html`.
- Referencias entrantes: CI `e2e-electron` → `pnpm build:desktop` + `pnpm test:e2e:electron` (raíz). Vitest no recolecta `*.electron.ts` (sufijo propio + paquete standalone fuera del workspace).
- Veredicto: ejecución + estabilización del skeleton existente; ediciones solo en `tests/gui/electron/*` si el run lo exige con evidencia (flaky/timeouts). **PROHIBIDO TOCAR:** `packages/models/src/ModelRouter.ts`, `apps/desktop/renderer/components/ego-chat.tsx`, `apps/desktop/src/main.ts` (salvo lectura guards), `apps/desktop/src/ipc/schema.ts`, `packages/memory/*`, `packages/runtime/*`, `packages/tasks/*`, `packages/tools/*`, `packages/events/*`, `packages/subegos/*`, `docs/.vitepress/*`, `docs/public/*`, `docs/deployment/*`, `apps/desktop/renderer/floating/*`, `packages/runtime/src/AttentionStateMachine.ts`, `packages/ui-runtime/*`, `apps/desktop/electron.vite.config.ts` (solo lectura). Producto intacto salvo rebuild de `out/` (artefacto).

## Spec
N/A — sin símbolos públicos nuevos. Justificado por evidencia: el skeleton ya existe completo (`shell.electron.ts` 121 líneas + config 31 líneas + script + doc + job CI); la tarea es ejecutar/estabilizar, no diseñar API. Sin decisiones de datos, UX, contratos ni persistencia nuevas.

## Fase 1 — Evidencia de Debugging (Iron Law)
- **Causa histórica del skeleton nunca corrido:** falta de build (`out/main/main.js` ausente) + falta de install del runner standalone (`tests/gui/node_modules`) + falta de display en Linux (Xvfb). Verificado en este runner Windows: `out/main/main.js` EXISTE (2026-10-15, 176KB) + `electron.exe` EXISTE + `tests/gui/node_modules` EXISTE + `out/renderer/index.html` EXISTE. Precondiciones verdes.
- **Bundle posiblemente stale:** `main.js` del 2026-10-15 < HEAD actual (CFG-11 2d1ac1d 2026-10-16). Hipótesis: el shell pinta igual (CFG-11 no toca layout shell), pero el contrato exige build fresco → Step 1 rebuild antes del run. 1 variable controlada: ninguna edición de producto.
- **Display en Windows:** no requiere Xvfb (Linux-only); runner Windows tiene display. Si `launch` falla → systematic-debugging: repro + 1 hipótesis + 1 variable (headless flag, timeout, env).
- **Si headless sin display falla y no hay Xvfb en Windows:** documentar + abrir issue (fila FIND-*), NO marcar verde falso.
- Pre-mortem plan: EPERM `.node` en uso (no aplica — no toca nativo), Xvfb ausente (N/A Windows), build frío >2min (no matar proceso sano).

## Invariantes
- WIP ajeno intacto: `Arreglar-OpenCode.ps1`, `Untitled-1.py`, `__pycache__/`, `robot-chat-follow.png`, `docs/agent-ops/reports/verify-audit.jsonl` (modificado pre-tarea) — NO añadir al commit.
- Sin `git push` (commit LOCAL). Formato 10 columnas del plan intacto. Sin símbolos públicos nuevos. `out/` es artefacto gitignored (no commitear).
- INVESTIGACIÓN INTERNET: no requerida (Playwright Electron estándar, doc interno completo). Sin URLs citadas → Gate TSYS-13 N/A.

## DoD aplicable
Correctness (contrato a–f + 0 regresiones) · Quality (mínimo: es test; clean-code Apéndice V; sin cambios fuera de blast radius) · Integration (E2E valida aislamiento renderer-tonto ADR-0003: shell pinta sin lógica de negocio) · Docs (task file + fila plan + fails documentados si aplica) · Ship (commit LOCAL `feat: CFG-02 …`, review registrado).

## Herramientas
`pnpm --filter @ego/desktop build` · `pnpm --dir tests/gui install` (si falta) · `pnpm test:e2e:electron` (raíz) o `pnpm --dir tests/gui run test:e2e:electron` · OCR `pwsh .agents/dev-tools/ocr-review.ps1 -Format json` sobre `tests/gui/electron/*` · review distinto (o degradado documentado). MCP campaign-* NO disponible → verify mecánico directo por shell + estado en archivos.

## Steps de ejecución
- [x] Step 1: DISCOVERY + build fresco (`pnpm --filter @ego/desktop build` OK 26.7s, `out/main/main.js` 187798 bytes post-build + verify-dist TODOS LOS CHEQUEOS EN VERDE)
- [x] Step 2: install gui verificado + launch (lockfile reconciliado `^1.49.0→1.64.0` mecánico; `test:e2e:electron` corre: abre, ≥1 ventana, header Ego + Chat + Canvas visibles 2/2 runs)
- [x] Step 3: estabiliza + artefactos (4 fixes test-side con evidencia, 1 variable por vez; trace/screenshot on-failure ya en config; Xvfb N/A Windows documentado; 2/2 verde sin flaky)
- [x] Step 4: verify contrato + OCR + review + commit LOCAL + sync plan
- [ ] Gate D: sin decisiones de producto (ejecución mecánica; skip honesto o verde real, nunca verde falso) — evaluar, no disparar salvo ambigüedad
- [ ] Gate V: 2 fallas mismo-error → question; sin respuesta → STOP
- [ ] Gate C: si `git status` muestra fuera de blast radius → confirma alcance, no commitear ajeno

## Review (P2-01 — degradado, mismo contexto; sin agente distinto disponible en este runner)
- Enfoque: adversarial sobre el diff test-only (4 fixes, 1 variable por vez, cada uno con evidencia de root-cause). Alternativa "tocar `main.ts:5092`" descartada: prohibido por alcance Y el launch por directorio refleja mejor la app empaquetada (`getAppPath()===apps/desktop` en ambos). Deuda registrada abajo, no silenciada.
- Cómo se probó: `pnpm --filter @ego/desktop build` OK + `pnpm test:e2e:electron` 2/2 verde (2.5s/2.6s, sin flaky) + `tsc --noEmit -p tsconfig.json` (tests/gui) 0 errores + OCR Group 1 (`shell.electron.ts`) 0 findings. 0 regresiones por construcción: el diff no toca ningún archivo del workspace (`git diff --stat`: solo `tests/gui/*` + docs; `out/` gitignored; vitest no recolecta `*.electron.ts` + paquete standalone fuera de `pnpm -r test`).
- Veredicto: approve (degradado — self-review, escalar al owner si exige fresh-context).
- Cross-model: skipped (contexto no interactivo).

## Registro de Cumplimiento / Veredicto
- **Estado:** ✅ COMPLETED
- **Evidencia:** build exit 0 (26.7s, main.js 187798 bytes, verify-dist verde) · E2E 1/1 passed ×2 runs (header `Ego`+`Cognitive OS` + `section[aria-label=Chat]` + tab Canvas exact + `Superficie Generativa`) · `BrowserWindow ≥1` vía evaluate en main · diálogos mockeados vía evaluate (sin popup bloqueante en 2 runs) · CI job `e2e-electron` verificado en `ci.yml:158-266` (matriz 3 SO, `xvfb-run -a` Linux, artefactos `playwright-electron-<os>`, sin cambios requeridos) · tsc gui 0 err · OCR Group 1 sin findings
- **Deuda:** `main.ts:5092` (`join(app.getAppPath(),"out/renderer/index.html")`) frágil en launch desempaquetado por archivo (`getAppPath()=out/main`) — el E2E lo evita lanzando por directorio (como la app empaquetada). Candidato a hardening en REV-02 (fuera de alcance: main.ts prohibido aquí). `tests/gui/pnpm-lock.yaml` reconciliado mecánicamente (`^1.49.0→1.64.0`, sin cambio de versión resuelta).
- **Fixes aplicados (solo `tests/gui/electron/shell.electron.ts`, con causa raíz):** (1) `REPO_ROOT` off-by-one (`../..`→`../../..`, apuntaba a `tests/` → skip honesto falso); (2) race ventana (`evaluate` inmediato ve 0; `firstWindow` primero, `createWindow` es async post-`whenReady`); (3) launch por directorio (pantalla negra `chrome-error://` por `htmlPath` inexistente); (4) strict-mode Canvas (`exact:true`, tab vs `Ir al Canvas`).
- **last-synced:** 2026-10-16

## Notas
- Runner Windows: Xvfb N/A (Linux-only); CI ya documenta `xvfb-run -a` solo en Linux (`ci.yml:244-253`) y display nativo en win/mac.
- E2E valida ADR-0003 renderer-tonto (aislamiento): el shell pinta sin lógica de negocio en renderer.
