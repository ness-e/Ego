# Extractions Hub — Ego Cognitive Operating System

| Campo | Valor |
| --- | --- |
| Estado | Activo — Catálogo de extracción de repositorios de referencia |
| Owner | ness-e |
| Fecha | 2026-10-07 |

---

## 1. Propósito y Filosofía de Extracción

El directorio `docs/extractions/` contiene las fichas técnicas formales de los repositorios clonados o analizados como referencia arquitectónica (`repos-referencia/` y externos).

> **REGLA DE ORO DE EGO (de `AGENTS.md`):**
> *"Estos repositorios son referencia de patrones. NO copiar código directamente — extraer patrones de diseño y adaptar rigurosamente a la arquitectura canónica de Ego (TypeScript strict, Node.js 22 Main Process, React 19 Renderer, y VantaDB como sustrato local in-process)."*

### Regla de Extracción Condicionada (Protocolo de Dos Vías)

Toda extracción de código, patrones o arquitecturas desde repositorios de referencia debe someterse a la siguiente bifurcación estricta:

1. **Vía 1 — Mejora de lo Ya Definido (Fast-Track de Optimización):**
   - Aplica cuando el patrón resuelve o acelera una capacidad que **ya fue aprobada y definida** en la arquitectura y backlog de Ego (ej. componentes de `@assistant-ui/react`, hardening de Electron en Windows, selectores del `ModelRouter`, contratos de `EgoMemoryAdapter`).
   - *Condición:* Solo puede **mejorar, optimizar o robustecer** lo existente. No puede alterar los contratos maestros ni violar guardrails (ej. no meter backend Python ni SQLite).
   - *Flujo:* Mapeo directo a la tarea del Backlog Maestro (`CORE-*`, `ACT-*`, `CANV-*`) -> Adaptación en TypeScript -> Test de integración.

2. **Vía 2 — Evaluación Previa de lo No Definido (Gate de Research & Aprobación):**
   - Aplica cuando se descubre una funcionalidad o patrón en el repositorio fuente que **no estaba contemplada ni definida** en las especificaciones de Ego (ej. aislamiento de subagentes vía `git worktree`, ejecución de herramientas mediante RPC kernel local sin turnos de modelo, o gateway omnicanal multicanal Telegram/Discord).
   - *Condición Innegociable:* **PROHIBIDO implementar o extraer directamente**.
   - *Flujo Obligatorio:*
     1. **Evaluación de Utilidad Real:** ¿Aporta valor al Cognitive OS o introduce sobreingeniería innecesaria?
     2. **Investigación de Viabilidad & Trade-offs:** FMEA, impacto en dependencias, compatibilidad con la jerarquía canónica de decisiones.
     3. **Ficha de Documentación Técnica:** Se redacta un documento en `docs/research/` justificando *qué es, por qué se extraería y cómo encajaría* en Ego.
     4. **Aprobación del Owner:** Solo tras validación explícita se promueve a tarea en `docs/roadmap/Backlog.md`.

---

## 2. Metodología de Documentación de Extracción

Cada repositorio analizado debe contar con un documento dedicado en esta carpeta (`docs/extractions/<repo-name>.md`) siguiendo la siguiente estructura estándar:

### Estructura Estándar de Ficha de Extracción

1. **Ficha de Identidad del Repo**:
   - Nombre, autor, licencia, versión analizada y ruta local (`repos-referencia/...`).
   - Stack tecnológico del proyecto analizado.
2. **Evaluación de Similitud / Divergencia con Ego**:
   - Qué problemas resuelve de forma análoga a Ego.
   - Qué decisiones arquitectónicas del repositorio son incompatibles con los Guardrails de Ego (ej. backend en Python vs Node 22, SQLite vs VantaDB Fjall LSM, etc.).
3. **Catálogo de Patrones Extraíbles (Inventario Quirúrgico)**:
   - **Ruta exacta del archivo y rango de líneas en el repo fuente**.
   - Nombre del patrón / componente.
   - Qué hace y por qué es valioso.
   - **Plan de adaptación en Ego**: Cómo se traduce a TypeScript/React 19/VantaDB sin acoplamiento.
4. **Matriz de Extracción vs Descarte**:
   - Tabla clara: Componente Fuente | Acción (Extraer & Adaptar / Descartar / Solo Inspiración) | Justificación Técnica.
5. **Impacto en el Backlog de Ego**:
   - Vínculo explícito con las tareas del Backlog canónico de Ego (`docs/roadmap/Backlog.md`).

---

## 3. Repositorios de Referencia Mapeados

