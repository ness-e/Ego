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
| khoj | 13 | 0 | 6 | 0 | 7 | 7.0 |
| helmor | 10 | 4 | 1 | 5 | 0 | 7.5 |
| career-ops | 8 | 2 | 3 | 2 | 1 | 6.0 |
| deepseek-harness | 12 | 0 | 5 | 3 | 4 | 6.5 |
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
| **TOTAL** | **289** | **50** | **75** | **130** | **34** | — |

Barrido de los vectores de `career-ops` (ATS, vacantes, candidatura, CV, salario, portales) y de
`khoj` (scrapers web, `gte-small`, Twilio, Stripe, SMTP) sobre `packages/` y `apps/`:
**0 coincidencias → LIMPIO**. Los únicos hits de `khoj` en el código son comentarios de atribución
y el sidecar propio `scripts/ingest/bulk_import.py`.

### 4.3 Cadena de atribución — dos planos (código derivado vs. ficha)

> **Regla que no se puede confundir.** Hay dos planos distintos y la Ola 8 los mezcló
> (EGO-FIND-82). El error fue escribir `Adapted from …` en las **fichas** (documentos de
> análisis escritos por Ego) y en las **filas de catálogo**: eso afirmaba una derivación de
> código que no existe. `AGENTS.md` §2 lo prohíbe (`repos-referencia/`: *"No copiar código
> directamente — extraer patterns y adaptar"*) y `EGO-FIND-83` retiró el crédito a `khoj`
> por el mismo motivo (el código atribuido era propio de Ego, y `khoj` es AGPL-3.0).

| Plano | Qué es | Qué lleva | Quién lo trabaja |
|---|---|---|---|
| **1 · Código** (`packages/**`) | un fichero **realmente derivado** (un port literal) | cabecera de fichero `Adapted from <upstream> (<LICENCIA>), <ruta de origen>` + aviso en el `LICENSE.md` del paquete | **A6** (`packages/avatar/**`) · **A2bis** (el resto de `packages/**`) |
| **2 · Ficha** (`docs/extractions/*.md`) | documento de análisis **escrito por Ego** | fila de **procedencia** del upstream: `Licencia del origen`, `Commit verificado`, `Ruta de origen`, y `Repositorio Origen` normalizado. **Nunca** `Adapted from` | **A5** (este repo) |

**Estado real medido 2026-10-21 (A5, Ola 8)** — cabecera canónica en **código derivado**:

| Elemento | Estado | Evidencia |
|---|:---:|---|
| `packages/avatar/LICENSE.md` | ✅ existe | Junto a `LICENSE` y `NOTICE` (3 ficheros de licencia en el paquete). Registra los avisos MIT de los módulos portados. |
| `packages/tool-call-repair/LICENSE.md` | ⚠️ existe, incompleto | Sin `NOTICE`, y sus **3** ficheros de `src/` (`balanced-json.ts`, `coercion.ts`, `grammar.ts`) usan atribución en **prosa** (`Extraído y adaptado de OpenClaw …`), **no** la forma canónica por paquete. Ver el aviso a A6 en el handoff. |
| Forma 1 — `Adapted from <upstream> (<LIC>), <ruta>` | ⚠️ **14 de 1 144** | Los 14 están en `packages/avatar/`: 7 en `src/` + sus 7 en `dist/` (artefacto de build — no cuenta). En `src/`: `src/studio/avatar.js` + `src/studio/render/{accessories,body,ears,eyes,helpers,mouth}.js`. *El recuento antiguo «8 de 90» estaba desfasado: `src/studio/render/geometry.js` ya **no** la lleva (A6 lo sustituyó) y `src/` tiene **47** `.js`, no 49.* |
| Forma 2 — `ADAPTADO de <ruta> (<LIC>, <copyright>) — ver LICENSE.md` | ⚠️ **6 de 1 144** | También sólo en `packages/avatar/`: `src/{core/anim.js,runtime/micro.js,runtime/sound.js}` (+ sus 3 en `dist/`). Es la convención **por paquete** que el owner implantó (y la que valida `packages/avatar/scripts/check-attribution.mjs`). |
| Atribución en **prosa** (forma no canónica) | ⚠️ **42** | Repartida en 11 paquetes: `tool-call-repair` (9), `ui-runtime` (9), `memory` (6), `avatar` (5), `execution` (3), `recovery` (3), `subegos` (3), `tools` (2), `events` (1), `runtime` (1). |
| Paquetes con fichero de licencia en el paquete | ⚠️ **2 de 19** | Sólo `avatar/` y `tool-call-repair/`. |

> **Base de medida:** barrido recursivo de `packages/**` (excluye `node_modules`) sobre 1 144
> ficheros `.ts/.tsx/.js/.mjs/.cjs`, cabecera en las 15 primeras líneas. Reparto por paquete:
> `avatar` 166 (14 forma 1 · 6 forma 2 · 5 prosa · 141 sin cabecera), `tool-call-repair` 16
> (9 prosa · 7 sin cabecera), `ui-runtime` 79 (9 prosa), `memory` 76 (6 prosa), `execution` 36
> (3), `recovery` 58 (3), `subegos` 85 (3), `tools` 135 (2), `events` 36 (1), `runtime` 42 (1),
> `knowledge` 79 · `models` 54 · `tasks` 69 · `decision` 57 · `domains` 55 · `integrations` 44 ·
> `security` 30 · `dailystate` 27 (0 atribuciones).

La **lista autoritativa** de ficheros derivados que aún **no** llevan la cabecera canónica está
en [`coucou.md`](coucou.md) §52.4: los 9 con residuo *verbatim* + `src/render/projection.js`
(puerto de `drawEyes()` de `coucou mochi/engine.ts`) + `src/render/static.js` (puerto de
`MochiStill.swift`) = **11**. **A6** decide cuáles son puerto literal y cuáles código nativo
de Ego — es su zona (`packages/avatar/**` y la copia vendorizada), no la de A5.

> `src/render/ara-head.js` y `src/render/body.js` también dicen «verbatim», pero su origen es
> **`agent-robot-avatar`** (MIT © CX ArtLab), no Mochi: son un upstream distinto y su
> atribución es legítima. Lo que exige la decisión D4 del owner es sustituir la **geometría de
> Mochi**, no la de `agent-robot-avatar`.

### 4.4 Puerta de procedencia de las fichas (implementada)

> **Estado: IMPLEMENTADA y en verde.** `docs/extractions/tools/verify-extraction-provenance.mjs`
> · exit 0 · 25/25 fichas verificadas. Test: `verify-extraction-provenance.test.mjs` (7 casos
> con fixtures sobre `--root`, rojo→verde).
> **A7**: mover el script a `scripts/**` y cablearlo al job `verify` de CI.

**Qué comprueba, por cada una de las 25 fichas `docs/extractions/<slug>.md`:**

| # | Comprobación | Origen de la verdad | Fallo |
|:--:|---|---|---|
| 1 | La ficha tiene la fila `Licencia del origen` (upstream + licencia) | la propia ficha | `procedencia-ausente` / `procedencia-malformada` |
| 2 | El upstream corresponde a un clon real de `repos-referencia/` — **mapeado por el remote del clon**, no por nombre (`modelcontextprotocol/servers` → clon `mcp-servers`) | `git config --get remote.origin.url` de cada clon | `upstream-inexistente` |
| 3 | La licencia citada coincide con el `LICENSE`/`NOTICE` real del clon | primer bloque del fichero de licencia | `licencia-distinta` |
| 4 | El commit citado (`Commit verificado`) coincide con el HEAD del clon | `git -C <clon> rev-parse --short=7 HEAD` | `commit-desfasado` |
| 5 | La `Ruta de origen` existe dentro del clon | sistema de ficheros | `ruta-inexistente` |
| 6 | La ficha y su backlog comparten el mismo conjunto de IDs | `docs/review/backlog-<slug>.md` | `ids-discrepantes` |
| 7 | El backlog existe | `docs/review/` | `backlog-ausente` |
| 8 | **Ninguna** fila de catálogo afirma derivación de código salvo que el fichero de Ego citado **lleve** la cabecera canónica | la cabecera real del fichero citado | `derivacion-sin-cabecera` |
| 9 | **Ninguna** fila afirma derivación de `khoj` (AGPL-3.0) | `EGO-FIND-83` (decisión del owner) | `credito-retirado` |

**Salida** (mismo estilo que `scripts/audit-extraction-gates.mjs`):

```text
slug                upstream                            licencia     clon              commit   estado
ag-ui               ag-ui-protocol/ag-ui                MIT          ag-ui             3decbe8  OK
mcp-servers         modelcontextprotocol/servers         Apache-2.0   mcp-servers       51b6382  OK
...
OK: 25 fichas con procedencia verificada (upstream, licencia, commit, ruta de origen e IDs).
```

**El generador es la fuente de la verdad.** `docs/extractions/tools/normalize-attribution.mjs`
deriva upstream, licencia, commit y ruta **del clon real** (nunca de memoria) y escribe la
fila de procedencia **dentro** de la tabla de metadatos existente, sin partirla. Es
**idempotente** (`--check` → 0 cambios) y repara los `||` sin escapar que rompen una tabla.

```bash
node docs/extractions/tools/normalize-attribution.mjs           # aplica
node docs/extractions/tools/normalize-attribution.mjs --check   # 0 cambios
node docs/extractions/tools/verify-extraction-provenance.mjs   # exit 0
node --test docs/extractions/tools/verify-extraction-provenance.test.mjs
```

**Estado verificado 2026-10-21:** 25/25 clones resueltos por remote, 25/25 licencias coinciden
con el `LICENSE` real, 25/25 commits coinciden con el HEAD, 25/25 rutas de origen existen
dentro de su clon, 0 filas de catálogo afirma derivación de código y 0 filas acreditan a
`khoj`.
