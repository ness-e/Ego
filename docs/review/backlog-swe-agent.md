---
kind: review
status: active
description: >-
  Backlog especializado para la revisión, extracción de patrones y adaptación técnica de swe-agent hacia el
  monorepo de Ego.
tags: [ego, swe-agent, extraction, review, aci, tool-contract, agent-computer-interface, context-elision]
schema: "10-column canonical schema (.agents/references/backlog-format.md compatible)"
---

# Backlog de Revisión y Extracción: SWE-agent (SWE-agent/SWE-agent) #

## ACI, contrato tool↔modelo, control de resultado y presupuesto — 9 tareas (`SWAG-01..09`) ##

| Campo | Valor |
| --- | --- |
| Estado | Activo — backlog de revisión abierto, sin asimilaciones previas |
| Repositorio Origen | `repos-referencia/swe-agent/` (commit `3ea751c`, rama `main`, profundidad 1) |
| Total de Tareas | **9** (`SWAG-01..09`) |
| Fases Impactadas en Ego | 01 (`CORE`), 02 (`ACT`), 03 (`SUB`), 06 (`KB`), 07 (`TASK`) |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Última verificación | 2026-10-20 — grep sobre `packages/` + `apps/desktop/` (excluye `test/`, `dist/`, `node_modules/`) |

> **Propósito:** Registro canónico de la auditoría, extracción y adaptación de los patrones del diseño **ACI
> (Agent-Computer Interface)** de SWE-agent hacia el monorepo de Ego.
>
> **Regla de Operación:** *No copiar código directamente*. Extraer la lógica de diseño, contratos y patrones
> arquitectónicos, reescribiéndolos en TypeScript estricto, React 19 y Node 22 Main Process, apoyándose en VantaDB
> como sustrato de memoria.
>
> **Esquema:** Tabla canónica de 10 columnas:
> `| ID | Severidad | Hallazgo | Archivo SWE-agent | Esfuerzo | Prioridad | Estado |
> Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |`

---

## 0. Verificación de estado (2026-10-20) ##

**Nota de alcance:** repositorio de referencia **nuevo**. Ningún patrón de SWE-agent ha sido asimilado todavía en
`packages/` ni en `apps/desktop/`. Por tanto **no puede existir ninguna fila en `✅ Completada`**: el criterio de
cierre exige fichero adaptado **y** caller en producción verificado por grep, y en este repo ninguna de las dos cosas
es satisfacible todavía.

| Estado | Significado canónico | Recuento |
| --- | --- | --- |
| `✅ Completada` | Asimilado, integrado y con **caller en producción verificado**. La celda cita la ruta real. | 0 |
| `🚫 Descartada (con justificación)` | El patrón no se aplica en Ego, fue sustituido por otro módulo canónico, o viola un guardrail. La celda contiene el motivo técnico. | 2 |
| `🆕 Pendiente` | Patrón que debe asimilarse; el cableado exacto y el responsable van en la celda. | 7 |
| `⏳ Futura (fase)` | Diferido a una fase posterior, con fase destino explícita. | 0 |

```text
Select-String "SubEgoBudgetTracker" packages/ apps/ -> packages/subegos/src/SubEgoBudget.ts:103 (+ tests)
Select-String "toolGuide|renderToolGuide"          -> SubEgoSoul.ts:143,444 y PromptAssembly.ts:118,247 (guía manual)
Select-String "fs_grep" packages/tools/src/         -> NativeFsSearchTools.ts:166 (salida línea a línea, sin agrupar)
Select-String "SkillLinter" packages/ apps/         -> SkillLinter.ts:82 (manifiestos; no linter de resultado)
```

## 1. Resumen Ejecutivo de Tareas de Extracción ##

SWE-agent aporta a Ego la tesis de que **la calidad de un agente la decide su interfaz con la computadora (ACI), no el
modelo**. De sus cuatro hallazgos canónicos (`docs/background/aci.md:11-14`) tres son directamente asimilables: el
linter que bloquea una edición defectuosa, el visor de archivos por ventanas de 100 líneas y la búsqueda que lista
solo los ficheros con coincidencia. El cuarto —el mensaje explícito cuando una orden no produce salida— es la mitad
de un patrón mayor: el **contrato observación→prompt** (truncado con marcador + elisión determinista del historial).