**Fuente única de recuentos:** las filas de los catálogos `docs/review/backlog-*.md`.
Los tres recuentos que existían (este README, `docs/review/README.md` y
`docs/roadmap/Backlog.md:41-47`) se sincronizaron el **2026-10-19** (Ola 1, A5);
`docs/roadmap/Backlog.md` lo consolida A1.

| Repositorio | Naturaleza / Stack | Archivo de Extracción / Backlog | Rango de IDs | Tareas | Foco Principal en Ego |
|---|---|---|---|:---:|---|
| **hermes-agent** | Electron 40 + React 19 + assistant-ui + Python backend | [`hermes-agent.md`](hermes-agent.md) / [`backlog-hermes.md`](../review/backlog-hermes.md) | `HERM-01..HERM-30` | 30 | gemelo de stack: UI Chat/Composer, artifacts, layout de ventanas, hardening Windows, packaging |
| **openclaw** | Node.js + WebSocket + SQLite Kysely | [`openclaw.md`](openclaw.md) / [`backlog-openclaw.md`](../review/backlog-openclaw.md) | `OCLW-01..OCLW-24` | 24 | admisión inmutable de runs, auto-reparación de tools, locks de sesión, workers |
| **coucou** | Swift/macOS + Tauri 2/Rust/TS | [`coucou.md`](coucou.md) / [`backlog-coucou.md`](../review/backlog-coucou.md) | `COUC-01..COUC-29` | 29 | normalización en el borde, atención, HITL con ACK, ChangeSet, SafeConfigMutation |
| **khoj** | Python FastAPI + Next.js + SQLite/pgvector | [`khoj.md`](khoj.md) / [`backlog-khoj.md`](../review/backlog-khoj.md) | `KHOJ-01..KHOJ-13` | 13 | chunking de 256 tokens con solapamiento y hash, filtrado de umbral, extracción de hechos |
| **helmor** | Tauri 2 (Rust) + React 19 + PTY | [`helmor.md`](helmor.md) / [`backlog-helmor.md`](../review/backlog-helmor.md) | `HELM-01..HELM-10` | 10 | terminal output scheduler (coalescencia 16 KB/tick, ring-buffer 2 MB), puente de UI |
| **career-ops** | Node.js ESM (`.mjs`) + Filesystem | [`career-ops.md`](career-ops.md) / [`backlog-career-ops.md`](../review/backlog-career-ops.md) | `CARP-01..CARP-08` | 8 | DATA_CONTRACT.md (User vs System), locks atómicos de filesystem, cuarentena |
| **deepseek-harness** | Monorepo TypeScript (pnpm) + Electron/Node | [`deepseek-harness.md`](deepseek-harness.md) / [`backlog-deepseek-harness.md`](../review/backlog-deepseek-harness.md) | `DSEK-01..DSEK-12` | 12 | sesiones versionadas, IDs opacos, patrón supersede sin borrado, migraciones aditivas |

### 3.1 Ola 2 — Catálogo de agentes de código y de conocimiento (2026-10-20) ###

Repositorios clonados el 2026-10-20 en profundidad 1 (`--depth 1 --single-branch`).
**4 de los 18 repositorios nuevos tienen hallazgos en estado `✅ Completada` por asilación propia** (`gemini-cli` 2, `claude-squad` 1, `mem0` 2, `mcp-servers` 2); el resto tienen `0 ✅`.
La verificación de caller se hizo por grep
sobre `packages/` + `apps/desktop/` excluyendo `test/`, `dist/` y `node_modules/`.

