# Backlog Format — esquema canónico de filas

> **CANONICAL SPEC — Formato único de los backlogs Ego (fuente única, decisión owner 2026-09-30, actualizado 2026-10-08).**
> Alcance: `docs/roadmap/Backlog.md` · `docs/review/backlog-*.md` · `docs/agent-ops/plans/*.md` — **toda tabla que liste tareas** usa este esquema (10 columnas canónicas).
> Referenciado por: `.agents/task-system/mcp/format-validator.mjs` · `.agents/task-system/mcp/sync-engine.mjs` · `commands/spec.md` · `commands/pipeline.md` · `.agents/references/definition-of-done.md`.

## 1. Esquema — 10 columnas (obligatorias, en este orden)

`| ID | Severidad | Hallazgo | Archivo:línea | Esfuerzo | Prioridad | Estado | Descripción | Relaciones | Dependencias |`

| Columna | Contenido | Vocabulario |
|---|---|---|
| **ID** | `` `PREFIX-NN` `` backticked en la primera celda | Requisito de parsers deterministas (regex `` ^\|\s*`([A-Z0-9]+-\d+)`\s*\| ``). Prefijos canónicos por fase y dominio: `CORE-*`, `ACT-*`, `SUB-*`, `CANV-*`, `INTEL-*`, `KB-*`, `TASK-*`, `DS-*`, `DOM-*`, `REC-*`, `SEC-*`, `DIST-*`; y de repositorios de referencia: `HERM-*`, `OCLW-*`, `COUC-*`, `KHOJ-*`, `HELM-*`, `CARP-*`, `DSEK-*`. Prohibido crear prefijos ad-hoc sin registrarlos. |
| **Severidad** | Impacto si NO se resuelve | `🔴 Crítica` · `🟠 Alta` · `🟡 Media` · `🟢 Baja` · `ℹ️ Info` · `—` (no aplica: features, decisiones, deuda menor) |
| **Hallazgo** | Título corto en **negrita** (1 línea) | — |
| **Archivo:línea** | Ubicación exacta | `ruta:línea`; varias separadas por ` · `; `—` si no aplica |
| **Esfuerzo** | Estimación de trabajo | `🟢 0.5-1d` · `🟡 1-2d` · `🟠 2-3d` · `🔴 1-2sem` |
| **Prioridad** | Orden de ataque | `🔴 P0` · `🟠 P1` · `🟡 P2` · `🔵 P3` · `⬜ Sin priorizar` |
| **Estado** | Situación actual | `🆕 Pendiente` · `⏳ En curso` · `✅ Completada` · `🚫 Descartada: <Fundamento técnico>` · `⏸️ Bloqueada: <motivo>` · `🧊 Icebox` · `🔮 Futuro: <trigger>` |
| **Descripción** | Contexto y acción | Contexto: problema → acción → resultado. |
| **Relaciones** | Trazabilidad y vínculos | `Ego: <ID>` · `Origen: <plan#task · commit · reporte>` · `Fuente: <research/reporte>` · `Ver: <IDs>` · `Supersede: <ID>` |
| **Dependencias** | Bloqueos / prerequisites | `Dep: <ID>` · `Requiere: <condición>` · `—` |

### Reglas de fila
1. Una fila = una tarea/hallazgo, en UN solo backlog (no duplicar entre archivos; referencia cruzada con `Ver:`).
2. Columna sin dato → `—`, nunca celda vacía (render + parse determinista).
3. Links dentro de celdas: escapar pipes `\|`.
4. Las tablas de resumen (Exec Summary, notas de cierre, logs de migración completados) NO son tablas de tareas — fuera de este esquema.

## 2. Ejemplos por tipo de fila

**Hallazgo (FIND):**
`| `FIND-213` | 🟠 Alta | **NL_POOL sin cap — leak en threads efímeros** | `src/index/search/pool.rs` | 🟡 1d | 🟠 Media | 🆕 Pendiente | El `thread_local` `NL_POOL` (`Vec<NeighborVec>`) crece sin límite si muchos threads hacen search; `drop` no limpia el pool (1000 workers → 100k NeighborVec retenidos). | Origen: auditoría PDFs OLD 2026-09-30 | — |`

