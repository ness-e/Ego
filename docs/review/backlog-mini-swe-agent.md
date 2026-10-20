---
kind: review
status: active
description: "Backlog especializado para la revisión, extracción de patrones y adaptación técnica de
  repos-referencia/mini-swe-agent hacia el monorepo de Ego."
tags: [ego, mini-swe-agent, extraction, review, agent-runtime, budget, observation, config]
schema: "10-column canonical schema (.agents/references/backlog-format.md compatible)"
---

# Backlog de Revisión y Extracción: mini-SWE-agent (SWE-agent/mini-swe-agent) #

## Bucle mínimo, presupuestos de turno, contrato de observación y configuración en capas ##

| Campo | Valor |
|---|---|
| Estado | Activo — Backlog canónico de revisión y extracción |
| Repositorio Origen | `repos-referencia/mini-swe-agent/` (Commit verificado: `04d809c`, rama `main`, profundidad 1) |
| Total de Tareas | **9** (`MSWE-01..09`) |
| Fases Impactadas en Ego | Fase 01 (Core), 02 (Acción), 03 (Sub-Egos), 04 (Canvas), 05 (Decision), 07 (Tasks), 09 (Dominios), 11 (Security) |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Última verificación | 2026-10-20 — grep sobre `packages/` + `apps/desktop/` (excluyendo `test/`, `dist/`, `node_modules/`) |

---

## 0. Verificación de estado (2026-10-20) — revisión de apertura ##

`repos-referencia/mini-swe-agent` es un **repositorio de referencia nuevo**: no existe asimilación previa, por lo
que **no hay ninguna tarea en estado `✅ Completada`**. Cada fila se ha cerrado en uno de los cuatro estados
canónicos de `AGENTS.md` §4 y `docs/extractions/README.md` §4, sin filas en el limbo.

| Estado | Significado canónico |
|---|---|
| `✅ Completada` | Asimilado, integrado y con **caller en producción verificado**. La celda cita la ruta real. |
| `🚫 Descartada (con justificación)` | El patrón no se aplica en Ego, fue sustituido por otro módulo canónico, o viola un guardrail. La celda contiene el motivo técnico. |
| `🆕 Pendiente` | Patrón con adaptación identificada pero **sin fichero adaptado ni caller en producción**. La celda dice el **cableado exacto** y **quién lo ejecuta**. |
| `⏳ Futura (fase)` | Diferido a una fase posterior, con fase destino explícita. |

### Búsquedas de verificación ejecutadas sobre `packages/` + `apps/desktop/` ###

```text
Select-String "exit_status|exitStatus|TerminalExit|submission"          packages/  -> 0 coincidencias
Select-String "wallClock|wall_clock|wallTimeLimit|maxConsecutiveFormat" packages/  -> 0 coincidencias
Select-String "elided|output_head|outputHead|elidedChars"              packages/  -> 0 coincidencias
Select-String "recursive_merge|UNSET|ConfigResolver"                    packages/  -> 0 coincidencias
Select-String "litellm|swebench|swe-bench|huggingface"                  packages/ + apps/desktop/  -> 0 coincidencias
Select-String "Begin Patch|Update File|Add File|Delete File|End Patch"  repos-referencia/mini-swe-agent/  -> 0 coincidencias
```

**Nota de alcance:** la verificación cubre los 8 patrones adaptables detectados. El stack de evaluación del repo
(datasets de HuggingFace, Modal, Contree, Bubblewrap, `litellm` multi-proveedor) y el **formato de parche
`*** Begin Patch`** —inexistente en el clon v2.4.6— se cierran en `🚫 Descartada` con su fundamento y no se
buscan en el código de Ego.

---

## 1. Resumen Ejecutivo de Extracción ##

mini-SWE-agent aporta a Ego cinco transversales de runtime que el Cognitive Runtime todavía no tiene:
**taxonomía de salida terminal tipada** (el desenlace del turno viaja como mensaje, no como canal paralelo),
**presupuesto triple de turno** (pasos, coste y reloj de pared) más **tope global de proceso**, **observación con
cabeza/cola y recuento explícito de lo omitido**, **caché de prefijo sobre el último mensaje** y **configuración
en capas con centinela `UNSET`**. Añade un patrón de gobernanza transferible: el **gate de edición verificada
por `git diff`** antes de declarar cumplida una tarea, con centinela de entrega auditable.

