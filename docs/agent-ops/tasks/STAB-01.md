# STAB-01: Drift electron-vite AGENTS/ADR/stack

## Metadata
- **Plan file:** `docs/agent-ops/plans/2026-10-16-plan-estabilizacion-ego.md`
- **Fuente:** plan Task 2 + auditoría docs (contradicción 4 bandas)
- **Esfuerzo:** 🟢 1h
- **Prioridad:** 🔴 P0
- **Tipo:** Docs
- **Turns estimados:** 5-10
- **Creado:** 2026-10-16
- **last-synced:** 2026-10-16
- **Estado:** 🟡 REVIEW-PENDIENTE (steps ✅ + verify ✅ + commit ✅; veredicto ego-audit pendiente)
- **Incógnitas (uphill):** 0
- **Pendientes (downhill):** 0 (3/3 steps ✅; solo resta review ego-audit P2-01 por agente distinto)

## Blast Radius

| Dirección | Módulos |
|-----------|---------|
| Callers | todos los agentes (leen AGENTS.md como verdad) |
| Callees | `apps/desktop/package.json:45`, `electron.vite.config.ts:1-68` |
| Implicaciones | Solo texto; aclara pipeline real T11; no cambia build |

## Impacto mapeado (Regla 0)
- **Archivos leídos (completos):** `AGENTS.md` (§1), `docs/adr/0001-electron-vite.md`, `docs/engineering/stack-tecnico.md` (§ stack), `apps/desktop/package.json`, `apps/desktop/electron.vite.config.ts`, `README.md` (§ stack), `apps/desktop/AGENTS.md`
- **Archivos referenciados hacia dentro:** `docs/engineering/stack-tecnico.md:17` referencia T11 `fa58b8c`; `apps/desktop/AGENTS.md` referencia `electron.vite.config.ts`
- **Archivos que referencian a los editados:** `.agents/` (reglas), planes (pipeline), `docs/index.md`
- **Veredicto impacto:** bajo — 3-4 edits docs + verify build; cero código prod

## Contrato
`grep -n electron-vite AGENTS.md docs/adr/0001-electron-vite.md docs/engineering/stack-tecnico.md` muestra canónico T11 + `pnpm --filter @ego/desktop build:verify` verde

## Spec
Sin decisiones técnicas (tarea 100% docs) + archivos: `AGENTS.md`, `docs/adr/0001-electron-vite.md` (append-only: NO reescribir, añadir `Superseded by T11`), `docs/engineering/stack-tecnico.md`, `README.md` si es necesario.

## Invariantes de dominio (handoff — MUST)
- **Invariantes a preservar:** ADR append-only (nunca editar decisión histórica, solo añadir supersede); no cambiar `package.json`, `electron.vite.config.ts`; no tocar guardrails AGENTS §4.
- **Comandos de verificación:** `pnpm --filter @ego/desktop build:verify`, `grep -n electron-vite AGENTS.md docs/adr/0001-electron-vite.md`
- **Deuda pendiente:** ninguna

## Recitation
| Campo | Valor |
|-------|-------|
| activeGoal | STAB-01 drift electron-vite |
| lastAction | — |
| result | PARTIAL |
| nextAction | Step 1 lectura completa |
| contract | ver Contrato + Invariantes |
| nextTask | STAB-02 |

## Deuda técnica (Regla 6 — MUST)
**Saldo neto:** Sin deuda

## Definition of Done
- Task: greps + build:verify. Commit: `docs:` atómico. Release: N/A.

## Herramientas necesarias
- campaign_verify_cmd (grep + build:verify)

**SDP:** base-only (docs, sin código)