| Repositorio | Naturaleza / Stack | Archivo de Extracción / Backlog | Rango de IDs | Tareas | Foco Principal en Ego |
|---|---|---|---|:---:|---|
| **opencode** | TypeScript (monorepo turbo/bun) | [`opencode.md`](opencode.md) / [`backlog-opencode.md`](../review/backlog-opencode.md) | `OCDE-01..OCDE-09` | 9 | motor de sesión/agente: permisos persistidos, compactación negociada, code mode, inbox de prompts |
| **codex** | Rust (CLI) | [`codex.md`](codex.md) / [`backlog-codex.md`](../review/backlog-codex.md) | `CDX-01..CDX-09` | 9 | política de tool de tres estados, caché de aprobación por clave, perfil de permisos con degradación, parcheo con anclaje contextual |
| **goose** | Rust (extensible) | [`goose.md`](goose.md) / [`backlog-goose.md`](../review/backlog-goose.md) | `GOOS-01..GOOS-09` | 9 | cadena componible de inspectores de tool-call, inspector de egreso de red, lease del catálogo de tools |
| **cline** | TypeScript (SDK + extensión VS Code) | [`cline.md`](cline.md) / [`backlog-cline.md`](../review/backlog-cline.md) | `CLNE-01..CLNE-09` | 9 | snapshots de working tree restaurables, guardas de bucle, caché de resultados de tool, tool MCP determinista |
| **gemini-cli** | TypeScript (CLI, React Ink) | [`gemini-cli.md`](gemini-cli.md) / [`backlog-gemini-cli.md`](../review/backlog-gemini-cli.md) | `GCLI-01..GCLI-09` | 9 | motor de reglas priorizadas con identidad MCP/subagente, confianza de workspace, protección de `.env*` |
| **qwen-code** | TypeScript (CLI multi-agente) | [`qwen-code.md`](qwen-code.md) / [`backlog-qwen-code.md`](../review/backlog-qwen-code.md) | `QWEN-01..QWEN-09` | 9 | subagentes multi-agente, riesgo de tool MCP no derivado del nombre, piso de superficie de tools por rol |
| **openhands** | Electron + React 19 + Vite (agent-canvas) | [`openhands.md`](openhands.md) / [`backlog-openhands.md`](../review/backlog-openhands.md) | `OHND-01..OHND-12` | 12 | gemelo de stack desktop: bridge IPC tipado, log de arranque en splash, router declarativo, sello de perfil |
| **vibe-kanban** | Rust (workspace de 30 crates) | [`vibe-kanban.md`](vibe-kanban.md) / [`backlog-vibe-kanban.md`](../review/backlog-vibe-kanban.md) | `VIBE-01..VIBE-08` | 8 | worktree idempotente con lock, merge/rebase con guardas, ciclo de vida del proceso de agente |
| **mini-swe-agent** | Python (~100 líneas) | [`mini-swe-agent.md`](mini-swe-agent.md) / [`backlog-mini-swe-agent.md`](../review/backlog-mini-swe-agent.md) | `MSWE-01..MSWE-09` | 9 | taxonomía de salida terminal, observación con `elided_chars`, gate de verificación por `git diff` |
| **swe-agent** | Python (ACI) | [`swe-agent.md`](swe-agent.md) / [`backlog-swe-agent.md`](../review/backlog-swe-agent.md) | `SWAG-01..SWAG-09` | 9 | diseño ACI, contrato observación→prompt, presupuestos de coste independientes |
| **crush** | Go (TUI + LSP) | [`crush.md`](crush.md) / [`backlog-crush.md`](../review/backlog-crush.md) | `CRSH-01..CRSH-09` | 9 | LSP como fuente de contexto, diagnósticos embebidos, pre-aprobación con `halt` |
| **continue** | TypeScript (IDE) | [`continue.md`](continue.md) / [`backlog-continue.md`](../review/backlog-continue.md) | `CONT-01..CONT-09` | 9 | registro de context providers, capacidades declaradas en config, roles y rectificación de selección |
| **claude-squad** | Go (AGPL-3.0) | [`claude-squad.md`](claude-squad.md) / [`backlog-claude-squad.md`](../review/backlog-claude-squad.md) | `CSQD-01..CSQD-09` | 9 | rehidratación degradada a reanudable, diff a dos niveles de coste, digest de salida de terminal |
| **ag-ui** | TypeScript (protocolo) | [`ag-ui.md`](ag-ui.md) / [`backlog-ag-ui.md`](../review/backlog-ag-ui.md) | `AGUI-01..AGUI-08` | 8 | validación semántica A2UI, deltas RFC 6902, verificador de invariantes de stream |
| **graphiti** | Python (KG temporal) | [`graphiti.md`](graphiti.md) / [`backlog-graphiti.md`](../review/backlog-graphiti.md) | `GRPH-01..GRPH-09` | 9 | bitemporalidad de dos ejes, detección de contradicciones, cascada de resolución de entidades |
| **graphrag** | Python (Microsoft) | [`graphrag.md`](graphrag.md) / [`backlog-graphrag.md`](../review/backlog-graphrag.md) | `GRAG-01..GRAG-09` | 9 | priorización in/out-network con presupuesto de grafo, pipeline declarativo, caché de respuestas LLM |
| **mem0** | Python + TS SDK | [`mem0.md`](mem0.md) / [`backlog-mem0.md`](../review/backlog-mem0.md) | `MEM0-01..MEM0-09` | 9 | extracción de memoria desde el turno de chat, anti-alucinación de ids, arbitraje ADD/UPDATE/DELETE |
| **mcp-servers** | TypeScript + Python (oficial) | [`mcp-servers.md`](mcp-servers.md) / [`backlog-mcp-servers.md`](../review/backlog-mcp-servers.md) | `MCPS-01..MCPS-09` | 9 | roots declarado y no implementado, anotaciones de riesgo MCP, descubrimiento documentado y ausente |

