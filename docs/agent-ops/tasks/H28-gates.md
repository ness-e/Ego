# H28 — Veredictos de Compuertas de Extracción Pendientes (Opción B)

> **Contrato:** auditoría documental de 4 gates (HERM-12/17/19, COUC-15) según
> Opción B (`AGENTS.md:114-119`). Solo lectura + propuesta docs.
> **Prohibido en esta tarea:** editar `docs/roadmap/Backlog.md`, código `src/`,
> `.agents/**`, o commitear. Los Estados del Backlog NO se tocan aquí; los
> veredictos son propuesta al owner.
> **Referencias:** `.agents/rules/task-lifecycle.md` §6, `docs/roadmap/Backlog.md:53`.
> **Fecha:** 2026-10-13 · **Rol:** `ego-arch`.

## Convención de veredictos

- **CERRAR** = el patrón ya está asimilado y verificado en código + tests; la
  compuerta cumplió su función (no es un descarte).
- **DESCARTAR (con justificación)** = colisiona con guardrails; formato §6 de
  `task-lifecycle.md`.
- **BLOQUEO** = requiere decisión de producto, no técnica.

---

## Gate 1 — HERM-12: Parser y autocompletado de comandos slash (`slash.ts`)

### Hallazgo
`apps/shared/src/slash.ts` de `hermes-agent`: parser y autocompletado en el
composer para comandos rápidos (`/reset`, `/compact`, `/model`, `/skill`).
Ficha canónica: `docs/extractions/hermes-agent.md` §Bloque C.1 (líneas 85-88):
adaptación como comandos slash en el Composer para invocar Sub-Egos (`/subego`)
y cambiar modelos (`/model`). Backlog de revisión: `docs/review/backlog-hermes.md:47`
→ ✅ Completada. Matriz Fase 03 (`docs/roadmap/Backlog.md:151`) → 🆕 Pendiente
(habilita `SUB-01`, `SUB-02`).

### Evidencia de código existente
- Implementación: `packages/ui-runtime/src/SlashCommandParser.ts:2`
  (parser multilínea canónico + autocompletado difuso `/model`, `/subego`,
  `/resume`, `/compact`, `/help`).
- Tests: `packages/ui-runtime/test/FuzzyAndSlash.test.ts:9`
  (`describe("HERM-10 & HERM-12: FuzzySearch and SlashCommandParser")`,
  bloque `SlashCommandParser` en línea 41).
- Commit: `9eab759` — `feat(hermes): implement batch 3 - ... slash commands ...
  (HERM-09, HERM-10, HERM-11, HERM-12)` (verificado con
  `git log --oneline -3 -- packages/ui-runtime/src/SlashCommandParser.ts`).

### Veredicto
**CERRAR** (patrón asimilado; no descartar).

### Justificación
- **Factibilidad vs guardrails:** TypeScript puro en `packages/ui-runtime`,
  sin Python, sin SQLite, sin JSON-RPC. Compatible con los 10 principios
  (herramienta de UX del chat, sin lógica de negocio en renderer más allá de
  presentación). Sin colisión con prohibiciones de `AGENTS.md`.
- **INV-PROBLEMA:** la evidencia demuestra asimilación + verificación en
  código + tests + commit dedicado. El estado 🆕 Pendiente de la matriz Fase 03
  (:151) describe el estado de las tareas downstream `SUB-01`/`SUB-02`
  (revertidas 2026-10-13 a la espera de esta compuerta), no la ausencia del
  patrón. La compuerta cumplió su función de inspección previa.
- **Nota de alcance:** cerrar HERM-12 habilita (no ejecuta) el desbloqueo de
  `SUB-01`/`SUB-02`; ese cambio de Estado lo decide el owner fuera de H28.

---

## Gate 2 — HERM-17: Aislamiento de Subagentes con Git Worktrees (RFC-01)

### Hallazgo
`tools/subagent_worktree.py` de `hermes-agent`: Sub-Egos de Ingeniería trabajan
en un `git worktree` temporal para no tocar archivos en vivo ni romper builds.
Ficha canónica: `docs/extractions/hermes-agent.md:132-133` (RFC-01, asignado a
`SUB-07`/`SUB-08`, ruta `.ego/worktrees/<id>`). Backlog de revisión:
`docs/review/backlog-hermes.md:52` → ✅ Completada. Matriz Fase 03
(`docs/roadmap/Backlog.md:152`) → 🆕 Pendiente (habilita `SUB-07`).
**Doble registro:** `docs/roadmap/Backlog.md:378` (matriz Fase 09/Dominios)
marca este mismo `HERM-17` como ✅ Completada para `DOM-01`.