| Grupo de Trabajo | Rango IDs | Tareas | Fases de Ego Impactadas | Prioridad | Beneficio Principal |
| --- | --- | --- | --- | --- | --- |
| **A. ACI y contrato tool↔modelo** | `SWAG-01` | 1 | Fase 01 (`CORE`), Fase 02 (`ACT`), Fase 03 (`SUB`) | 🔴 P0 | La guía de tools deja de escribirse a mano: se deriva del `ToolRegistry` |
| **B. Verificación del resultado** | `SWAG-02` | 1 | Fase 02 (`ACT`), Fase 03 (`SUB`) | 🔴 P0 | Gate + reversión: ninguna escritura defectuosa llega a disco |
| **C. Contrato observación→prompt** | `SWAG-03` | 1 | Fase 01 (`CORE`), Fase 02 (`ACT`), Fase 07 (`TASK`) | 🔴 P0 | El historial se elide sin coste de LLM y el modelo nunca ve un vacío ambiguo |
| **D. Lectura y búsqueda acotadas** | `SWAG-04`, `SWAG-05` | 2 | Fase 02 (`ACT`), Fase 04 (`CANV`), Fase 06 (`KB`) | 🟠 P1 | Menos tokens por turno y menos ambigüedad para el modelo |
| **E. Configuración y presupuesto** | `SWAG-06`, `SWAG-07` | 2 | Fase 01 (`CORE`), Fase 02 (`ACT`), Fase 03 (`SUB`) | 🔴 P0 / 🟠 P1 | Defaults versionados y cuotas de gasto con corte automático |
| **F. Descartes de guardrail** | `SWAG-08`, `SWAG-09` | 2 | Fase 01 (`CORE`), Fase 02 (`ACT`) | 🔴 P0 | Evita arrastrar Python, Docker, LiteLLM y dominio de benchmarks |
| **TOTAL** | `SWAG-01..09` | **9** | **Fases 01, 02, 03, 04, 06, 07** | — | — |

### Recuento de estados (verificado sobre las 9 filas de la tabla §2) ###

| `✅ Completada` | `🚫 Descartada` | `🆕 Pendiente` | `⏳ Futura` | Total |
| --- | --- | --- | --- | --- |
| 0 | 2 | 7 | 0 | **9** |

```text
  SWE-agent (SWAG-01..09) — 9 hallazgos
  ┌───────────────────────────────────────────────────────────────┐
  │ FASE 01 CORE      SWAG-03   SWAG-06   SWAG-07      🆕  🆕  🆕 │
  │ FASE 02 ACT       SWAG-01   SWAG-02   SWAG-04   🆕  🆕  🆕  🆕 │
  │ FASE 03 SUB       SWAG-01   SWAG-06   SWAG-07      🆕  🆕  🆕 │
  │ FASE 04 CANV      SWAG-04                       🆕              │
  │ FASE 06 KB        SWAG-05                       🆕              │
  │ FASE 07 TASK      SWAG-03                       🆕              │
  ├───────────────────────────────────────────────────────────────┤
  │ DESCARTE GUARDRAIL SWAG-08 (Python+Docker+SWE-bench)       🚫 │
  │                   SWAG-09 (LiteLLM como router)             🚫 │
  └───────────────────────────────────────────────────────────────┘
  ✅ 0  ·  🚫 2  ·  🆕 7  ·  ⏳ 0   →  9 tareas
```

---

## 2. Catálogo Detallado de Extracción (10 Columnas Canónicas) ##

