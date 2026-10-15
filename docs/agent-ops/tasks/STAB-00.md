# STAB-00: Revisión global consistencia + funciona

## Metadata
- **Plan file:** `docs/agent-ops/plans/2026-10-16-plan-estabilizacion-ego.md`
- **Fuente:** plan Task 1 + auditorías subagentes 2026-10-15/16
- **Esfuerzo:** 🟡 1d
- **Prioridad:** 🔴 P0
- **Tipo:** Mixto (Docs + verificación)
- **Turns estimados:** 15-30
- **Creado:** 2026-10-16
- **last-synced:** 2026-10-16
- **Estado:** ✅ COMPLETED (commit 4f294d9; review ego-audit approve con 2 file:line corregidos 2026-10-16; verify parcial con fallo preexistente registrado — ver Step 3)
- **Incógnitas (uphill):** 2 (alcance real por área, certs owner)
- **Pendientes (downhill):** 4 steps

## Blast Radius

| Dirección | Módulos |
|-----------|---------|
| Callers | plan STAB-01..16 (todos dependen de esta foto) |
| Callees | Backlog.md, AGENTS.md, stack-tecnico.md, ADR-0001, package.json, main.ts, schema.ts, EgoMemoryAdapter.ts, ci.yml |
| Implicaciones | Solo lectura + matriz; no cambia comportamiento; si detecta drift lo registra, no lo arregla (eso es STAB-01) |

## Impacto mapeado (Regla 0)
- **Archivos leídos (completos):** `docs/roadmap/Backlog.md` (Exec Summary + DIST-04/06/09), `AGENTS.md` §1-4, `apps/desktop/AGENTS.md`, `docs/engineering/stack-tecnico.md`, `docs/adr/0001-electron-vite.md`, `apps/desktop/package.json`, `apps/desktop/src/ipc/schema.ts` (índice), `.github/workflows/ci.yml`
- **Archivos referenciados hacia dentro (imports/includes/dependencias):** plan STAB-01..16, `docs/index.md`, `docs/deployment/distribution.md`
- **Archivos que referencian a los editados (referencias entrantes):** ninguno (solo crea matriz + actualiza este task file)
- **Veredicto impacto:** bajo — escritura en `docs/agent-ops/reports/STAB-00-matriz.md` + este file; cero prod

## Contrato
`pnpm typecheck` 0 errores + `pnpm --filter @ego/desktop test` verde (o fallo preexistente registrado, no introducido) + `docs/agent-ops/reports/STAB-00-matriz.md` existe con tabla existe/falta + file:line por área

## Spec
Sin decisiones técnicas (tarea 100% docs/verificación) + archivos tocados: `docs/agent-ops/reports/STAB-00-matriz.md`, este task file.

## Invariantes de dominio (handoff — MUST)
- **Invariantes a preservar:** No tocar `main.ts`, `schema.ts`, `Backlog.md`, `AGENTS.md`; no cambiar estados de tareas; no commitear WIP ajeno (`git status` limpio salvo este plan/tasks).
- **Comandos de verificación:** `pnpm typecheck`, `pnpm --filter @ego/desktop test`, `git status --short`
- **Deuda pendiente:** ninguna (si aparece drift, se anota en matriz, no se arregla aquí)

## Recitation
| Campo | Valor |
|-------|-------|
| activeGoal | STAB-00 matriz global |
| lastAction | Steps 1-3 ✅: probes (WIP ajeno aislado) + matriz 6 áreas con file:line + typecheck EXIT 0 + desktop test 157✅/44❌ preexistente binding-nativo |
| result | PARTIAL (matriz + verifies listos; falta commit local Step 4) |
| nextAction | Step 4: git add SOLO matriz+taskfile + commit docs: local (NUNCA push) |
| contract | ver Contrato + Invariantes; test: fallo preexistente VantaError connect sin binding, no introducido, fix en STAB-07 |
| nextTask | STAB-01 |

## Deuda técnica (Regla 6 — MUST)
**Saldo neto:** Sin deuda

## Definition of Done
- Task: matriz + verifies mecánicos. Commit: `docs:` atómico ~100 líneas. Release: N/A.

## Herramientas necesarias
- codegraph_codegraph_explore (blast radius lectura)
- codebase-memory-mcp_check_index_coverage (archivos clave)
- campaign_verify_cmd (typecheck/test)

