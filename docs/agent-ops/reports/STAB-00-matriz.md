# STAB-00 — Matriz global existe/falta por área

> Fecha: 2026-10-16 · Task: STAB-00 · Plan: `docs/agent-ops/plans/2026-10-16-plan-estabilizacion-ego.md`
> Método: greps mecánicos + lecturas directas (sin codegraph: índice no verificado en este runner).
> Invariante: matriz solo registra; los fixes viven en STAB-01+ (no se arregla aquí).
> WIP ajeno detectado en `git status --short` (decenas de M/?? fuera de este task) — este commit solo añade matriz + task file.

## Foto global (1 línea por área)

| # | Área | Estado | Existe | Falta / Drift (fix en) |
|---|------|--------|--------|------------------------|
| 1 | Stack / build | 🟡 drift docs | `electron-vite ^5.0.0` real + config + `out/` | ADR-0001 contradice a 4 bandas → STAB-01 |
| 2 | Testing / CI | 🟡 verde-falso parcial | suites vitest + RTL (2) + e2e jobs | stub `get→null`, single-ubuntu, skips honestos, colecta gui → STAB-07/11 |
| 3 | Docs / DIST | 🟡 casi todo existe | `docs/index.md`, `distribution.md`, Backlog 148/151 | DIST-04/06/09 owner-gated; index sin user/design/adr/deployment → STAB-15/16 |
| 4 | Agentes / contexto | 🟡 API sin cablear | PromptAssembly + DelegationRouter + SharedMemory existen | turno ad-hoc, leases volátiles, sin CAS/curator → STAB-03/04/05/06/12 |
| 5 | Motion / UX | 🟡 base sin tokens | `prefers-reduced-motion`, a11y tests | 0 `--motion-*`, 14 `transition-all`, Modal/composer/targets → STAB-10/13 |
| 6 | Repos-referencia | 🟡 patrones sin portar | fichas `docs/extractions/*.md` + backlogs | 8 servicios por adaptar (solo patrones, nunca copiar) → STAB-14 |

## Evidencia file:line (verificable por grep)

### 1. Stack — drift electron-vite a 4 bandas vs ADR
- Dicen MIGRADO (4): `AGENTS.md:9` (electron-vite 5.x MIGRADO T11), `apps/desktop/AGENTS.md:16` (T11-migrated), `docs/engineering/stack-tecnico.md:17` (MIGRADO T11 `fa58b8c`), `apps/desktop/package.json:45` (`"electron-vite": "^5.0.0"`) + `apps/desktop/electron.vite.config.ts:1,6` (config real) + `apps/desktop/src/main.ts:2673` (nota T11-S6 `out/main/main.js`).
- Contradice (1): `docs/adr/0001-electron-vite.md:23-24` ("No se adopta `electron-vite`… descartada; ver `AGENTS.md` §1") — obsoleto tras T11. Fix: STAB-01 (supersede ADR, no reescribir; + `README.md:51` ya dice MIGRADO).

### 2. Testing/CI — stub `get→null`, single-ubuntu, skips honestos
- Stub VantaDB CI: `.github/workflows/ci.yml:29-65` y `:104-140` crean `vantadb-node` falso con `async get() { return null; }` (`ci.yml:59,134`), `scan→[]`, `search→[]` — memoria en `verify`/`e2e-electron` es ficticia. Fix: STAB-07 (job `integration-real-db` con `EGO_REAL_DB=1` + prebuilt).
- Single-OS: `ci.yml:12` y `ci.yml:87` ambos `runs-on: ubuntu-latest`; sin `strategy.matrix`, sin `upload-artifact`, sin `schedule cron`; Xvfb crudo (`ci.yml:154-157`); Electron E2E fail-soft (`ci.yml:159-165`). Fix: STAB-11.
- Skips honestos (verde-falso): `apps/desktop/renderer/test/ApprovalCard.rtl.test.tsx:12-18,43` (`hasRtl` + `describe.skipIf(!hasRtl)`), `apps/desktop/renderer/test/Omnibar.rtl.test.tsx:11-17,20` (idem), `apps/desktop/test/ipc.integration.test.ts:53` (`describe.skipIf(!process.env.EGO_REAL_DB)`), `apps/desktop/test/domain-ipc.test.ts:34` (`get: vi.fn().mockResolvedValue(null)` — stub en test). Fix: STAB-07/08 (RTL sin gate + MSW renderer).
- Colecta: `package.json:22-23` (`test:e2e` → `@ego/e2e-tests`; `test:e2e:electron` → `tests/gui`); `tests/gui/specs` bajo `test:e2e` por error según auditoría (verificar en STAB-07 antes de excluir).

### 3. Docs/DIST — existe casi todo; pendientes owner-gated
- Backlog: `docs/roadmap/Backlog.md:37` (148/151, pendientes solo DIST-04/06/09); `Backlog.md:479` (DIST-04 firma, BLOQUEO owner sin certs), `:481` (DIST-06 clean-machine VM, BLOQUEO owner), `:484` (DIST-09 pin VantaDB develop).
- `docs/index.md:1-90` indexa Product/Architecture/Engineering/Operations/Testing/Roadmap/References/Gobernanza/Review/Research/Extractions — sin secciones `user/`, `design/`, `adr/`, `deployment/` (gap → STAB-15). `docs/deployment/distribution.md` existe (verificar rutas `:42-76,105-126` en STAB-16).
- `apps/desktop/src/updater.ts` existe (updater puro sin electron-updater; `downloadUpdate→deferred`, `publish` comentado en `electron-builder.config.cjs:32-52` — docs-only en STAB-16, prohibido descomentar sin certs).