Lo que no se transfiere es el dominio: el corpus SWE-bench, su leaderboard, el harness con Docker y el
multi-proveedor vía `litellm` pertenecen a otro producto y quedan descartados por contaminación de dominio y
guardrail de dependencias.

### MATRIZ DE DISTRIBUCIÓN POR FASE ###

```text
MSWE-01  Taxonomía de salida terminal tipada .............. Fase 02 Acción  + Fase 11 Security   🆕
MSWE-02  Presupuesto triple de turno + tope global ........ Fase 02 Acción  + Fase 03 Sub-Egos   🆕
MSWE-03  Observación head/tail con recuento de omitidos ... Fase 02 Acción  + Fase 04 Canvas     🆕
MSWE-04  Formato-vs-truncamiento + racha de errores ....... Fase 02 Acción  + Fase 05 Intelligence 🆕
MSWE-05  Caché de prefijo (cache_control) .................. Fase 01 Core    + Fase 03 Sub-Egos   🆕
MSWE-06  Configuración en capas con centinela UNSET ....... Fase 02 Acción  + Fase 11 Security   🆕
MSWE-07  Gate de edición verificada por git diff .......... Fase 02 Acción  + Fase 09 Dominios   🆕
MSWE-08  Harness de eval por instancia aislada ............. Fase 07 Tasks                           ⏳
MSWE-09  Stack de evaluación y multi-proveedor ............ — (dominio ajeno + guardrail)           🚫

  Fase con tarea    Fase 02 Acción ......... 6 tareas (MSWE-01, 02, 03, 04, 06, 07)
  Fases con enlace  Fase 01 Core (MSWE-05) · Fase 03 Sub-Egos (MSWE-02, 05) · Fase 04 Canvas (MSWE-03)
                    Fase 05 Intelligence (MSWE-04) · Fase 07 Tasks (MSWE-08) · Fase 09 Dominios (MSWE-07)
                    Fase 11 Security (MSWE-01, 06)
```

#### Recuento de estados (verificado sobre las 9 filas de la tabla §2) ####

| `✅ Completada` | `🚫 Descartada` | `🆕 Pendiente` | `⏳ Futura` | Total |
| :---: | :---: | :---: | :---: | :---: |
| 0 | 1 | 7 | 1 | **9** |

---

## 2. Catálogo Detallado de Extracción (10 Columnas Canónicas) ##