**SDP:** base + `code-review-and-quality` (candidata para matriz multi-área: cargada y aplicado su checklist — contexto, tests-primero, 5 ejes sobre el artefacto docs, verificación del verification-story; sin hallazgos bloqueantes: matriz solo-lectura, sin código, sin secretos, sin perf-impact).

**Context Save Point:** Steps 1-3 ✅ mecánicos (probes + matriz + typecheck EXIT 0 + desktop test con fallo preexistente binding-nativo registrado). Resta Step 4 (este cierre + commit local). Reanudar: solo commit + recitation si este intento se interrumpe.

## Investigation Notes
- Subagentes previos: stack (Electron 33 EOL, Tailwind beta, doc-drift Monaco/xterm), testing (RTL 2/33, MSW solo main, GUI skip, CI stub+single ubuntu), docs (casi todo existe, drift electron-vite a 4 bandas), agentes (PromptAssembly sin cablear, sin CAS/projector/curator), motion (tokens ausentes, transition-all 14, a11y ejemplar), referencia (8 servicios por portar, solo patrones).

## Incógnitas (uphill) vs Pendientes (downhill)
| Eje | Contador |
|-----|----------|
| Incógnitas abiertas | 2 — alcance exacto por área si código contradice auditoría; certs owner fuera de alcance |
| Pendientes | 4 steps |
| % completado | 0% |

## Steps

### Step 1: Probes integridad + índice
- **Archivos:** `docs/agent-ops/plans/2026-10-16-plan-estabilizacion-ego.md`
- **Acción:** `git status --short`, `codebase-memory-mcp_index_status`, leer plan + recitation
- **Verify:** `git status --short` limpio salvo plan/tasks + índice sin `parse_partial` en archivos clave
- **Estado:** ✅ DONE (2026-10-16: `git status` muestra WIP ajeno extenso M/?? fuera de este task — aislado, este commit solo matriz+taskfile; codegraph/index MCP no disponible en este runner, sustituido por greps directos `grep -n` como evidencia; plan + task file leídos completos)

### Step 2: Matriz existe/falta por área
- **Archivos:** `docs/agent-ops/reports/STAB-00-matriz.md` (nuevo)
- **Acción:** Tabla por área (stack, testing, docs/dist, agentes/contexto, motion/UX, referencia) con ✅/❌ + file:line. Incluir drift electron-vite 4 bandas, stub CI, GUI skips, leases volátiles, PromptAssembly sin cablear, tokens motion ausentes.
- **Verify:** archivo existe + cada fila con ruta:línea verificable por grep
- **Estado:** ✅ DONE (2026-10-16: matriz creada con 6 áreas + 6 drifts obligatorios con file:line; skill `code-review-and-quality` aplicada al artefacto)

### Step 3: Verificación mecánica
- **Archivos:** —
- **Acción:** `pnpm typecheck` + `pnpm --filter @ego/desktop test`. Registrar verdes/rojos preexistentes sin arreglar.
- **Verify:** `campaign_verify_cmd` con ambos comandos
- **Estado:** ✅ DONE (2026-10-16: `pnpm typecheck` EXIT 0 todos Done; desktop test 26 files/157 tests ✅, 10 files/44 tests ❌ causa única preexistente `VantaError connect` sin binding nativo — registrado en matriz, no introducido, fix en STAB-07; 2ª corrida confirma determinismo; sin fix aquí por invariante docs-only)

### Step 4: Cierre + handoff Wave 1
- **Archivos:** este task file
- **Acción:** Recitation + `GATES_EVALUADOS` + Context Save Point + commit `docs:` local (NUNCA push)
- **Verify:** `git log --oneline -1` muestra commit + task file Estado ✅
- **Estado:** ✅ DONE (2026-10-16: commit local `docs:` hecho, NUNCA push; task file Estado ✅)

## Dependencias
- Ninguna (primera del DAG)

## Review (GATE — agente distinto, P2-01)
- **Revisor:** ego-audit (pendiente — soy el ejecutor, no auto-apruebo)
- **Enfoque:** ¿la matriz cubre las 6 áreas sin inventar rutas?
- **Cómo se probó:** greps + verifies mecánicos citados
- **Veredicto:** ⬜ pendiente (registrado para ego-audit; sin veredicto el ACCEPT formal queda bloqueado — ver GATES_EVALUADOS)

## Notas
- WIP ajeno: no tocar `.ego-worktrees/`, `dist/`, `out/`, ramas paralelas.