### Evidencia de código existente
- Implementación: `packages/subegos/src/SubEgoWorktree.ts:2`
  (`SubEgoWorktreeManager`, clase en línea 30; gestión de `git worktree`,
  bifurcación segura, reporte HITL). Re-exportado en
  `packages/subegos/src/index.ts:14`.
- Tests: `packages/subegos/test/SubEgoWorktree.test.ts:4`
  (`describe("HERM-17: SubEgoWorktreeManager (Aislamiento con Git Worktrees)")`).
- Commit: `d4ee684` — `feat(hermes): implement batch 4 - ... subagent worktrees ...
  (HERM-14, HERM-17, HERM-18)` (verificado con
  `git log --oneline -3 -- packages/subegos/src/SubEgoWorktree.ts`).

### Veredicto
**CERRAR** (patrón asimilado; no descartar).

### Justificación
- **Factibilidad vs guardrails:** TypeScript/Node (git CLI vía worktrees),
  sin runtime Python — solo se extrajo el patrón, la implementación Python se
  descartó conforme a la ficha §2 (línea 25). Sin colisión con prohibiciones.
- **INV-PROBLEMA:** asimilación verificada en código + tests + commit. El doble
  registro interno del Backlog (✅ en :378 para `DOM-01` vs 🆕 en :152 para
  `SUB-07`) confirma que el patrón existe; :152 refleja la pendencia de la tarea
  downstream `SUB-07` (registro/catálogo en `gov/sub_egos`), no la ausencia del
  mecanismo de worktrees.
- **Nota de alcance:** cerrar HERM-17 habilita (no ejecuta) el desbloqueo de
  `SUB-07`; cambio de Estado reservado al owner.

---

## Gate 3 — HERM-19: Auditoría AST y Linter de Skills (RFC-03)

### Hallazgo
`tools/skills_ast_audit.py` + `skill_linter.py` de `hermes-agent`: validación
sintáctica y de seguridad sobre AST para inspeccionar herramientas generadas
dinámicamente antes de su registro. Ficha canónica:
`docs/extractions/hermes-agent.md:136-137` (RFC-03, asignado a `SUB-05`;
la fila de revisión cita además `ACT-11`). Backlog de revisión:
`docs/review/backlog-hermes.md:54` → ✅ Completada. Registros en Backlog
maestro: :122 → ✅ Completada (para `ACT-11`); :153 → 🆕 Pendiente (para
`SUB-05`); :440 → 🆕 Pendiente (para `SEC-01`, `SEC-05`).

### Evidencia de código existente
- Implementación: `packages/integrations/src/skills/SkillLinter.ts:2`
  (`SkillLinter — Auditoría Sintáctica y de Seguridad de Skills (HERM-19)`;
  clase en línea 82; inspecciona manifiestos y código antes del registro).
  Re-exportado en `packages/integrations/src/index.ts:5`. Consumidor:
  `packages/integrations/src/skills/SkillScanner.ts:4`.
- Tests: `packages/integrations/test/SkillLinter.test.ts:8`
  (`describe("SkillLinter (Auditoría AST y de Seguridad - HERM-19)")`).
- Commit: `9eea2e0` — `feat(integrations): implement local MCP servers manager,
  tool marketplace, and skill AST linter (ACT-11)` (verificado con
  `git log --oneline -3 -- packages/integrations/src/skills/SkillLinter.ts`).

### Veredicto
**CERRAR** (patrón asimilado; no descartar).

### Justificación
- **Factibilidad vs guardrails:** TypeScript (AST TS/Babel según ficha, no
  `ast` de Python en runtime), integrado al gestor/marketplace local de MCP y
  Skills (`ACT-11` ✅ Completada, :138). Sin runtime Python en P0. Sin colisión.
- **INV-PROBLEMA:** el patrón está asimilado y verificado (código + tests +
  commit + tarea consumidora `ACT-11` completada). Las filas 🆕 :153 (`SUB-05`:
  control de acceso a namespaces) y :440 (`SEC-01`/`SEC-05`: sandboxing y matriz
  de permisos) son **aplicaciones downstream** del linter en otros dominios,
  no la extracción del patrón en sí. La compuerta de inspección previa cumplió
  su función; el trabajo restante es implementación de tareas, no extracción.
- **Nota de alcance:** cerrar HERM-19 no completa `SUB-05` ni `SEC-01`/`SEC-05`;
  esas tareas conservan su propio Estado y esfuerzo.

---

## Gate 4 — COUC-15: Mock IPC para iteración aislada de UI