---

## 4. Taxonomía canónica de estado de compuerta (2026-10-19)

Todo hallazgo de extracción debe cerrar en **uno** de estos cuatro estados.
**Ninguna compuerta puede quedar en el limbo** (`AGENTS.md` §4).

| Estado | Significado | Requisito de cierre |
|---|---|---|
| `✅ Completada` | Patrón asimilado, integrado y **en producción**. | Fichero adaptado **y** caller en producción verificado por grep sobre `packages/` + `apps/desktop/` (excluyendo `test/`, `dist/`, `node_modules/`). La celda cita la ruta y el punto de cableado. |
| `🚫 Descartada (con justificación)` | El patrón no aplica en Ego, está sustituido por otro módulo canónico, o viola un guardrail. | La celda contiene el **fundamento técnico** del descarte (no basta con "no aplica"). |
| `🆕 Pendiente` | Patrón asimilado (el código existe y está probado) pero **sin caller en producción**. | La celda dice el **cableado exacto** pendiente y **quién lo ejecuta** (agente responsable). |
| `⏳ Futura (fase)` | Diferido a una fase posterior. | La celda dice la **fase destino** y el motivo del diferimiento. |

> **Prohibido `✅ Completada` sin fichero.** Ese fue el falso verde que motivó la auditoría
> de 2026-10-19: `OCLW-16` y `OCLW-17` estaban marcados "Completada" con ficheros inexistentes.

### 4.1 Tabla maestra de estado (verificada 2026-10-19, post A2/A3 · ampliada 2026-10-20)

| Repo | Declarados | ✅ Asimilado + integrado | 🚫 Descartado | 🆕 Pendiente | ⏳ Futura | Nota |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| hermes-agent | 30 | 16 | 7 | 0 | 7 | 7.5 |
| openclaw | 24 | 9 | 8 | 6 | 1 | 6.0 |
| coucou | 29 | 12 | 12 | 4 | 1 | 6.5 |
| khoj | 13 | 3 | 3 | 0 | 7 | 7.0 |
| helmor | 10 | 4 | 1 | 5 | 0 | 7.5 |
| career-ops | 8 | 2 | 3 | 2 | 1 | 6.0 |
| deepseek-harness | 12 | 1 | 4 | 3 | 4 | 6.5 |
| opencode | 9 | 0 | 1 | 7 | 1 | — |
| codex | 9 | 0 | 1 | 8 | 0 | — |
| goose | 9 | 0 | 1 | 7 | 1 | — |
| cline | 9 | 0 | 2 | 6 | 1 | — |
| gemini-cli | 9 | 2 | 1 | 5 | 1 | — |
| qwen-code | 9 | 0 | 2 | 6 | 1 | — |
| openhands | 12 | 0 | 2 | 9 | 1 | — |
| vibe-kanban | 8 | 0 | 1 | 6 | 1 | — |
| mini-swe-agent | 9 | 0 | 1 | 7 | 1 | — |
| swe-agent | 9 | 0 | 2 | 7 | 0 | — |
| crush | 9 | 0 | 1 | 8 | 0 | — |
| continue | 9 | 0 | 2 | 7 | 0 | — |
| claude-squad | 9 | 1 | 3 | 4 | 1 | — |
| ag-ui | 8 | 0 | 4 | 3 | 1 | — |
| graphiti | 9 | 0 | 4 | 4 | 1 | — |
| graphrag | 9 | 0 | 1 | 7 | 1 | — |
| mem0 | 9 | 2 | 2 | 5 | 0 | — |
| mcp-servers | 9 | 2 | 2 | 4 | 1 | — |
| **TOTAL** | **289** | **54** | **71** | **130** | **34** | — |

Barrido de los vectores de `career-ops` (ATS, vacantes, candidatura, CV, salario, portales) y de
`khoj` (scrapers web, `gte-small`, Twilio, Stripe, SMTP) sobre `packages/` y `apps/`:
**0 coincidencias → LIMPIO**. Los únicos hits de `khoj` en el código son comentarios de atribución
y el sidecar propio `scripts/ingest/bulk_import.py`.

### 4.3 Cadena de atribución de código derivado (avatar)

Todo fichero derivado de código MIT de un repo de referencia debe llevar cabecera
`Adapted from <upstream> (MIT), <ruta de origen>` y su aviso de licencia debe viajar en un
`LICENSE.md` **dentro del paquete**.