### 4. Agentes/contexto — PromptAssembly sin cablear, leases volátiles
- Sin cablear: `packages/subegos/src/PromptAssembly.ts:225` (`formatOutOfBandUserMessage`), `:362` (`assembleSystemPrompt`), `:413` (`assertSystemPromptStable`) existen; `apps/desktop/src/main.ts:1867` construye system ad-hoc (`"Eres Ego…" + contextText`, `:1866-1874`); grep `PromptAssembly|assembleHermes|drainSteer|OutOfBand` en `main.ts` = 0 matches → diseño de caché/inyección decorativo. Fix: STAB-03.
- Leases volátiles: `packages/subegos/src/SharedMemory.ts:194` (`leases: Map<…> = new Map()` RAM) + `:435` (`cleanExpiredLeases()` manual, nadie lo llama en prod según auditoría) → sin TTL ni persistencia; `publish version+1` sin CAS (`SharedMemory.ts:485-566,636-683` según plan). Fix: STAB-05/06.
- Delegación: `DelegationRouter.ts:681-850,911-996` API existe, no expuesta como tool del loop; `McpClient` stdio-duro, sin http, sin hooks, `scratchpad:Map` RAM (verificar exacto en STAB-04/12).

### 5. Motion/UX — tokens ausentes, `transition-all` ×14
- 0 tokens: grep `--motion-` en `apps/desktop/renderer/src` = 0 matches; `apps/desktop/renderer/src/index.css:104` solo `prefers-reduced-motion` (sin `--motion-duration-*`/`--motion-ease-*`). Fix: STAB-10.
- `transition-all` ×14 (anima props caras): `Button.tsx:13`, `ActivityTray.tsx:196`, `PendingApprovals.tsx:110`, `ask-directive.tsx:88`, `artifact-card.tsx:102`, `DiffReviewCard.tsx:108`, `ComponentRenderer.tsx:55`, `ChartView.tsx:175,232`, `RelationView.tsx:83`, `McpServerList.tsx:100`, `SubEgoSelector.tsx:78`, `ApprovalCard.tsx:163,328`. Fix: `transition-colors,transform` en STAB-10.
- Modal sin `AnimatePresence` salida, swap Send/Cancel sin crossfade, targets 24px, `aria-live` huérfano omnibar (detalle file:line en STAB-13).

### 6. Repos-referencia — 8 servicios por portar (patrones, nunca copiar código)
- Fichas en `docs/extractions/*.md` + `docs/review/backlog-*.md`; patrones sin portar: ApprovalIdentity, InteractionTransport+admit, Attention FSM, SafeConfigMutation+fingerprint, ChangeSet payloadRef, net-policy SSRF, WorkerPolicy pool, AdaptiveChunker 256+dedup, FileLockManager wx+PID. Guardrail `AGENTS.md` §4: prohibido importar dominios ajenos (ATS/scrapers/voz) y copiar código (licencias) → reimplementar TS + ADR por patrón. Fix: STAB-14 (partir 14a/14b si appetite 3d excede).

## Causa raíz y decisión
- **Causa raíz:** docs duplicados sin fuente única (AGENTS raíz vs `apps/desktop/AGENTS.md` vs ADR-0001 vs `stack-tecnico.md` evolucionaron a ritmos distintos; T11 migró código+3 docs pero no el ADR).
- **Decisión:** esta matriz es la foto central; cada drift se arregla en su STAB (STAB-01 primero). No se edita AGENTS/ADR en este task (Wave 0 paralelo con STAB-01, archivos distintos).

## Verificación mecánica (contrato) — ejecutado 2026-10-16
- `pnpm typecheck` → ✅ EXIT 0, 0 errores (todos los packages `Done`, incl. `apps/desktop` y `tests`).
- `pnpm --filter @ego/desktop test` → 🟡 FALLO PREEXISTENTE REGISTRADO, no introducido: `Test Files 10 failed | 26 passed | 1 skipped (37)` · `Tests 44 failed | 157 passed | 5 skipped (206)`. Causa única en los 44: `VantaError: connect (is the native binding built?) … Cannot find package '…/vantadb-node/index.js'`. El binding nativo no está compilado en este runner; los tests que requieren VantaDB real fallan en `connect`, los demás (157) pasan. Este task es docs-only (2 archivos `.md` nuevos) y no puede afectar a vitest. Fix real: STAB-07 (job `integration-real-db` + prebuilt). Segunda corrida confirma mismo error determinista.
- Esta matriz: cada fila con ruta:línea verificable por `grep -n` (ver § Evidencia).

## Deuda / pendiente
- `tests/gui/specs` bajo `test:e2e` por error: confirmar colecta exacta en STAB-07 antes de excluir.
- `check_index_coverage` / codegraph no corridos en este runner (sin MCP aquí); greps directos sustituyen evidencia.
- Citas de estándares: ninguna invocada → sin `[cita NO VERIFICADA]` necesaria.