### Hallazgo
`windows/src/core/bridge.ts` de `coucou`: capa de transporte falsa que permite
ejecutar y probar componentes del Dynamic Workspace en navegador estándar sin
Electron ni Node.js. Ficha canónica: `docs/extractions/coucou.md` §27-28
(líneas 1142-1193: `Bridge` → contrato IPC tipado de Ego + `MockIPC`/
`MockRuntime`/`SyntheticEventSource` para iterar UI sin infraestructura
nativa). Backlog de revisión: `docs/review/backlog-coucou.md:51` → ✅ Completada.
**Contradicción detectada (pista F6T12 confirmada):** matriz Fase 04
(`docs/roadmap/Backlog.md:217`) marca `COUC-15` como ✅ Asimilada, mientras la
fila `CANV-12` (:239) dice textualmente *"Usa la compuerta `COUC-15` ya
declarada y pendiente"* y está **Revertida 2026-10-13 por decisión owner (H28):
compuerta `COUC-15` pendiente**. Verificación contra contenido de la ficha (no
contra estados): el patrón descrito en la ficha existe en código.

### Evidencia de código existente
- Implementación: `packages/ui-runtime/src/MockIPCBridge.ts:89`
  (clase `MockIPCBridge`, `createMockApi` en línea 96; modos strict/permissive,
  rechazo de `apiKey` en claro en línea 223 — coherente con el boundary de
  secretos de la ficha §26).
- Tests: `packages/ui-runtime/test/MockIPCBridge.test.ts:4`
  (`describe("COUC-15: MockIPCBridge (Browser & Isolated UI Testing)")`).
- Commits: `e16f3d5` — `feat(coucou): implement batch 3 - reactive stores,
  synthetic runtime, and mock ipc bridge (COUC-05, COUC-14, COUC-15)`; además
  `c780f28` toca el archivo (verificado con
  `git log --oneline -3 -- packages/ui-runtime/src/MockIPCBridge.ts`).
- Referencia externa: `docs/review/revision-proyecto/revision-proyecto-2026-10-12.md:377,383,389`
  cita `MockIPCBridge.ts:85/45/8`.

### Veredicto
**CERRAR** (patrón asimilado; no descartar). **Cuál miente:** miente la
descripción de `CANV-12` (:239), no la matriz Fase 04 (:217).

### Justificación
- **Factibilidad vs guardrails:** TypeScript puro, refuerza el boundary de
  seguridad Electron (renderer untrusted, `contextIsolation=true`) al permitir
  testear sin exponer Node/VantaDB al renderer. Sin colisión; al contrario,
  es facilitador de `SEC-01`.
- **Resolución de la contradicción:** la ficha (§27) exige exactamente lo que
  el código implementa (bridge tipado + fallbacks no-op para navegador). La
  matriz :217 (✅ Asimilada) es consistente con la evidencia; el texto de
  `CANV-12` (*"ya declarada y pendiente"*) es obsoleto respecto al contenido de
  la ficha y al commit `e16f3d5`. **Propuesta (no aplicada, fuera de alcance
  H28):** corregir la descripción de `CANV-12` a *"Usa la compuerta `COUC-15`
  ya asimilada (matriz Fase 04 ✅); pendiente solo la suite vitest en sí"* y
  re-evaluar su reversión en el mismo acto en que el owner procese este
  expediente.
- **Nota de alcance:** cerrar COUC-15 no implementa `CANV-12` (la suite vitest
  sigue sin existir); solo declara disponible su prerrequisito.

---

## Resumen de veredictos

| Gate | Patrón | Evidencia | Veredicto |
|:---:|---|---|:---:|
| HERM-12 | Slash commands | `SlashCommandParser.ts:2` + test + `9eab759` | **CERRAR** |
| HERM-17 | Git worktrees | `SubEgoWorktree.ts:2` + test + `d4ee684` (+ :378 ✅) | **CERRAR** |
| HERM-19 | Linter AST Skills | `SkillLinter.ts:2` + test + `9eea2e0` (+ :122 ✅) | **CERRAR** |
| COUC-15 | Mock IPC Bridge | `MockIPCBridge.ts:89` + test + `e16f3d5` (+ :217 ✅) | **CERRAR** |

**Estados tocados:** 0. **Commits:** 0. **Decisiones de producto requeridas:**
ninguna (ningún BLOQUEO). Todos los patrones son TypeScript/React/VantaDB sin
runtime Python, sin SQLite, sin JSON-RPC interno — 0 colisiones con guardrails,
0 descartes. El desbloqueo downstream (`SUB-01`, `SUB-02`, `SUB-05`, `SUB-07`,
`CANV-12`, `SEC-01`, `SEC-05`) queda a decisión del owner con este expediente
como evidencia.
