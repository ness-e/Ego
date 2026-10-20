---
kind: review
status: active
description: >-
  Backlog especializado para la revisión, extracción de patrones y adaptación técnica de
  ag-ui-protocol/ag-ui (protocolo Agent-User Interaction) hacia el monorepo de Ego.
tags: [ego, ag-ui, extraction, review, protocol, events, state, a2ui, middleware]
schema: "10-column canonical schema (.agents/references/backlog-format.md compatible)"
---

# Backlog de Revisión y Extracción: AG-UI (ag-ui-protocol/ag-ui) #

## Protocolo de interoperabilidad agente↔UI: qué se extrae, qué se descarta y por qué ##

> **Propósito:** Registro canónico y secuencial de auditoría, extracción de patrones y adaptación técnica de
> `repos-referencia/ag-ui` hacia el monorepo de Ego.
>
> **Regla de Operación:** *No copiar código directamente*. AG-UI es un **protocolo de interoperabilidad**, no una
> arquitectura de aplicación: de él se extraen patrones (semántica de deltas, reductor espejo, verificador de
> stream, validación semántica A2UI), nunca un vocabulario de eventos ni una pila de transporte.
>
> **Esquema:** Tabla canónica de 10 columnas (`ID`, `Severidad`, `Hallazgo`, `Archivo AG-UI`, `Esfuerzo`,
> `Prioridad`, `Estado`, `Descripción & Adaptación en Ego`, `Relaciones Ego`, `Dependencias`).

| Campo | Valor |
| --- | --- |
| Estado | Activo — 1.ª revisión (repo nuevo, sin asimilar) |
| Repositorio Origen | `repos-referencia/ag-ui/` (Commit `3decbe8`, rama `main`, profundidad 1) — MIT |
| Total de Tareas | **8** (`AGUI-01..08`) |
| Fases Impactadas en Ego | Fases 02 (`ACT`), 03 (`SUB`), 04 (`CANV`), 06 (`KB`), 11 (`SEC`) |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Última verificación | 2026-10-20 — grep sobre `packages/` + `apps/desktop/` (excluye `test/`, `dist/`, `node_modules/`) |

---

## 0. Verificación de estado ##