**Estado verificado 2026-10-21 (Ola 5, A5):**

| Elemento | Estado | Evidencia |
|---|:---:|---|
| `packages/avatar/LICENSE.md` | ✅ existe | Junto a `LICENSE` y `NOTICE` (3 ficheros de licencia en el paquete). Registra los avisos MIT de los módulos portados. |
| Cabeceras `Adapted from <upstream> (MIT), <ruta>` | ⚠️ **8 de 90** ficheros | Las 8 están en `packages/avatar/src/studio/`: `avatar.js`, `render/{accessories,body,ears,eyes,geometry,helpers,mouth}.js`. **41 de los 49 ficheros de `src/` no la llevan**; la mayoría son código nativo de Ego (sin atribución que hacer) y los derivados que sí la necesitan se listan en [`coucou.md`](coucou.md) §52.4. |
| Restos de marca Mochi / verbatim | ⚠️ **11 sitios en 9 ficheros** | `src/core/timeline.js:2`, `src/render/ara-head.js:1`, `src/render/body.js:3`, `src/runtime/poses.js:11`, `src/studio/render/particles.js:1`, `src/studio/render/visor.js:1`, `src/studio/rig/eyes.js:1`, `src/studio/rig/hands.js:2`, `src/studio/sound.js:1` (9 con "verbatim"/"PORTES VERBATIM") + `src/runtime/avatar-element.js:2015` y `src/studio/avatar.js:70` (mención a `'coucou-mochi'` en **comentarios**, no en código funcional). |

El veredicto de descarte de los puertos verbatim de Mochi (decisión D4 del owner: sustituir por
geometría propia) está en [`docs/extractions/coucou.md`](coucou.md) §52.4. Ejecución: A6
(owner de `packages/avatar/**` y de la copia vendorizada).

### 4.4 Harness de verificación de procedencia (specificación para A7)

> **Estado:** pendiente de implementación. El ejecutable va en `scripts/**` (zona de A7); A5 define
> el contrato y el formato de salida. Sin este harness, la procedencia (commit + licencia) de las
> 25 fichas es **una afirmación manual** que sólo se re-verifica cuando A5 la vuelve a mirar.

**Nombre propuesto:** `scripts/verify-extraction-provenance.mjs`
**Invocación:** `node scripts/verify-extraction-provenance.mjs [--json]` · **Exit 0** = todo cuadra · **Exit 1** = discrepancia.

**Qué debe comprobar, por cada ficha `docs/extractions/<slug>.md`:**

| # | Comprobación | Origen de la verdad | Fallo |
|:--:|---|---|---|
| 1 | El repo clonado existe | `repos-referencia/<slug>/` | `repo-ausente` |
| 2 | El commit citado en la línea `Commit verificado:` coincide con el HEAD del clon | `git -C repos-referencia/<slug> rev-parse --short=7 HEAD` | `commit-desfasado` (indica el esperado y el citado) |
| 3 | La licencia citada en la ficha coincide con el `LICENSE`/`LICENSE.md`/`NOTICE` del clon | primer bloque del fichero de licencia | `licencia-desfasada` |
| 4 | La ruta del repo citada en la ficha (`repos-referencia/<slug>/`) existe | sistema de ficheros | `ruta-inexistente` |
| 5 | La ficha tiene su backlog y ambos comparten el mismo conjunto de IDs | `docs/review/backlog-<slug>.md` | `ids-discrepantes` |
| 6 | Ninguna fila `✅ Completada` cita un fichero de `repos-referencia/` como si fuera código de Ego, ni viceversa | heurística: en la columna de evidencia, un camino que empieza por `repos-referencia/` **debe** accompanied de la ruta equivalente en `packages/` o `apps/` | `atribucion-falsa` |

**Formato de salida** (mismo estilo que `scripts/audit-extraction-gates.mjs`):

```text
slug              repo?  commit-ficha  commit-real  licencia  estado
ag-ui             SI     3decbe8       3decbe8      MIT       OK
claude-squad      SI     ce1ffb4       ce1ffb4      AGPL-3.0  OK
...
Auditados: 25 repos · 289 fichas
OK: 0 discrepancias de procedencia.
```

**Estado verificado por A5 el 2026-10-21 (sin harness):** 25/25 repos existen, 25/25 commits
citados coinciden con el HEAD del clon, 25/25 licencias citadas coinciden con el fichero de
licencia real, 0 atribuciones falsas detectadas en las 7 filas `✅ Completada` de los 18 repos
nuevos (todas citan rutas **de Ego**, no del upstream).
