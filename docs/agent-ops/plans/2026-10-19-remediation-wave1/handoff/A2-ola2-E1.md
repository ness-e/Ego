# Handoff A2 — Ola 2, tarea E1 — 2026-10-20

> Agente: A2 (núcleo cognitivo, 9 paquetes) · Zona: `packages/{memory,knowledge,runtime,models,decision,execution,events,security,tool-call-repair}/**`
> Nada fuera de la zona fue editado. `apps/**` (A4), `docs/**` (A1), `scripts/**` y `tests/e2e/**` (A7) → cambios como diff/petición en §4.

## 1. Cambios aplicados (ficheros propios)

### E1 — Ejecución concurrente de tool calls con orden `tool_use`/`tool_result` garantizado (cierra `EGO-FIND-43`)

**Ficheros**: `packages/runtime/src/ToolExecutionLoop.ts` (refactor del bucle de tools),
`packages/runtime/src/types.ts` (config + opciones), `packages/runtime/test/ToolExecutionLoop-parallel.test.ts` (nuevo, 6 tests).

#### El diseño y por qué funciona con el contrato del proveedor

**Restricción real verificada (no de memoria)**: el payload de Anthropic exige que cada
`tool_result` siga en orden a su `tool_use`. La documentación de Anthropic
(`docs.anthropic.com` / `platform.claude.com`) está **geobloqueada por región** en este
entorno ("App unavailable in region"), así que la constraint se verificó contra el **source
del SDK instalado** (`@ai-sdk/anthropic@4.0.78`, `ai@7.0.137`):

- `src/convert-to-anthropic-prompt.ts` → `groupIntoBlocks()` (**L1569-1577**): los mensajes
  con `role: "tool"` **consecutivos** se agrupan en un único bloque `user` y sus partes
  `tool_result` se empujan **en el orden del array de mensajes**.
  ⇒ *El orden del array `messages` de Ego ES el orden de los `tool_result` del payload.*
- `src/convert-to-anthropic-prompt.ts` → `moveToolUseBlocksToEnd()` (**L1588-1618**): mueve
  los bloques `tool_use` al final de su segmento (detrás del texto), pero **NO reordena los
  `tool_use` entre sí** ⇒ el orden relativo de los `tool_use` se conserva.
- `packages/models/src/providers/AiSdkAnthropicProvider.ts:194-232` (`toMessages`): cada
  mensaje `tool` de Ego se traduce a un mensaje `tool` del SDK con **un** `tool-result`.

**Conclusión**: un `Promise.all` ingenuo que emitiera por orden de completación produciría
un payload con `tool_result` desalineados respecto de sus `tool_use`. Por eso el diseño
no es "paralelizar", sino **"paralelizar la ejecución y serializar la emisión"**.

**Arquitectura en 3 fases** (implementada en `ToolExecutionLoop.run()`):

| Fase | Qué hace | Secuencial o concurrente |
|---|---|---|
| **A. Preparación** | lookup en el registry, reparación sintáctica, validación Zod, gates de gobernanza (STAB-12) y **aprobación HITL por tool**. Cero I/O. | **Secuencial**, en el orden de los `tool_use` |
| **B. Ejecución** | `ExecutionManager.execute()` para cada tool aprobada. | **Concurrente** (`Promise.allSettled`) |
| **C. Emission** | Los resultados se empujan a `messages` en el **orden original** de los `tool_use`. | **Secuencial** |

Detalles de diseño:

- **Aislamiento de fallos (E1-3)**: `Promise.allSettled` captura los rechazos. Un rechazo por
  cancelación → turno `aborted` (mismo contrato que antes). Un rechazo **no** por cancelación
  → se **aisla**: el error ocupa **su** posición en el array y el turno continúa.
  *Verificado*: hoy el fallo de una tool **no** abortaba el turno, porque
  `ExecutionManager.execute` ya capturaba internamente la excepción y devolvía
  `{status:"error"}`. E1 lo convierte en un contrato explícito (y añade el aislamiento del
  camino de rechazo, que antes propagaba la excepción).