| Estado | Significado canónico |
| --- | --- |
| `✅ Completada` | Asimilado, integrado y con **caller en producción verificado**. La celda cita la ruta real. |
| `🚫 Descartada (con justificación)** | El patrón no se aplica en Ego, fue sustituido por otro módulo canónico, o viola un guardrail. La celda contiene el motivo técnico. |
| `🆕 Pendiente` | Patrón asimilable y **no asimilado todavía** (repo nuevo): la celda dice el **cableado exacto** pendiente y **quién lo ejecuta**. |
| `⏳ Futura (fase)` | Diferido a una fase posterior, con fase destino explícita y motivo del diferimiento. |

> **Nota de alcance (repo nuevo):** AG-UI se incorpora por primera vez a la cadena de extracción de Ego. **Nada ha
> sido asimilado todavía**: no existe ningún fichero AG-UI adaptado en `packages/` ni `apps/desktop/`, por lo que
> **cero filas pueden ostentar `✅ Completada`**. Las tres filas `🆕 Pendiente` identifican capacidad asimilable
> cuya adaptación todavía no se ha escrito.

### Búsquedas de verificación ejecutadas (2026-10-20) ###

```text
grep -E "jsonpatch|JsonPatch|applyPatch"  -> 0 (sin aplicador RFC 6902)
grep -E "middleware|Middleware"            -> 0 (sin cadena de coprocesamiento)
grep -E "STATE_SNAPSHOT|RUN_STARTED|TEXT_MESSAGE|TOOL_CALL_START" -> 0 (sin contrato AG-UI)
```

Las tres búsquedas corrieron sobre `packages/` + `apps/desktop/`, excluyendo `test/`, `dist/` y `node_modules/`.

---

## 1. Resumen Ejecutivo de Extracción ##

AG-UI (`ag-ui-protocol/ag-ui`, MIT, protocolo `1.0`, SDK cliente `1.0.3`) define el contrato de eventos, el estado
compartido y la capa de coprocesamiento del borde agente↔UI. Para Ego su valor es **acotado y quirúrgico**:

* **Aporta** (3 patrones asimilables): *snapshot completo + deltas RFC 6902 atómicos* para el estado del Canvas;
  *reducer espejo* que entrega el estado acumulado tras cada evento; *verificador de invariantes de stream*
  (balance abierto/cerrado + propietario por entidad); *validación semántica de catálogo* previa a pintar una
  superficie A2UI.
* **No aporta** (4 descartes con fundamento): el vocabulario de eventos (Ego ya tiene `EgoEvent` canónico y su
  normalizador), el contexto de herramientas desde el cliente (abriría una segunda ruta de catálogo que esquiva
  `ApprovalEngine`), el protocolo de interrupción HITL (Ego tiene `ActionIdentity` + `InteractionTransport` + auditoría
  `gov/audit`) y el descriptor `AgentCapabilities` (ya cubierto por `SubEgoManifest`).
* **Decisión de encuadre:** AG-UI queda clasificado como **protocolo de interop externo (Nivel C)**, candidato para
  Ego Web. **No** es la arquitectura del borde interno de Ego, que es IPC tipado + `EventBus` canónico.

### MATRIZ DE DISTRIBUCIÓN POR FASE ###

```text
                        AG-UI  (8 hallazgos)
  +---------------------------------------------------------------+
  |  FASE 02 - Accion & Tools    AGUI-05 * Verificador de stream   |
  |  FASE 03 - Sub-Egos          AGUI-05 ~ anidamiento SUB-06      |
  |  FASE 04 - Dynamic Workspace AGUI-02 * Deltas RFC 6902         |
  |                              AGUI-07 * A2UI semantico + retry  |
  |                              AGUI-03 o Cadena coprocesamiento  |
  |  FASE 06 - Knowledge & Data  AGUI-02 ~ state window KB-05      |
  |  FASE 11 - Security          AGUI-05 ~ invariantes SEC-08      |
  |  DESCARTES (4): AGUI-01 - AGUI-04 - AGUI-06 - AGUI-08         |
  +---------------------------------------------------------------+
  * = asimilable, pendiente de cableado   o = diferido a fase destino
  ~ = impacto indirecto sobre tareas ya cerradas