| ID | Severidad | Hallazgo | Archivo mini-SWE-agent | Esfuerzo | Prioridad | Estado | Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |
|---|---|---|---|---|---|---|---|---|---|
| `MSWE-01` | 🟠 Alta | **Taxonomía de salida terminal tipada (el desenlace es un mensaje del historial)** | `src/minisweagent/agents/default.py:88-124` · `src/minisweagent/exceptions.py:1-26` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | Crear la taxonomía en `packages/runtime/src/types.ts`: ampliar `LoopStatus` (`:15-20`) con `exit_status` (`submitted`, `limits_exceeded`, `time_exceeded`, `format_error`, `user_interruption`, `uncaught`) y `submission` (entrega del Sub-Ego), y hacer que el cierre de turno lo emita como `EgoEvent` persistido en `gov/audit`. **Gap en Ego:** `packages/runtime/src/types.ts:15-20` define `LoopStatus` pero **no** transporta ni `exit_status` ni `submission` (grep → 0); el desenlace de un turno y una entrega del Sub-Ego son indistinguibles para auditoría (`SEC-06`) y para el Canvas (`CANV-05`). **Cableado:** `packages/runtime/src/ToolExecutionLoop.ts` (cierre de `while` en `:306`) + `packages/decision/src/DecisionAuditor.ts`. **Owner A2.** | Ego: `ACT-02`, `ACT-06`, `SEC-06`, `CANV-05` · Extracción: `docs/extractions/mini-swe-agent.md` §Bloque A | `ACT-02` |
| `MSWE-02` | 🟠 Alta | **Presupuesto triple de turno (pasos / coste / reloj de pared) y tope global de proceso** | `src/minisweagent/agents/default.py:26-33,132-147` · `src/minisweagent/models/__init__.py:13-42` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | Añadir a `packages/runtime/src/ToolExecutionLoop.ts` los límites `wallClockLimitMs` y `maxConsecutiveFormatErrors`, comprobados **antes** de cada llamada al modelo (patrón de `default.py:132-147`), y crear un agregador de coste/nº de llamadas a nivel de proceso en `packages/subegos/src/SubEgoBudget.ts` con corte duro (patrón de `GlobalModelStats`, `models/__init__.py:30-31`). **Gap en Ego:** existen `maxSteps` (`ToolExecutionLoop.ts:76,262,306`) y presupuesto por llamada (`packages/models/src/ModelRouter.ts:581-614`), pero **no hay presupuesto de reloj de pared** ni agregador global (grep `wallClock\|wallTimeLimit` → 0); el presupuesto de `packages/subegos/src/SubEgoBudget.ts:103-266` es por Sub-Ego y el de `packages/execution/src/CircuitBreaker.ts:204` por herramienta. **Owner A2/A4.** | Ego: `ACT-02`, `SUB-09`, `DEC-08`, `DS-05` · Extracción: `docs/extractions/mini-swe-agent.md` §Bloque B | `ACT-02`, `SUB-09` |
| `MSWE-03` | 🟠 Alta | **Observación con cabeza/cola y recuento explícito de caracteres omitidos** | `src/minisweagent/config/benchmarks/swebench.yaml:131-158` · `src/minisweagent/config/mini.yaml:112-128` | 🟡 1d | 🟠 P1 | 🆕 Pendiente | Unificar el render de observaciones en `packages/runtime/src/ToolExecutionLoop.ts`: si la salida supera el umbral, emitir `<output_head>` + `<elided_chars>` (número exacto de caracteres omitidos) + `<output_tail>` + un aviso con consejo operativo ("usa `head`/`tail`/`sed`; si necesitas todo, redirige a fichero"), reutilizando el límite ya calculado en `packages/execution/src/ExecutionManager.ts:165,284-285`. **Gap medible en Ego:** `ExecutionManager.enforceOutputLimit` (`:469-501`) **trunca y descarta** el tramo final, envolviendo en `{ truncated, preview }` sin cuantificar lo perdido ni ofrecer relectura (grep `elided\|output_head` → 0). **Owner A2/A4.** | Ego: `ACT-03`, `ACT-08`, `CANV-07` · Extracción: `docs/extractions/mini-swe-agent.md` §Bloque C | `ACT-03` |
| `MSWE-04` | 🟡 Media | **Discriminación error-de-formato vs. truncado por límite de tokens, con racha propia** | `src/minisweagent/models/utils/actions_toolcall.py:30-76` · `src/minisweagent/config/mini.yaml:129-149` · `src/minisweagent/agents/default.py:100-114` | 🟢 1d | 🟠 P1 | 🆕 Pendiente | Añadir la categoría `MODEL_OUTPUT_TRUNCATED` a `CausalErrorCategory` (`packages/runtime/src/types.ts:215-224`) y un contador de racha de errores de **formato** en `packages/runtime/src/ToolExecutionLoop.ts`, consumiendo el `finishReason` que ya viaja en `packages/models/src/types.ts` (`ModelStreamChunk`). El mensaje de error debe ser distinto según la causa (patrón de `mini.yaml:130-149`): "se agotó el límite de tokens, responde más conciso" vs. "corrige el formato de la llamada". **Gap en Ego:** `packages/runtime/src/ErrorHandler.ts:40` cuenta `maxConsecutiveToolErrors` (fallos de **herramienta**), no de formato; la taxonomía causal no tiene categoría para salida truncada. **Owner A2.** | Ego: `ACT-08`, `ACT-02`, `DEC-08` · Extracción: `docs/extractions/mini-swe-agent.md` §Bloque C | `ACT-08` |
| `MSWE-05` | 🟡 Media | **Caché de prefijo por `cache_control` sobre el último mensaje** | `src/minisweagent/models/utils/cache_control.py:49-67` | 🟢 0.5-1d | 🟠 P1 | 🆕 Pendiente | Extender el mecanismo ya verificado de EGO-FIND-40: hoy `packages/models/src/providers/AiSdkAnthropicProvider.ts:243-271` marca **solo** el bloque de sistema (`packages/models/src/types.ts:108-113`; test en `packages/models/test/ModelRouter-resilience.test.ts:388-450`). Marcar además el **último mensaje** de usuario/tool con `cacheControl: ephemeral` para que el prefijo creciente del turno se reutilice en caché. Complemento sin adaptación: la reordenación de bloques `thinking` (`models/utils/anthropic_utils.py:11-28`) ya está resuelta por AI SDK v7. **Owner A2.** | Ego: `CORE-03`, `INT-02`, `SUB-09` · Extracción: `docs/extractions/mini-swe-agent.md` §Bloque D | `CORE-03` |
| `MSWE-06` | 🟠 Alta | **Configuración en capas con centinela `UNSET` y credenciales fuera del repositorio** | `src/minisweagent/config/__init__.py:12-61` · `src/minisweagent/utils/serialize.py:6-29` · `src/minisweagent/run/utilities/config.py:78-92` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | Crear `packages/runtime/src/ConfigResolver.ts` con el centinela `UNSET` que permite distinguir "no proporcionado" de "explícitamente nulo" y así sobrescribir una capa sin borrar claves intactas; orden de capas builtin → proyecto → usuario → entorno → CLI, con specs `clave=valor`. **Gap en Ego:** no existe resolvedor (grep `recursive_merge\|UNSET\|ConfigResolver` → 0); la configuración está dispersa entre `packages/subegos/src/SubEgoFactory.ts:356-383` (YAML de Sub-Egos), `packages/execution/src/SafeConfigMutation.ts:25` (mutación segura) y opciones embebidas en `packages/models/src/ModelRouter.ts`. Las credenciales siguen la regla de `SEC-03`: solo `CredentialManager`, nunca en fichero de proyecto. **Owner A2.** | Ego: `SEC-05`, `SEC-03`, `ACT-01`, `SUB-02`, `INT-02` · Extracción: `docs/extractions/mini-swe-agent.md` §Bloque D | `SEC-03` |
| `MSWE-07` | 🟠 Alta | **Gate de edición verificada por `git diff` y centinela de entrega auditable** | `src/minisweagent/config/benchmarks/swebench.yaml:75-104` · `src/minisweagent/environments/local.py:45-56` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | Añadir en `packages/execution/src/ApprovalEngine.ts` una fase previa que exija **materializar y revisar el diff del workspace** antes de que un Sub-Ego de Engineering declare cumplida la tarea, reutilizando el motor canónico `packages/tools/src/native/git/ChangeSetService.ts:56-90` y la tool `git_diff` (`packages/tools/src/native/git/NativeGitTool.ts:64`); y un centinela de entrega con su `submission` (patrón de `local.py:45-56`) como mensaje terminal. **Gap en Ego:** el diff se calcula y se muestra en la tarjeta de aprobación (`ACT-07`), pero **no existe la obligación** de verificarlo antes del cierre del turno. **Owner A3/A4.** | Ego: `ACT-06`, `ACT-07`, `DOM-01`, `SEC-06` · Extracción: `docs/extractions/mini-swe-agent.md` §Bloque E | `ACT-06`, `MSWE-01` |
| `MSWE-08` | 🔵 Futura | **Harness de evaluación por instancia aislada, reanudable y con reporte de `exit_status`** | `src/minisweagent/run/benchmarks/swebench.py:68-119,122-177,229-233` · `src/minisweagent/run/benchmarks/utils/batch_progress.py:36-178` | 🔴 3-5d | 🔵 P3 | ⏳ Futura (Fase 07) | El patrón es valuable: caso aislado + estado terminal por caso + reanudación tras fallo + reporte agregado. La **implementación** upstream (Docker por instancia, `datasets` de HuggingFace, Modal) es incompatible con el runtime local-first de Ego (`AGENTS.md` §4, principio 9). Fase destino: **Fase 07 (Tasks) / P1**, construyendo el QA adversarial sobre `packages/tasks/src/BackgroundEngine.ts` + `packages/tasks/src/TaskCheckpoint.ts` (`TASK-01`, `TASK-03`, `TASK-10`) con registro de veredictos en `packages/decision/src/DecisionAuditor.ts` (`DEC-07`). Sin implementación en esta ola. | Ego: `TASK-01`, `TASK-03`, `TASK-10`, `DEC-07` · Extracción: `docs/extractions/mini-swe-agent.md` §Bloque E | `MSWE-01` |
| `MSWE-09` | 🟡 Media | **Stack de evaluación y multi-proveedor (litellm, datasets SWE-bench, Modal/Singularity/Contree/Bubblewrap) y ausencia de `*** Begin Patch`** | `src/minisweagent/models/__init__.py:78-89` · `src/minisweagent/run/benchmarks/swebench.py:53-62` · `src/minisweagent/environments/docker.py` · `pyproject.toml:33-48` | — | — | 🚫 Descartada (con justificación) | Tres fundamentos acumulativos: (a) **contaminación de dominio** (`AGENTS.md` §4): el corpus SWE-bench, su leaderboard y el producto de evaluación pertenecen a otro dominio, no a un SOC local-first; (b) **dependencia prohibida en P0**: `litellm` con 9 clases de proveedor sería un **segundo router** no canónico frente a `packages/models/src/ModelRouter.ts` (`CORE-03`), y `datasets` arrastra HuggingFace al runtime; (c) **guardrail de perímetro**: Docker/Singularity/Contree/Bubblewrap/Modal introducen orquestación de contenedores y egress cloud, incompatibles con `SEC-05` y `netPolicy`. Se añade que **el formato de parche `*** Begin Patch` / `*** Update File` no existe en este clon** (0 coincidencias en v2.4.6): no hay upstream que portar y Ego ya tiene motor de diff canónico, por lo que portar un parser crearía un segundo parser. Verificado: `litellm\|swebench\|huggingface` → 0 coincidencias en `packages/` + `apps/desktop/`. | Ego: — | — |