- **Gobernanza por tool (E1-4)**: la resolución de aprobación sigue siendo **por tool** y en
  la fase A. Si una tool exige aprobación y **no hay** handler ni engine, el turno se
  suspende (`status: "approval_required"`) —igual que antes— y:
  - se ejecutan y emiten los resultados de las tools **anteriores** (en orden), y
  - las tools **posteriores NO se ejecutan** (mismo contrato que la ejecución en serie).
  Esto es lo que **mantiene el orden** al reanudar: `resume()` empuja el resultado de la
  tool pendiente al **final** del array, de modo que emitir resultados posteriores a la
  suspendida rompería el orden. Verificado por el test 4 y por el test 6 existente del
  `ToolExecutionLoop` (suspender + reanudar).
- **Límites y cancelación (E1-5)**: no se reimplementa ningún límite — el `ExecutionManager`
  sigue siendo el único dueño de `maxConcurrentExecutions`, la cola cancelable, el timeout por
  llamada, el truncado por bytes, el circuit breaker y la quota por Sub-Ego. La concurrencia
  la gobierna el manager, no el loop. El `AbortSignal` del turno se propaga a cada llamada
  (`execManager.execute(..., { abortSignal })`).
- **No-regresión (E1-6)**: `ToolExecutionLoopConfig.parallelToolCalls` (por defecto `true`)
  permite restaurar el modo estrictamente serie; y con
  `maxConcurrentExecutions: 1` el comportamiento es serie por el manager.
  Además, el **resto** de la Ola 1 intacto: `TrustBoundary` (taint + canal dual), truncado por
  bytes, cola cancelable, `CircuitBreaker` (veto pre-flight), `ApprovalEngine` sin `any`,
  confianza calibrada a 0.9 y `ContextCompaction`.

#### Medición de la concurrencia (no una afirmación)

Persistente en el repo: `packages/runtime/test/ToolExecutionLoop-parallel.test.ts` test (1)
imprime la medición y además la **AFIRMA** con dos instrumentos independientes (reloj +
contador de tools en vuelo observados dentro de las propias tools).

Salida real (`pnpm --filter @ego/runtime exec vitest run test/ToolExecutionLoop-parallel.test.ts`):

```
[E1-medicion] N=6 L=100ms C=3 -> real=220ms | teorico_paralelo=200ms | teorico_serie=600ms | concurrencia_max_observada=3
```

- `real=220ms` frente a `teorico_paralelo=ceil(6/3)*100=200ms` y `teorico_serie=6*100=600ms`
  ⇒ **2.7x más rápido que en serie**, con un 10 % de sobrecoste sobre el ideal (overhead del
  event loop, el `ExecutionManager` y el scheduler de timers).
- `concurrencia_max_observada=3` ⇒ el tope `C=3` del `ExecutionManager` se respeta
  (nunca se observaron 4 tools en vuelo) **y** hay solapamiento real (no es un reloj
  false-positive).
- El test afirma además `elapsed < serie*0.75` y `elapsed >= paralelo*0.7`: si alguien
  volviera a serializar, el reloj lo delata; si la ejecución no llegara a solaparse, el
  contador lo delata.

#### Limitación real encontrada en el SDK (documentada, no supuesta)

1. **La doc de Anthropic no es consultable desde este entorno** (geobloqueo regional). La
   constraint se verificó contra el source del SDK instalado, que es la fuente autoritativa
   para la serialización. Queda **pendiente** que A1/A7 lo contrasten con la doc cuando haya
   acceso regional.
2. **El SDK agrupa N mensajes `tool` en un solo bloque `user`.** Consecuencia para Ego: los
   resultados de tools **deben** ser contiguos en el array (no puede intercalarse un mensaje
   `user` entre dos `tool_result` de tools distintas sin romper la agrupación). La fase de
   emisión satisface esto por construcción (se emiten todos seguidos, en orden).
3. **No se pierde información por reordenar**: el `tool_result` lleva su `tool_use_id`, así
   que la correspondencia es explícita; el orden es unarequirement del formato, no del
   matching. Aun así se garantiza, porque es lo que el proveedor exige.

### `correlationId` — propagación turno → tool call → evento (cierra `EGO-FIND-74`)

**Ficheros**: `packages/events/src/correlation.ts` (nuevo), `packages/events/src/index.ts`,
`packages/runtime/src/ToolExecutionLoop.ts`, `packages/runtime/src/types.ts`,
`packages/runtime/test/correlation.test.ts` (nuevo, 3 tests).