```

### Recuento de estados (verificado sobre las 8 filas de la tabla §2) ###

| `✅ Completada` | `🚫 Descartada` | `🆕 Pendiente` | `⏳ Futura` | Total |
| :---: | :---: | :---: | :---: | :---: |
| 0 | 4 | 3 | 1 | **8** |

---

## 2. Catálogo Detallado de Extracción (10 Columnas Canónicas) ##

| ID | Severidad | Hallazgo | Archivo AG-UI | Esfuerzo | Prioridad | Estado | Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `AGUI-01` | 🔴 Crítica | **Unión de eventos del protocolo como vocabulario canónico** | `sdks/typescript/packages/core/src/generated/types.ts:2555` | 🟢 0.5d | 🟠 P1 | 🚫 Descartada (con justificación) | La unión `Event` (31 variantes, `types.ts:2555`) con `BaseEvent` compuesto (`types.ts:3018`) **no se adopta**. Ego ya tiene `EgoEventType` cerrado + `CanonicalEventPayloadMap` tipado (`packages/events/src/types.ts:5`, `:100`) sobre `EventBus` (`packages/events/src/EventBus.ts:81`), y `EventNormalizer` (`packages/events/src/EventNormalizer.ts:35`) ya traduce eventos externos al vocabulario canónico — la misma función que el borde AG-UI. Adoptar AG-UI crearía un **segundo vocabulario canónico**. AG-UI queda como protocolo de interop (Nivel C) para Ego Web. | Ego: `ACT-05`, `ACT-12`, `CORE-02` · Extracción: `docs/extractions/ag-ui.md` §2 Bloque A | — |
| `AGUI-02` | 🔴 Crítica | **Estado compartido: `STATE_SNAPSHOT` + deltas RFC 6902 (JSON Patch)** | `core/src/generated/types.ts:723`, `:904`, `:765`, `:883` · `client/src/apply/default.ts:726-760` | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | **Asimilable y no asimilado.** Ego **no tiene aplicador RFC 6902**: `grep -E "jsonpatch\|JsonPatch\|applyPatch"` sobre `packages/` → 0 coincidencias; el `CanvasBridge` usa path punteado propio (`packages/ui-runtime/src/CanvasBridge.ts:165`, `:311`). El patrón AG-UI aplica el patch **sin mutar el original** y de forma atómica (`apply/default.ts:747`), y compacta una ventana de deltas a **un snapshot final** (`client/src/compact/compact.ts:87`). **Cableado:** crear `packages/ui-runtime/src/JsonPatchApplier.ts` + `packages/ui-runtime/src/StateDeltaApplier.ts` y conectarlos al canal de mutación del Canvas. **Responsable:** owner de `packages/ui-runtime/**` (A4). | Ego: `CANV-03`, `CANV-06`, `KB-05` | `AGUI-07` |
| `AGUI-03` | 🟠 Alta | **Cadena de coprocesamiento en el borde agente↔UI (`Middleware.run(input, next)`)** | `client/src/middleware/middleware.ts:9`, `:24`, `:30`, `:40` | 🟡 2d | 🟠 P1 | ⏳ Futura (Fase 04) | `grep -E "middleware\|Middleware"` sobre `packages/` → 0 coincidencias: Ego tiene normalización (`EventNormalizer`) e ingreso no bloqueante (`packages/events/src/EventIngress.ts:45`), pero **no un punto de composición extensible** donde colgar transformaciones sin tocar el runtime (`AGENTS.md` §7). La `Middleware` abstracta con `run(input, next)` y el reductor espejo `runNextWithState` (`:40`, que entrega `{event, messages, state}` ya aplicado) son el patrón a asimilar. **Motivo del diferimiento:** es una **capa arquitectónica nueva**, no una mejora de capacidad aprobada; por `docs/extractions/README.md` §2 (Vía 2) exige ficha en `docs/research/` + aprobación del owner antes de codificar. **Fase destino:** 04 (`CANV-03`), extensible a `SEC-02` en Fase 11. | Ego: `CANV-03`, `ACT-12`, `SEC-02` | `AGUI-02` |
| `AGUI-04` | 🔴 Crítica | **Contexto de herramientas definido por el cliente (`RunAgentInput.tools`, `Context[]`)** | `core/src/generated/types.ts:1508`, `:1536`, `:1578` · `docs/concepts/tools.mdx:56-105` | 🟢 0.5d | 🟠 P1 | 🚫 Descartada (con justificación) | La propia spec lo restringe: *«`RunAgentInput.tools` es solo para las tools del cliente, no todas las del backend»* (`docs/concepts/tools.mdx:101-105`). En Ego el catálogo de tools vive **en main**, con riesgo y exportación a JSON Schema (`packages/tools/src/ToolRegistry.ts:23`, `:207-214`, `ACT-01`), y el renderer solo lo consulta (`apps/desktop/src/preload.ts:320`, `ipc.mcp.listTools`). Exponer el schema desde el renderer hacia el modelo abriría una **segunda ruta de catálogo** que esquivaría el `ApprovalEngine` (`ACT-06`) y `SEC-05`, violando el principio 6. El `FilterToolCallsMiddleware` (`client/src/middleware/filter-tool-calls.ts:19`) cae en el mismo descarte: filtra la **emisión**, no la ejecución (`docs/concepts/middleware.mdx:132`). | Ego: `ACT-01`, `ACT-06`, `ACT-09`, `INT-05`, `SEC-05` | — |
| `AGUI-05` | 🟠 Alta | **Verificador de invariantes de stream en el cliente (`verifyEvents`)** | `client/src/verify/verify.ts:7`, `:16-60`, `:78` | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | **Asimilable y no asimilado.** No hay equivalente en Ego (grep sin resultados). Mantiene el balance abierto/cerrado por tipo de entidad y un **mapa de propietarios por entidad** (`verify.ts:16-60`), indexando los pasos por **(owner, nombre)** en mapas anidados (`:78`) para que un Sub-Ego hijo pueda abrir un paso homónimo al del padre sin colisión. Es directamente aplicable a `SUB-06` (anidamiento con `maxDepth=3`) y `ACT-02`. **Cableado:** crear `packages/events/src/EventSequenceVerifier.ts` e invocarlo en `packages/runtime/src/ToolExecutionLoop.ts` antes de emitir al bus y en `packages/events/src/EventIngress.ts` para eventos entrantes. **Responsable:** owner de `packages/events/**` (A2) + `packages/runtime/**` (A3). | Ego: `ACT-02`, `ACT-12`, `SUB-06`, `SEC-08` | — |
| `AGUI-06` | 🟠 Alta | **Protocolo de interrupción HITL con reanudación (`Interrupt` / `ResumeEntry`)** | `core/src/generated/types.ts:1718`, `:1550`, `:1773` · `client/src/interrupts/index.ts:13`, `:22` | 🟢 0.5d | 🟠 P1 | 🚫 Descartada (con justificación) | Ego resuelve HITL de forma **más estricta**: `ApprovalEngine` con `ActionIdentity` inmutable (`packages/execution/src/ApprovalEngine.ts`, `ACT-06`), `InteractionTransport` que **nunca rechaza** y resuelve `false` ante timeout (`packages/events/src/InteractionTransport.ts:75`), `approval.required`/`approval.resolved` con `timeoutMs` (`packages/events/src/types.ts:121`) y auditoría inmutable en `gov/audit` (`SEC-06`). Modelar la aprobación como un evento más del stream (`RUN_FINISHED` con outcome `interrupt`, `types.ts:1773`) diluiría la granularidad de `ActionIdentity` y permitiría reanudar un run sin la identidad que la auditoría exige. `buildResumeArray` (`interrupts/index.ts:22`) aporta solo una validación estricta de IDs ya cubierta por el `ApprovalEngine`. | Ego: `ACT-06`, `ACT-07`, `INT-05`, `SEC-06` | — |
| `AGUI-07` | 🟠 Alta | **Middleware A2UI: validación semántica de catálogo + ciclo de vida `building→retrying→failed`** | `middlewares/a2ui-middleware/src/index.ts:138`, `:187`, `:249`, `:280`, `:404`, `:736`, `:972` · `sdks/typescript/packages/a2ui-toolkit/src/validate.ts:104` · `recovery.ts:20` | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | **Asimilable y no asimilado.** Ego valida **solo estructura**: `packages/ui-runtime/src/A2UIAdapter.ts:30-37` usa `CanvasComponentManifestSchema.safeParse` y, ante fallo, emite op `fallback` (`:36`). AG-UI valida **semánticamente** el árbol contra el catálogo (root, `required`, referencias hijas) antes de pintar (`a2ui-toolkit/src/validate.ts:104`, bindings diferidas en `:60`), reintenta acotado a 3 intentos (`recovery.ts:20`, `:111`) y proyecta el ciclo sobre un `messageId` estable para **sustituir el esqueleto in situ** (`a2ui-middleware/src/index.ts:187`, `:736`), cancelando además las superficies sin respuesta (`:972`). **Cableado:** validar semánticamente contra `CanvasComponentRegistry` (`packages/ui-runtime/src/ComponentRegistry.ts:55`, `propsSchema` por componente) **antes** de emitir la op `inject` en `A2UIAdapter.ts`, y mapear el ciclo a `canvas.inject` / `canvas.mutation` (`packages/ui-runtime/src/CanvasBridge.ts:42`, `:222`). **Responsable:** owner de `packages/ui-runtime/**` (A4). | Ego: `CANV-01`, `CANV-02`, `CANV-05` | `AGUI-02` |
| `AGUI-08` | 🟡 Media | **Declaración de capacidades del agente (`AgentCapabilities`)** | `core/src/generated/types.ts:2948`, `:2908` | 🟢 0.5d | 🟠 P1 | 🚫 Descartada (con justificación) | Sustituido por `SubEgoManifest` (`packages/subegos/src/SubEgoManifest.ts`, `SUB-01`), que declara `capabilities`, `tools`, `permissions`, `memoryScope`, `behavior` y `autonomy` con esquema Zod, expuesto por `packages/subegos/src/SubEgoRegistry.ts` (`SUB-07`) y visible en `apps/desktop/renderer/components/SubEgosView.tsx` (`SUB-08`). Mantener `AgentCapabilities` (10 categorías, incl. `humanInTheLoop` con `approvals`/`interventions`/`interrupts`) sería un **segundo descriptor de capacidades** con semántica solapada y no canónica. El resumen de capacidades ya existe y es tipado. | Ego: `SUB-01`, `SUB-07`, `SUB-08` | — |

---

## 3. Matriz de Integración con el Backlog Maestro ##

```text
Fase 02 - Accion & Tools      +---------------------------------+
  ACT-02  ToolExecutionLoop   | AGUI-05  Verificador de stream  |
  ACT-12  EventBus<->Loop/Main|  cablear antes de emitir al bus |
  SUB-06  DelegationRouter --->|  (owner A2/A3)                  |
  SEC-08  Penetracion/limites +---------------------------------+

Fase 04 - Dynamic Workspace   +---------------------------------+
  CANV-01 Catálogo declarativo| AGUI-07  A2UI semantico: validar |
  CANV-02 Canvas Runtime      |  contra ComponentRegistry (A4)  |
  CANV-03 CanvasBridge <----->| AGUI-02  Deltas RFC 6902:        |
  CANV-05 Componentes Sub-Ego |  JsonPatchApplier (A4)          |
  CANV-06 Persistencia Canvas | AGUI-03  Cadena coprocesam.     |
  KB-05   Data Views          |  Fase 04 (Via 2 -> owner)       |
                             +---------------------------------+

Fase 11 - Seguridad           +---------------------------------+
  SEC-02 Contratos IPC Zod    | AGUI-03 (extension futura)      |
  SEC-06 Auditoria gov/audit  | AGUI-05 (invariantes)           |
  SEC-08 Suite de penetracion | AGUI-06 ya cubierto              |
                             +---------------------------------+
Descartes: AGUI-01 - AGUI-04 - AGUI-06 - AGUI-08
```

**Protocolo de ejecución por tarea** (heredado de `docs/review/backlog-hermes.md` §3): (1) *lectura y aislamiento*
del fichero fuente en `repos-referencia/ag-ui/` identificando dependencias externas (RxJS, Zod, `fast-json-patch`);
(2) *eliminación de acoplamiento* — descartar la unión de eventos, los transportes de red, RxJS y las 23
integraciones de frameworks; (3) *reescritura canónica* en TypeScript estricto dentro de `packages/`, sin `any` y
sin dependencias nuevas no justificadas en `docs/design/design-system.md`; (4) *verificación* con test unitario del
aplicador/verificador y test de error (patch inválido, entidad no abierta) antes de integrarlo en el hilo de
eventos; (5) *cierre de tarea* — marcar `✅ Completada` **solo** con fichero adaptado + caller en producción
verificado por grep; `🆕 Pendiente` mientras no haya cableado; `🚫 Descartada (con justificación)` si el patrón no
aplica.

---

## 4. Deuda abierta derivada de esta verificación ##

| # | Ítem | Tipo | Owner | Bloqueante |
| --- | --- | --- | --- | --- |
| D1 | `AGUI-03`: la cadena de coprocesamiento en el borde exige ficha en `docs/research/` + aprobación del owner (Vía 2 de `docs/extractions/README.md` §2) antes de codificar | Decisión | Owner (ness-e) | Sí — bloquea la implementación de la cadena |
| D2 | `AGUI-02` / `AGUI-07`: `packages/ui-runtime` no tiene aplicador RFC 6902 ni validación semántica de catálogo; el Canvas muta por path punteado | Código | A4 (`packages/ui-runtime/**`) | No |
| D3 | `AGUI-05`: `packages/events` no verifica invariantes de stream; el balance abierto/cerrado por entidad y la propiedad por Sub-Ego no se comprueban | Código | A2 (`packages/events/**`) + A3 (`packages/runtime/**`) | No |
| D4 | `AGUI-01`: si Ego Web adopta AG-UI como protocolo de salida, hará falta un **traductor único** `AG-UI <-> EgoEvent`; el `EventNormalizer` (`packages/events/src/EventNormalizer.ts:7`) es el punto de extensión natural y hoy solo cubre eventos de CLI/hooks | Decisión | Owner + A2 | No |
| D5 | `AGUI-04`: mientras el renderer solo consulta `ipc.mcp.listTools` (`apps/desktop/src/preload.ts:320`), el catálogo de tools permanece en main — **verificar en cada revisión** que no se abre una ruta renderer→modelo que esquive `ApprovalEngine` | Código | A2 (`packages/tools/**`) | No |