---

## 3. Matriz de Integración con el Backlog Maestro ##

Cada tarea `MSWE-*` se ejecuta como **Pre-requisito de Diseño y Código** de las fases del Backlog Maestro
(`docs/roadmap/Backlog.md`):

```text
  Fase 01 Core         CORE-03                              ← MSWE-05
  Fase 02 Acción       ACT-02  ACT-03  ACT-06  ACT-07  ACT-08
                                                        ← MSWE-01 MSWE-02 MSWE-03
                                                           MSWE-04 MSWE-06 MSWE-07
  Fase 03 Sub-Egos     SUB-02  SUB-09                       ← MSWE-02 MSWE-05
  Fase 03.1 Int.       INT-01  INT-02                       ← MSWE-05 MSWE-06
  Fase 04 Canvas       CANV-05  CANV-07                     ← MSWE-01 MSWE-03
  Fase 05 Intellig.    DEC-07  DEC-08                       ← MSWE-04 MSWE-08
  Fase 07 Tasks        TASK-01  TASK-03  TASK-10            ← MSWE-08
  Fase 09 Dominios     DOM-01                               ← MSWE-07
  Fase 11 Security     SEC-03  SEC-05  SEC-06               ← MSWE-01 MSWE-06
```

**Protocolo de cierre por tarea:** `✅ Completada` solo con fichero adaptado **y** caller en producción
verificado por grep; `🚫 Descartada (con justificación)` con el motivo técnico en la celda; `🆕 Pendiente`
con el cableado exacto y su responsable; `⏳ Futura` con la fase destino. Reimplementación en TypeScript
estricto en `packages/`, reutilizando `packages/tools/src/native/git/ChangeSetService.ts` y
`packages/execution/src/ApprovalEngine.ts` en lugar de escribir primitivas nuevas (D3).

