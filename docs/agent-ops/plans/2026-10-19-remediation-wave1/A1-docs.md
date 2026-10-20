# Plan A1 — Salud documental y honestidad de estado

**Agente:** A1 (sesión `ses_eaa0dfc64ffe2osggb698OclYh`) · **Persona:** `.opencode/agents/ego-docs.md`
**Zona exclusiva:** `docs/index.md`, `docs/adr/**`, `docs/roadmap/roadmap.md`, `docs/roadmap/Backlog.md`, `docs/PLAN-EGO.md`, `AGENTS.md`, `docs/engineering/stack-tecnico.md`, `docs/product/**` (salvo `mascota.md`, `character-art-direction.md`), `docs/architecture/**` (salvo `character-system.md`), `docs/getting-started.md`, `docs/user/**`, `docs/deployment/**`, `docs/operations/**`, `docs/testing/**`, `docs/design/**`, `docs/references/**`, `docs/changelog.md`, `docs/.vitepress/**`
**Prohibido:** `packages/**`, `apps/**`, `tests/**`, `.github/**`, `docs/extractions/**`, `docs/review/**`, `docs/research/**`

## Objetivo

Que la documentación canonica **diga la verdad** sobre el estado del producto. Hoy hay contradicciones verificables entre documentos de estado, rutas rotas, ADRs en colisión y decisiones de arquitectura en producción sin registrar.

## Tareas (resuelven `EGO-FIND-75..79` + `A1-01..A1-16`)

### T1 — Reconciliar `roadmap.md` ↔ `Backlog.md` ↔ `PLAN-EGO.md` ↔ `index.md` (`EGO-FIND-75`)
- `docs/roadmap/roadmap.md:63-89` dice **"0 de 6 tareas completadas"** en Fase 03.1; `docs/roadmap/Backlog.md:27` marca 6/6 ✅. Fases 03,04,05,06,08,09,10 tienen checkboxes `- [ ]` sin estado.
- Decide y aplica: **reescribir las fases de `roadmap.md` con el estado real** (extraído del Backlog, que es la fuente canónica) y checkboxes `[x]`. Actualiza `PLAN-EGO.md:15` e `index.md` para que apunten al Backlog como fuente de verdad, y marca `roadmap.md` como "hoja de ruta de fases (histórico de estados)".
- Verificable: no queda ningún checkbox `- [ ]` en una fase que el Backlog marca completada; `grep` de contradicciones devuelve 0.

### T2 — Reparar la columna `Archivo:línea` del Backlog (`EGO-FIND-76`)
- **40 rutas citadas no existen**: patrón dominante falta el segmento `src/` (24 casos); `packages/memory/DreamConsolidator.ts` → real `packages/tasks/src/DreamConsolidator.ts`; `packages/subegos/ProactivityEngine.ts` → real `packages/tasks/src/`; `apps/desktop/renderer/components/daily/*` → real `daily-state/`; `renderer/src/main.tsx` → real `apps/desktop/renderer/src/main.tsx`; `apps/desktop/src/ipc/handlers.ts` → real `apps/desktop/src/ipc.ts`; `apps/desktop/renderer/components/shell.tsx` → **no existe en absoluto**.
- **Método**: extrae con regex todas las rutas de la columna `Archivo:línea`, normaliza `src/`, comprueba existencia con `Test-Path`, corrige. Si una ruta no existe en ninguna forma, busca el fichero real por nombre en el repo.
- **No cambies el `Estado` de ninguna tarea** por esto (es otro agente/verificación).

### T3 — ADRs: numeración, índice y 5 decisiones sin registrar (`EGO-FIND-77`)
- Renumera `0006-docs-site.md` (colisión con `0006-approval-identity.md`) → `0012-docs-site.md`. Renombra `0011-stab14-asimilados-descartes.md` a un nombre canónico no-ADR (es un resumen de compuertas, no una decisión) o conviértelo en ADR con la plantilla común.
- `docs/adr/0001-electron-vite.md` dice "SUPERSEDED by T11" en el cuerpo pero su campo `Estado` sigue "Aceptado" → corrige el `Estado`.
- 6 ADRs no están en `docs/index.md` → añádelos todos.
- **Crea 5 ADRs nuevos** con la plantilla canónica (lee `docs/adr/0007-interaction-transport.md` como referencia de formato):
  1. `0013-codemirror6-en-canvas.md` — CodeMirror 6 sustituye a ProseMirror en `EditorView`.
  2. `0014-virtualizacion-chat-virtua.md` — `virtua` + umbral 60 mensajes.
  3. `0015-radix-select-accesible.md` — componente `Select` propio con semántica ARIA completa.
  4. `0016-shing-wen-worker.md` — resaltado de sintaxis fuera del hilo principal.
  5. `0017-context-compaction-llm-inyectable.md` — resumidor inyectable con fallback heurístico.
- Cada ADR: contexto · decisión · alternativas · consecuencias · estado. Nivel jerárquico según `docs/jerarquia-canonica.md`.

### T4 — `stack-tecnico.md` y `AGENTS.md` desactualizados (`EGO-FIND-78`)
- `docs/engineering/stack-tecnico.md:57` dice "**Monaco Editor**" → 0 hits de `monaco` en ningún `package.json`. Corrige a "CodeMirror 6" y añade la entrada del Web Worker de Shiki.
- `AGENTS.md:79-93`: el árbol lista **6 paquetes** (hay **18**) y dice "128 archivos .md" (hay **266**). Actualiza ambos, incluyendo `packages/avatar` y `packages/ui-runtime`, `packages/tool-call-repair`, `packages/integrations`, `packages/domains`, `packages/dailystate`, `packages/knowledge`, `packages/recovery`, `packages/security`, `packages/subegos`, `packages/tasks`, `packages/decision`.
- Revisa que la sección de restricciones duras siga siendo exacta (comprueba cada prohibición con grep antes de reescribirla).