- `packages/events/src/correlation.ts` es la **implementación canónica** (migrada de
  `scripts/correlation.mjs`, que es un `.mjs` de nivel raíz y por tanto **no importable**
  desde un paquete de workspace — el propio módulo lo anticipaba: *"se puede mover a
  `packages/events` cuando A2 lo integre"*). Mismo contrato: `newCorrelationId()`,
  `childCorrelationId(parent, span)`, `withCorrelation`, `readCorrelationId`,
  `isCorrelationId`, `CORRELATION_HEADER`.
- `LoopRunOptions.correlationId` (nuevo) y `ToolExecutionResult.correlationId` (nuevo).
- El loop deriva un **span hijo determinista por tool call**
  (`childCorrelationId(correlationId, "tool:<nombre>")`) y lo propaga en
  `metadata.correlationId` de los eventos `tool.started`, `tool.executed`, `tool.failed`,
  `approval.required` y `approval.resolved`. `tool.started` y `tool.executed` de la misma
  tool **comparten span** ⇒ se puede reconstruir la traza (turno → tool → resultado).
- Sin `correlationId` no se inyecta `metadata` (comportamiento idéntico al anterior).

### Deuda de mis handoffs anteriores cerrada en mi zona

| Deuda (handoff) | Estado |
|---|---|
| `EGO-FIND-43` — ejecución paralela de tool calls (Ola 1 / 1b) | **CERRADA** (este trabajo) |
| 32 `any` residuales en aserciones de test (Ola 1) | **CERRADA** (Ola 1c: `as any` → casts estructurales) |
| `VDB-REQ-10/11/12` registrados en el registro de VantaDB (Ola 1c) | Pendiente de **A1** (§4) — no es zona mía |
| Mitad de NetPolicy para A3 (Ola 1b) | Pendiente de **A3** (§4) — no es zona mía |
| Umbral DEC-09 `0.9` en `tests/e2e` (Ola 1b) | Pendiente de **A7** (§4) — no es zona mía |
| ADR 0017 `compact()` nativo vs `ContextCompaction` (Ola 1b) | Pendiente de **A1** (§4) — no es zona mía |

## 2. Verificación

| Comando | Exit | Resumen |
|---|---|---|
| `pnpm --filter @ego/{memory,knowledge,runtime,models,decision,execution,events,security,tool-call-repair} test` | **0** | **698 tests** (Ola 1c: 669 → **+29**), 0 fallos |
| `pnpm --filter @ego/<cada uno> typecheck` (×9) | **0** | 9/9 sin errores |
| `pnpm -r typecheck` | **0** | 23/23 proyectos (el renderer de A4/A6 ya compila) |
| `pnpm exec oxlint ... --max-warnings 310` | **1** | **343 warnings totales, 0 en los ficheros que he tocado en esta ola**. El exceso (343 > 310) es de zonas ajenas: `apps/desktop` 165 (A4) + `packages/avatar` 59 (A6) + `packages/tools` 18 (A3) + `packages/subegos` 12 + `tests/e2e` 10. **Mi zona aporta 44 avisos, todos preexistentes** (ficheros de test antiguos: `vi` sin usar, optional-chaining, etc.). No es un bloqueo de A2: el umbral lo fija el root `package.json` (propiedad de A7) |
| `any` en producción (9 paquetes) | — | **3** (los 3 con justificación AGENTS.md §4: `SessionLifecycleLocks.ts:29`, `ExecutionManager.ts:154`, `events/types.ts:158`). En tests: **6** (restantes) |
| Medición E1 | — | `real=220ms` vs `paralelo=200ms` / `serie=600ms`; `concurrencia_max=3` |

Detalle de tests por paquete (698): memory 153 · knowledge 86 · **runtime 103** · models 93 ·
decision 52 · execution 59 · events 38 · security 103 · tool-call-repair 11.

**TDD**: test rojo primero y demostrado antes de cada fix.
- `ToolExecutionLoop-parallel.test.ts`: con el harness corregido, **1 fallo** — *"concurrencia
  REAL … expected 1 to be greater than or equal to 2"* (máxima concurrencia observada = 1, es
  decir, ejecución en serie). Los otros 5 tests (orden, aislamiento, gate por tool,
  cancelación, no-regresión) pasaban **antes** y son las **guardas** que deben seguir
  pasando tras el cambio.