---

## 4. Deuda abierta derivada de esta verificación (→ handoff owner) ##

| # | Ítem | Tipo | Owner | Bloqueante |
|---|---|---|---|---|
| D1 | `MSWE-02`: Ego no tiene presupuesto de reloj de pared. Un turno con una tool lenta o un modelo colgado puede consumir indefinidamente sin que ningún corte lo detenga (`packages/runtime/src/ToolExecutionLoop.ts` solo acota por nº de pasos y por coste). | Código | A2 | No |
| D2 | `MSWE-03`: `packages/execution/src/ExecutionManager.ts:469-501` trunca y **descarta** el tramo final de la salida de herramienta. El modelo no sabe cuánto se perdió ni tiene vía de relectura, lo que degrada la autocorrección guiada de `ACT-08`. | Código | A2/A4 | No |
| D3 | `MSWE-01`: el desenlace de un turno no tiene taxonomía terminal (`exit_status` + `submission`). `LoopStatus` (`packages/runtime/src/types.ts:15-20`) no permite distinguir "el Sub-Ego entregó" de "se agotó un límite" a efectos de `gov/audit` (`SEC-06`) ni de la presentación en Canvas (`CANV-05`). | Código | A2 | No |
| D4 | `MSWE-09`: `litellm`, `datasets` y los contenedores son dependencias ajenas al dominio. Vigilancia: no deben entrar en `packages/` ni en `apps/desktop/package.json` — cobertura verificada en 0 a fecha de hoy, y debe seguir en 0. | Decisión | ness-e | No |
| D5 | `MSWE-08`: Ego no tiene QA adversarial con casos aislados y reporte de estado terminal por caso. `tests/e2e/` valida el Golden Path (`CORE-11`, `ACT-10`, `DIST-08`), no la degradación por caso. Requiere decisión de owner sobre abrir la capacidad en Fase 07. | Decisión | A3 | No (diferido a Fase 07) |