### T5 — `docs/index.md` como índice real (`A1-13`, `A1-11`)
- Indexa lo que falta: `architecture/navigation-sidebar.md`, `architecture/ui-iframe-sandbox-spec.md`, `product/guia-mvp.md`, `engineering/testing-e2e.md`, `dev/e2e-skip-inventory.md`, `prompts/*`, `deployment/releases/v0.1.0-beta.1/release-notes.md`, y los backlogs de review ausentes.
- `docs/.vitepress/config.mts:26-34` expone solo 3 enlaces y `srcExclude: ['agent-ops/**']` deja fuera 165 de 266 documentos. Implementa la `sidebar` derivada de `docs/index.md`, o documenta honestamente el alcance en ADR-0006.
- Los 77 huérfanos (`69` en `agent-ops/`, 6 ADRs → resueltos en T3, 1 `dev/`, 1 `research/`): crea `docs/agent-ops/README.md` + `docs/agent-ops/tasks/README.md` con tabla ID→estado, o mueve a `docs/archive/`.

### T6 — Rutas rotas y punteros muertos (`A1-16`, `A1-17`)
- 22 punteros a `../prd/*` en 15 ficheros (carpeta eliminada por diseño) → sustituir por "histórico (eliminado, ver historial git)" o enlace al commit.
- `docs/engineering/vantadb-readiness-plan.md` cita `docs/dev/Backlog.md` (no existe) → `docs/roadmap/Backlog.md`.
- Barrido general: extrae rutas `packages/...`, `apps/...`, `docs/...` de TODOS los docs canónicos y verifica existencia. Reporta las rotas que no puedas arreglar por estar en zona ajena.

### T7 — `CHAR-03` y el duplicado del documento maestro (`EGO-FIND-79` parcial)
- `Backlog.md` marca `CHAR-03` ✅ Completada citando `docs/research/character-prototypes/character-prototypes.html` — **el artefacto no existe**. Reetiqueta la fila con la ruta real (`packages/avatar/src/render/projection.js` + `docs/research/character-audit-and-coucou-inventory.md`) o reabre la tarea con justificación. **No toques `docs/research/**`**: la decisión de ruta la toma A6; deja la fila en `Estado: 🆕 Pendiente` con una nota de que espera la decisión de A6, y anótalo en tu handoff.
- El documento maestro duplicado lo resuelve **A8** (borra la copia de la raíz, consolida en `docs/research/`). Tú solo actualizas `docs/index.md` para que apunte a la ruta canónica **después** de que A8 lo mueva; si A8 aún no lo ha hecho, deja un TODO en tu handoff. **No lo muevas tú** (no es tu zona).

### T8 — `packages/avatar` ausente de todo documento canónico (`A1-03` parcial)
- `docs/product/mascota.md:10` afirma "El personaje **NO es un avatar**" y sitúa el código en `apps/desktop/renderer/components/character/`. El producto real tiene `@ego/avatar`.
- **A6** reescribe `mascota.md`, `character-art-direction.md` y `character-system.md`. Tú NO los tocas (son de A6). Tu parte: añadir `packages/avatar` al árbol de `AGENTS.md` (T4) y al índice de `docs/index.md` (T5), y **dejar constancia** en `docs/architecture/arquitectura-unificada.md` de que el motor de personaje vigente es `@ego/avatar` con el motor legacy en estado "legacy/deprecado" — **solo si A6 confirma**; si no, anótalo en el handoff como pendiente de A6.

### T9 — Principio del owner: usar las primitives de librería, no recrearlas (`D3`)
**Decisión del owner (2026-10-19), vinculante para todo el repo:**
> *Los componentes de librerías y framework se utilizan siempre; no se recrean desde cero si ya existe una primitive de librería o del framework.*

- **Documéntalo en `AGENTS.md`** (§4, restricciones duras): el `ui-kit` propio solo puede existir cuando exista un motivo concreto (no por comodidad), y ese motivo debe estar escrito.
- Aplica la misma regla al resto de primitivas propias del repo (Modal, Tabs, Popover, Tooltip, Dropdown): si Radix/React Aria ofrece el equivalente y el propio no aporta nada, **migrar**. En `docs/architecture/arquitectura-unificada.md` o `docs/design/design-system.md`, deja la **tabla de primitives** con la decisión de cada una: "usada de librería" vs "propia, motivo X".
- A4 está migrando el `Select` a Radix (D3): **coordinas** — cuando A4 termine, su tabla de primitives debe quedar reflejada en `docs/design/design-system.md` (**tu zona**). Pídele en tu handoff la tabla final, o aplícala tú con lo que él reporte.

## DoD específico

- `pnpm lint` exit 0 (el lint cubre `docs/` vía markdownlint en CI, no localmente).
- 0 enlaces markdown relativos rotos entre los 266 documentos (verificado con un script de barrido, no a ojo).
- 0 rutas de código citadas en docs canónicos que no existan (salvo las que declares explícitamente en el handoff).
- 0 checkboxes de `roadmap.md` que contradigan el Backlog.
- 12 ADRs numerados sin colisión, todos en `docs/index.md`, cada uno con la plantilla común.
- `docs/index.md` lista todos los documentos canónicos.

## Handoff

`docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A1.md`