- `correlation.test.ts`: **2 fallos** (*"expected 'max_steps_exceeded' to be 'completed'"* —
  el provider de test no cerraba el turno) + el helper de `@ego/events` verificado por
  contrato (id opaco, derivación determinista, spans distintos por tool).

## 3. Ficheros modificados (zona A2)

- `packages/runtime/src/ToolExecutionLoop.ts` — bucle de tools en 3 fases (preparación /
  ejecución concurrente / emisión ordenada) + `correlationId`.
- `packages/runtime/src/types.ts` — `ToolExecutionLoopConfig.parallelToolCalls`,
  `LoopRunOptions.correlationId`, `ToolExecutionResult.correlationId`.
- `packages/runtime/test/ToolExecutionLoop-parallel.test.ts` (nuevo) — 6 tests E1 + medición.
- `packages/runtime/test/correlation.test.ts` (nuevo) — 3 tests de correlación.
- `packages/events/src/correlation.ts` (nuevo) — helper canónico de correlación.
- `packages/events/src/index.ts` — export del helper.

## 4. Solicitudes fuera de zona (NO aplicadas)

| # | Fichero | Cambio pedido | Motivo | Bloqueante |
|---|---|---|---|---|
| 1 | `packages/tools/src/native/security/NetPolicy.ts` + `packages/tools/package.json` | **Diff C** (ya entregado en `handoff/A2-ola1b.md` §2.1): re-export de `@ego/security` (`ssrfPolicy.ts`) + dep `"@ego/security": "workspace:*"` | R4: una sola política de red, con DNS | — (A3 + A7) |
| 2 | `tests/e2e/golden-path-alpha-full.test.ts:182` | **Diff D** (entregado en `handoff/A2-ola1b.md` §2.2): restaurar `toBeGreaterThanOrEqual(0.9)` | El rodeo de 0.7 era por la regresión de plurales, ya resuelta | — (A7) |
| 3 | `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` | Registrar `VDB-REQ-10/11/12` + las 2 filas de índice que faltan (`VDB-INC-04`, `VDB-BUG-06`) | `AGENTS.md` §4: sin registro, el gate de A7 falla | — (A1) |
| 4 | `docs/adr/0017-*.md` | Texto ADRNeeded sobre `compact()` nativo vs `ContextCompaction` (entregado en `handoff/A2-ola1b.md` §2.3) | Decisión de arquitectura pendiente | — (A1) |
| 5 | `docs/architecture/*` | Corregir `memoria-vantadb.md` §10 y la línea de `AGENTS.md` que describe `packages/knowledge` como "búsqueda BM25 léxica + re-rank MMR (sin RRF…)" (ya corregida por A1) | Honestidad documental | — (A1) |
| 6 | `scripts/verify-vantadb-ids.mjs` (A7) | Sin cambios. Estado actual: 23 errores E1/E2, **todos** por `VDB-REQ-10/11/12` sin registrar (las referencias de mi zona ya son correctas). Con §3 aplicado + las 2 filas de §4.3 ⇒ 0 errores | — (A7 informativo) |
| 7 | `package.json` raíz (A7) | El umbral `--max-warnings 310` está superado (343) por avisos de `apps/desktop` (165) y `packages/avatar` (59). **A2 aporta 0 avisos nuevos** | Lint global en rojo | — (A7/A4/A6) |
| 8 | `apps/desktop/src/main.ts` (A4) | Propagar `correlationId` desde el turno de chat: `ToolExecutionLoop.run({ correlationId })`. El runtime ya acepta la opción; el main debe generarla (`newCorrelationId()` de `@ego/events`) y pasarla | El gate de A7 detectó 0 callsites de `correlationId` | — (A4) |

**Diff para A4 (propagación del `correlationId` desde el turno)** — el runtime ya está listo:

```diff
--- a/apps/desktop/src/main.ts
+++ b/apps/desktop/src/main.ts
@@ imports (@ego/events) @@
+import { newCorrelationId } from "@ego/events";
@@ handler de chat (ipc.llm.*) @@
+  // EGO-FIND-74: id de correlación del turno; se propaga a cada tool call
+  // (span derivado `tool:<nombre>`) y a sus eventos.
+  const correlationId = newCorrelationId();
   const loopResult = await toolLoop.run({
     messages,
     context: execContext,
+    correlationId,
     …
   });
```

## 5. Limitaciones y riesgos reales

1. **La doc de Anthropic no es consultable desde este entorno** (geobloqueo regional). La
   constraint de orden se verificó contra el **source del SDK instalado**, que es la fuente
   autoritativa para la serialización; conviene un contraste con la doc cuando haya acceso
   regional (A1/A7).
2. **La resolución de aprobaciones sigue siendo secuencial** (fase A). Es deliberado: pedir
   una aprobación y luego **abandonarla** (porque otra tool suspenda el turno) dejaría
   aprobaciones pendientes huérfanas en el `ApprovalEngine` y en la UI. El coste es que una
   tool que espera aprobación humana **bloquea la ejecución** de las siguientes del turno
   (igual que antes). La latencia real (I/O de tools) sí es concurrente.
3. **`resume()` sigue siendo secuencial** (una tool por reanudación): el contrato de
   suspensión es "una aprobación pendiente por turno", así que la reanudación ejecuta una
   tool y continúa. No se ha paralelizado porque la aprobación pendiente es una sola y su
   resolución llega del exterior.
4. **Límite de concurrencia efectivo**: el `ExecutionManager` es el dueño del límite
   (`maxConcurrentExecutions`, por defecto 5). El loop lanza todas las tools del turno a la
   vez y el manager las encola; por tanto la concurrencia real la fija el manager, no el
   loop. Con `maxConcurrentExecutions: 5` (defecto) y 20 tools, se ejecutan de 5 en 5.
5. **Lint global en rojo (343 > 310)** por zonas ajenas; **0 avisos nuevos de A2**.

```
RESULTADO: {
  agente: A2-nucleo-ola2-E1,
  status: COMPLETED,
  archivos_modificados: [
    "packages/runtime/src/ToolExecutionLoop.ts",
    "packages/runtime/src/types.ts",
    "packages/runtime/test/ToolExecutionLoop-parallel.test.ts",
    "packages/runtime/test/correlation.test.ts",
    "packages/events/src/correlation.ts",
    "packages/events/src/index.ts",
    "docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A2-ola2-E1.md"
  ],
  hallazgos_resueltos: ["EGO-FIND-43 (ejecución concurrente con orden tool_use/tool_result garantizado)",
    "EGO-FIND-74 (correlationId propagado turno → tool call → evento)"],
  verify: { typecheck: "exit 0 en los 9 paquetes y en `pnpm -r typecheck` (23/23)",
    tests: "698 passed (669 → +29), 0 failed",
    lint: "exit 1 por 343 avisos globales (límite 310) TODOS de zonas ajenas: 0 avisos nuevos de A2",
    medicion: "N=6 L=100ms C=3 → real=220ms (paralelo teórico 200ms, serie 600ms), concurrencia máx observada 3" },
  solicitudes_handoff: 8,
  deuda_abierta: [
    "A3+A7: mitad de NetPolicy (re-export de @ego/security) — entregada en handoff/A2-ola1b.md §2.1",
    "A7: restaurar el umbral DEC-09 a 0.9 en tests/e2e — entregada en handoff/A2-ola1b.md §2.2",
    "A1: registrar VDB-REQ-10/11/12 + 2 filas de índice que faltan (desbloquean el gate)",
    "A1: ADR 0017 compact() nativo vs ContextCompaction — entregada en handoff/A2-ola1b.md §2.3",
    "A4: pasar correlationId al toolLoop.run() — diff en §4.8",
    "A7/A4/A6: umbral global de lint (343 > 310) sin intervención de A2",
    "A1/A7: contrastar la constraint de orden de tool_result con la doc de Anthropic (geobloqueada aquí)"
  ],
  SKILLS_CARGADAS: ["source-driven-development", "test-driven-development", "systematic-debugging", "code-review-and-quality", "documentation-and-adrs"]
}
```