| ID | Severidad | Hallazgo | Archivo SWE-agent | Esfuerzo | Prioridad | Estado | Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `SWAG-01` | 🟠 Alta | **Contrato tool→documentación auto-generada (ACI)** | `sweagent/tools/commands.py:79-205`, `sweagent/tools/utils.py:75-107`, `sweagent/tools/tools.py:214-218` | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | Una sola declaración (`name`, `docstring`, `signature`, argumentos tipados) alimenta a la vez el schema function-calling (`commands.py:133-165`) y el texto de documentación que se inyecta en el system prompt (`tools.py:214-218` → `agents.py:667`). En Ego el schema ya existe (`packages/tools/src/ToolRegistry.ts:207,231`) pero la guía llega a mano al prompt (`packages/subegos/src/PromptAssembly.ts:118,247`, `packages/subegos/src/SubEgoSoul.ts:143,444`). **Cableado:** crear `packages/tools/src/ToolContractDocs.ts` con `renderToolGuide(registry)` y consumirlo en `buildStableTier` desde `SubEgoRuntime` (owner A4). | Ego: `ACT-01`, `ACT-02`, `CORE-03`, `SUB-01` · Extracción: `docs/extractions/swe-agent.md` §Bloque A | — |
| `SWAG-02` | 🟠 Alta | **Gate de linter sobre el resultado post-ejecución, con reversión** | `tools/windowed_edit_linting/bin/edit:94-119`, `tools/windowed/lib/flake8_utils.py:92-134` | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | El patrón "lint previo → aplicar → lint posterior → si hay errores **nuevos**, `undo_edit()` + diff aplicado vs. original + código de salida 1" es una garantía transaccional para tools destructivas; `flake8_utils.py:92-134` aísla el ruido preexistente reindexando líneas para no culpar a la acción de deuda ajena. Ego solo tiene un linter de **manifiestos** (`packages/integrations/src/skills/SkillLinter.ts:82`), no de **resultado**. **Cableado:** gate opcional tras `fs_write_file` / `terminal_exec` en `packages/execution/src/ExecutionManager.ts` (owner A2/A4). | Ego: `ACT-04`, `ACT-06`, `ACT-08`, `SUB-05` · Extracción: `docs/extractions/swe-agent.md` §Bloque B | `SWAG-01` |
| `SWAG-03` | 🟠 Alta | **Elisión determinista de observaciones y marcador explícito de salida vacía** | `sweagent/agent/history_processors.py:85-176`, `sweagent/agent/agents.py:69-82`, `:729-746` | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | `LastNObservations` conserva las últimas `n` observaciones íntegras y sustituye el resto por `"Old environment output: (n lines omitted)"`, con `polling` para no invalidar el prompt cache y etiquetas `keep_output`/`remove_output` por tool. El segundo artefacto es el mensaje explícito de "comando ejecutado sin salida" (`agents.py:730-732`), que evita que el modelo interprete un vacío como fallo. En Ego `packages/runtime/src/ToolExecutionLoop.ts:384` inserta `res.text \|\| ""` y `packages/runtime/src/ContextCompaction.ts:491` solo compacta con resumidor LLM. **Cableado:** processor de elisión previo al query en `ToolExecutionLoop` (owner A2). | Ego: `ACT-03`, `ACT-08`, `CORE-05`, `TASK-02` · Extracción: `docs/extractions/swe-agent.md` §Bloque C | — |
| `SWAG-04` | 🟡 Media | **Lectura paginada por líneas con posición navegable** | `tools/windowed/lib/windowed_file.py:53-115`, `config/sweagent_0_7/07.yaml:88-96` | 🟢 1d | 🟠 P1 | 🆕 Pendiente | El archivo se muestra en ventanas de `WINDOW`=100 líneas con `OVERLAP`=2, con comandos `open/goto/scroll_up/scroll_down` y estado persistido en registro en fichero (`tools/registry/lib/registry.py:7-56`); el paper reporta que `cat` completo confunde al modelo. Ego `fs_read_file` corta por **bytes** (`offset`/`maxBytes`) y devuelve texto plano sin numeración (`packages/tools/src/native/fs/NativeFsTool.ts:18-26,76-116`). **Cableado:** parámetros `lineStart`/`lineCount` + numeración en `createFsReadFileTool` (owner A4). | Ego: `ACT-04`, `CANV-02` · Extracción: `docs/extractions/swe-agent.md` §Bloque B | `SWAG-01` |
| `SWAG-05` | 🟡 Media | **Búsqueda sucinta: listar solo los ficheros con ≥1 coincidencia** | `tools/search/bin/search_dir:18-36` | 🟢 0.5-1d | 🟠 P1 | 🆕 Pendiente | `search_dir` agrupa por fichero (`archivo (N matches)`) y aborta pidiendo estrechar si casan más de 100 ficheros; el paper descarta explícitamente el contexto por match por confuso para el modelo. Ego `fs_grep` devuelve `matches[]` con `{path, line, text}` — volcado línea a línea (`packages/tools/src/native/fs/NativeFsSearchTools.ts:263-269`). **Cableado:** modo `groupByFile` + tope de ficheros en `createFsGrepTool` (owner A3). | Ego: `ACT-04`, `KB-04` · Extracción: `docs/extractions/swe-agent.md` §Bloque C | — |
| `SWAG-06` | 🟠 Alta | **Configuración por defecto en YAML + overrides de CLI + validación estricta** | `sweagent/utils/config.py:15-58`, `sweagent/run/common.py:286-367`, `sweagent/run/run_single.py:83-122`, `sweagent/agent/agents.py:149-167` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | Defaults versionados en YAML, fusión ordenada de varios `--config`, overrides de CLI por clave punteada (`--agent.model.name`), `extra="forbid"` para rechazar claves desconocidas y `_get_auto_correct` (`run_single.py:104-122`) que sugiere el parámetro válido cuando el usuario escribe uno obsoleto. Ego no tiene un sistema de defaults del runtime: `packages/execution/src/SafeConfigMutation.ts` es otra cosa (mutación atómica de config MCP). **Cableado:** esquema de defaults + merge en `packages/subegos/src/SubEgoManifest.ts` (owner A2). | Ego: `SUB-01`, `SUB-02`, `ACT-09`, `CORE-03` · Extracción: `docs/extractions/swe-agent.md` §Bloque D | `SWAG-01` |
| `SWAG-07` | 🟠 Alta | **Límites de coste por instancia, total y por llamada** | `sweagent/agent/models.py:66-150`, `:292-308`, `:632-670` | 🟢 1d | 🔴 P0 | 🆕 Pendiente | Tres límites independientes (`per_instance_cost_limit` 3.0 USD por defecto, `total_cost_limit`, `per_instance_call_limit`) verificados tras cada llamada; al superar cualquiera se aborta el turno. `InstanceStats` (`:292-308`) acumula coste, tokens y nº de llamadas. Ego tiene el módulo equivalente **pero sin caller de producción**: `packages/subegos/src/SubEgoBudget.ts:103` (`SubEgoBudgetTracker`) solo aparece en su propio fichero y en `packages/subegos/test/` + `tests/e2e/`. **Cableado:** instanciarlo en `packages/subegos/src/SubEgoRuntime.ts` y cortarlo en `packages/models/src/ModelRouter.ts` (owner A2). | Ego: `SUB-09`, `SUB-03`, `CORE-03` · Extracción: `docs/extractions/swe-agent.md` §Bloque D | — |
| `SWAG-08` | 🔴 Crítica | **Runtime Python + harness Docker/SWE-ReX + dataset SWE-bench** | `sweagent/environment/swe_env.py:27-28`, `sweagent/run/run_batch.py`, `sweagent/run/batch_instances.py` | 🟣 3-5d | 🔴 P0 | 🚫 Descartada (con justificación) | AGENTS.md §4 prohíbe Python como dependencia de núcleo en P0; el despliegue es un contenedor Docker por instancia (imagen `python:3.11`) que contradice el desktop local-first soberano y el principio 6 (la aprobación la impone el `ApprovalEngine` del host, no un runtime aislado). El dataset SWE-bench pertenece al dominio de software engineering: importarlo sería contaminación de dominio ajena a un SOC. Se extrae solo el patrón de configuración y de presupuestos (SWAG-06, SWAG-07). | Ego: `AGENTS.md §4`, `CORE-01`, `SEC-01` | — |
| `SWAG-09` | 🔴 Crítica | **LiteLLM como capa de inferencia unificada** | `sweagent/agent/models.py:15`, `:578-903` | 🟣 3d | 🔴 P0 | 🚫 Descartada (con justificación) | AGENTS.md §1 fija AI SDK v7 como **adaptador** y el `ModelRouter` propio como arquitectura. Añadir LiteLLM (`sweagent/agent/models.py:15`) crearía una segunda abstracción de modelos en competencia con `packages/models/src/ModelRouter.ts` y `packages/models/src/ModelCatalog.ts`, partiría el cálculo de coste (`litellm.cost_calculator`, `models.py:744`) y añadiría una dependencia nativa ajena al stack. Lo único asimilable es la semántica de *fallbacks* multi-proveedor, que ya está en el `ModelRouter`. | Ego: `CORE-03`, `CORE-04` | — |