**Tarea de fase:**
`| `SCH-09` | — | **Confianza: revalidación programada** | `src/sdk/…` | 🟠 2-3d | 🔴 Alta | 🆕 Pendiente | 🎯 OP: … · OS: … | Origen: auditoría externa 2026-09-25 | Dep: SCH-04 |`

**Fila futura:**
`| `FUT-24` | — | **IVF: semilla determinista en build** | `src/index/ivf.rs` | 🟡 1d | 🔵 Futuro | 🔮 Futuro: caso de uso | Forgy init + Lloyd sin seed fija → índices no reproducibles. | Origen: auditoría PDFs OLD 2026-09-30 | — |`

**Fila de negocio (humana):**
`| `BIZ-16` | — | **Firmar binarios Windows (Authenticode)** | — | 🟠 2-3d + coste | 🟠 Media | 🆕 Pendiente | Certificado EV + `signtool` en release + checksums GPG. | Origen: R7 análisis 2026-07-26 · Dueño: owner | Dep: certificado EV |`

## 3. Protocolo Canónico de Descarte Justificado (Veredicto Técnico)

### A. Justificación y Necesidad
En auditorías y compuertas de extracción de `repos-referencia/`, un patrón evaluado con frecuencia no aplica a Ego por restricciones duras de arquitectura (ej: dependencia de SQLite o FastAPI, runtime Python local prohibido en P0 según `AGENTS.md` §4, o sobreingeniería manifiesta).
- **El Problema:** Dejar la tarea en `🆕 Pendiente` bloquea artificialmente las dependencias aguas abajo en el grafo de tareas y contamina el backlog. Marcarla como `✅ Completada` genera un falso positivo grave, dando a entender que existe código implementado y testeado cuando en realidad no se programó nada.
- **La Solución:** Toda tarea descartada debe recibir el estado explícito:
  `🚫 Descartada: <Fundamento técnico>`

### B. Reglas de Aplicación del Descarte
1. **Fundamento Obligatorio:** Todo descarte requiere una justificación técnica concisa en la misma celda (ej: `🚫 Descartada: Incompatible con VantaDB nativo; viola AGENTS.md §4 (prohibido SQLite)`).
2. **Integridad de Tabla Markdown:** El texto del fundamento técnico tiene estrictamente prohibido contener caracteres `|` o saltos de línea para preservar las 10 columnas exactas.
3. **Liberación Formal de Compuertas:** Marcar una tarea como `🚫 Descartada: <Fundamento>` cierra formalmente la compuerta (`GATES: <ID>`), permitiendo que el implementador de la tarea principal de Ego continúe sin dependencias bloqueadas.
4. **Sincronización Atómica:** El motor de sincronización (`.agents/task-system/mcp/sync-engine.mjs`) actualiza automáticamente la tabla del backlog, el task file correspondiente (creando la sección `## Veredicto de Descarte Justificado`) y el estado transaccional.

### C. Ejemplos de Filas Descartadas

`| `HERM-14` | 🟠 Alta | **Semántica de timeline con SQLite** | `hermes_state_timeline.py` | 🟡 1-2d | 🟠 P1 | 🚫 Descartada: Prohibido SQLite; Ego usa VantaDB Fjall LSM | Ego: `CORE-07` | `HERM-13` |`

`| `KHOJ-02` | 🟡 Media | **Procesador Python FastAPI para DOCX** | `pdf_to_entries.py` | 🟡 1-2d | 🟠 P1 | 🚫 Descartada: Requiere Python local prohibido en P0 según AGENTS.md §4 | Ego: `KB-01` | — |`

## 4. Compatibilidad con el task-system y MCP

- **`format-validator.mjs`** — Valida estrictamente las 10 columnas y reconoce `🚫 Descartada: <Fundamento>` como estado válido de terminación sin advertencias.
- **`sync-engine.mjs`** — Permite la transición determinista a `DISCARDED`, sanitiza pipes y actualiza `Backlog.md` y `docs/agent-ops/tasks/<ID>.md`.
- **`task_get_next`** — Filtra automáticamente las tareas descartadas y completadas para ofrecer únicamente trabajo activo real.
- **`task_update_state`** — Exige el parámetro `evidence` si el nuevo estado es `DISCARDED`, impidiendo descartes silenciosos o injustificados.