## Investigation Notes
- Evidencia: `electron-vite ^5.0.0` + config `out/main+preload+renderer` real; `AGENTS.md:9` lo niega; ADR-0001 lo descarta; `stack-tecnico.md:17` + `README.md:51` lo afirman. Verdad = código (T11 migrado).
- **Mapa 4 bandas verificado 2026-10-16 (Step 1 ✅):**
  - `AGENTS.md:9` → ✅ canónico T11: "electron-vite 5.x (MIGRADO — T11, layout out/; ver stack-tecnico.md:17)" (fix ya en worktree, 1 línea).
  - `docs/adr/0001-electron-vite.md:23-24` → ❌ contradice: "No se adopta electron-vite como dependencia (mención aspiracional descartada…)" — causa del drift: ADR posterior a T11 sin supersede.
  - `docs/engineering/stack-tecnico.md:17` → ✅ canónico T11 en HEAD (sin diff necesario) + `:88` loop unificado; traza `electron-vite ^5.0.0` incluida.
  - `apps/desktop/package.json:45` → ✅ verdad código `"electron-vite": "^5.0.0"` (solo lectura) + scripts `build`/`dev` vía electron-vite.
  - `README.md:51` → ✅ canónico T11 (fix ya en worktree, 1 línea).
  - `apps/desktop/electron.vite.config.ts:1-68` → ✅ config real T11 (solo lectura): import electron-vite, out/main+preload+renderer, manualChunks.
  - `apps/desktop/AGENTS.md:8,9,16` → ✅ canónico T11 (sin edit necesario).
- **Causa raíz:** ADR-0001 redactado posterior a T11 sin bloque supersede + AGENTS raíz desactualizado (F5T11/M28 "NO hecha"). stack/README/desktop-AGENTS ya migrados.

## Incógnitas vs Pendientes
| Eje | Contador |
|-----|----------|
| Incógnitas | 0 |
| Pendientes | 3 |
| % | 0% |

## Steps

### Step 1: Lectura completa + mapa 4 bandas
- **Archivos:** los 7 de Impacto
- **Acción:** Citar líneas exactas de cada fuente en Notas (qué dice cada una)
- **Verify:** `grep -n "electron-vite" AGENTS.md docs/adr/0001-electron-vite.md docs/engineering/stack-tecnico.md README.md apps/desktop/package.json`
- **Estado:** ✅ DONE (2026-10-16: mapa 7 fuentes en Investigation Notes; causa raíz = ADR sin supersede + AGENTS desactualizado)

### Step 2: Edits mínimos
- **Archivos:** `AGENTS.md` (1 línea §1 → electron-vite 5.x canónico T11), `docs/adr/0001-electron-vite.md` (añadir bloque `Superseded by T11 fa58b8c`, NO reescribir), `docs/engineering/stack-tecnico.md` (traza `package.json:45` si falta)
- **Acción:** Edits ≤30 líneas totales
- **Verify:** `git diff --stat` + re-grep muestra consistencia
- **Estado:** ✅ DONE (2026-10-16: AGENTS.md:9 + README.md:51 1 línea c/u ya en worktree y adoptadas como alcance STAB-01; ADR-0001 header notice + §Supersede T11 añadidos, historia intacta; stack-tecnico.md sin edit — ya canónico en HEAD :17+:88)

### Step 3: Verify + commit + review
- **Archivos:** —
- **Acción:** `pnpm --filter @ego/desktop build:verify` + commit `docs:` local (NUNCA push) + pedir review ego-audit (enfoque: ¿ADR sigue append-only?)
- **Verify:** `campaign_verify_cmd "pnpm --filter @ego/desktop build:verify"`
- **Estado:** ✅ DONE (2026-10-16: build:verify TODOS LOS CHEQUEOS EN VERDE; commit docs: local; review ego-audit pendiente — ver §Review)

## Dependencias
- STAB-00 (matriz confirma drift, pero puede ir en paralelo: archivos distintos — matriz vs AGENTS/ADR)

## Review (GATE — agente distinto, P2-01)
- **Revisor:** ego-audit
- **Enfoque:** ¿se respetó append-only del ADR? ¿algún guardrail tocado?
- **Cómo se probó:** diff + greps + build:verify
- **Veredicto:** ⬜ pendiente (subagente worker no puede spawnear revisor distinto; queda para el orquestador. Self-check: historia ADR intacta — solo header notice + §Supersede añadidos, líneas 17-24 originales preservadas; guardrails AGENTS §4 intocados; package.json y configs build intocados)

## Notas
- Si `build:verify` falla por causa ajena, registrar y STOP (Gate V), no arreglar build aquí.