---

## 3. Matriz de Integración con el Backlog Maestro ##

Cada tarea `SWAG-*` se ejecuta como **compuerta de extracción e inspección previa** de la fase que indica su columna
"Relaciones Ego", conforme al Protocolo Opción B de `docs/roadmap/Backlog.md`.

```text
        ┌──────────────────────────────────────────────────────────┐
        │          SWE-agent — REVIEW & EXTRACTION (SWAG)          │
        └──────────────────────────────────────────────────────────┘
   ┌────────┬─────────┬──────────┬──────────┬─────────┬─────────┐
   │ SWAG-01│ SWAG-02 │ SWAG-03  │ SWAG-04  │ SWAG-05 │ SWAG-07 │
   │ ACI    │ LINTER  │ ELISIÓN  │ LECTURA  │ BÚSQ.   │ COSTE   │
   └────────┴─────────┴──────────┴──────────┴─────────┴─────────┘
        │         │         │          │          │         │
   ┌────▼─────────▼─────────▼──────────▼──────────▼─────────▼────┐
   │ FASE 02 · ACT  → SWAG-01 SWAG-02 SWAG-04 SWAG-05             │
   │ FASE 01 · CORE → SWAG-03   │ FASE 03 · SUB → SWAG-01 SWAG-06 │
   │ FASE 04 · CANV → SWAG-04   │ FASE 06 · KB → SWAG-05          │
   │ FASE 07 · TASK → SWAG-03   │ DESCARTE    → SWAG-08 SWAG-09   │
   └───────────────────────────────────────────────────────────────┘
```

## 4. Deuda abierta derivada de esta verificación (→ handoff owner) ##

| # | Ítem | Tipo | Owner | Bloqueante |
| --- | --- | --- | --- | --- |
| D1 | `SWAG-07`: `SubEgoBudgetTracker` (`packages/subegos/src/SubEgoBudget.ts:103`) está implementado y probado pero **sin caller en producción** — las cuotas de gasto de `SUB-09` no se aplican en el camino real | Código | A2 | No |
| D2 | `SWAG-03`: `ToolExecutionLoop` inyecta `res.text \|\| ""` (`packages/runtime/src/ToolExecutionLoop.ts:384`); una tool sin salida es indistinguible de un fallo para el modelo | Código | A2 | No |
| D3 | `SWAG-01`: la guía de tools del system prompt se escribe a mano por Sub-Ego (`SubEgoSoul.ts:143,444`), con riesgo de divergir del `ToolRegistry` real | Código | A4 | No |
| D4 | `SWAG-05`: `fs_grep` devuelve coincidencias línea a línea (`NativeFsSearchTools.ts:263-269`), consumiendo tokens del contexto del modelo con ruido de bajo valor | Código / UX | A3 | No |
| D5 | `SWAG-02`: no existe verificación del **resultado** de una tool destructiva; el único linter de Ego audita manifiestos (`SkillLinter.ts:82`), no la salida | Código | A2/A4 | No |
| D6 | `SWAG-06`: el runtime de Ego carece de defaults versionados + overrides; el modelo de configuración del producto vive disperso entre manifiesto, `UserPrefs` y `SafeConfigMutation` | Decisión | A2 | No |
