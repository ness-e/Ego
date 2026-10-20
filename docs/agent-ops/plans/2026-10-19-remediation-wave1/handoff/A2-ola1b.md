# Handoff A2 — Ola 1b — 2026-10-20

> Agente: A2 (núcleo cognitivo, 9 paquetes) · Zona: `packages/{memory,knowledge,runtime,models,decision,execution,events,security,tool-call-repair}/**`
> Nada fuera de la zona fue editado. `apps/desktop/src/main.ts` (A4), `packages/tools/**` (A3), `tests/e2e/**` (A7) y `docs/**` (A1) → cambios como diff exacto en §2.

## 1. Cambios aplicados (ficheros propios)

### T1 — Regresión de A7: `countWordHits` no matcheaba plurales (ALTA) — **RESUELTA**
- `packages/decision/src/IntentClassifier.ts:60-135` — `pluralForms()`: genera **variantes plurales explícitas** por regla de pluralización ES/EN (vocal→`+s`; `ción/sión`→`ciones/siones`; `s/x/z/ch/sh/h`→`+es`; consonante+`y`→`ies`; resto→`+s` y `+es`). `countWordHits()` acepta singular **y** plural, manteniendo el límite de palabra y contando **claves distintas** (no ocurrencias).
- **No se aplicó el parche de A7** (sufijo ciego `(?:s|es)?`), que además habría cambiado la semántica de "claves distintas" a "ocurrencias" y habría匹配ado `does`→`do`. El fix propio cubre: `tests`→`test`, `commits`→`commit`, `files`→`file`, `branches`→`branch`, `códigos`→`código`, `métricas`→`métrica`, `documentos`→`documento`, `definiciones`→`definición`.
- **Falsos positivos preservados y verificados**: `testing`/`latest` ≠ `test`; `reforma` ≠ `forma`; `documentación` ≠ `documento`.
- **Confianza calibrada restaurada**: `PLURAL = SINGULAR = 0.94` (antes 0.76 vs 0.94). Contrato DEC-09 (`confidence >= 0.9`) **cumplido** en ambas formas. Verificado con `packages/decision/test/IntentClassifier-plurals.test.ts` (6 tests, rojo demostrado: 4 fallos).

### T2 — NetPolicy unificada (R4) — **SEGURIDAD: RESUELTA en mi zona**
- `packages/security/src/ssrfPolicy.ts` (nuevo, 300+ líneas) — **política de red canónica** con la superficie completa: `isBlockedIpv4/6/Ip`, `validateUrl` (léxico), `validateUrlWithDns` (fail-closed ante DNS rebinding), `assertSafeUrl`, `redactUrl`, `NetPolicyOptions`, `NetPolicyDnsOptions`. Añade el veto de **credenciales embebidas** que la réplica no tenía.
- `packages/security/src/netPolicy.ts` — **delegación pura** (sin lógica duplicada): `isBlockedSSRFIPv4/6` y `validateSSRFUrl` reenvían a la política canónica.
- `packages/security/src/ToolPermissions.ts:147-158,248-290` — **eliminada** la réplica léxica (`BLOCKED_HOSTNAMES` + `isBlockedIpv4` + `checkUrl` local); `checkUrl` delega en la política canónica. 0 ocurrencias de "réplica léxica" en el código (sólo en el historial del docstring).
- `packages/security/src/index.ts` — exporta la política canónica.
- **Decisión de dirección**: `@ego/security` es la **hoja** (0 dependencias `@ego/*`) ⇒ la dirección segura es `tools → security` (las herramientas dependen de las primitivas de seguridad; al revés no). `security → tools` habría creado una arista inversa fragile (las tools muy probablemente necesiten el filtro de secretos de `@ego/security`).
- `packages/security/test/NetPolicy-unified.test.ts` (nuevo, 6 tests) — rojo demostrado: 4 fallos (módulo canónico inexistente).

### T3 — Circuit breaker por tool + quota por Sub-Ego (R5) — **RESUELTA**
- `packages/execution/src/CircuitBreaker.ts` (nuevo) — `ToolCircuitBreaker` (closed → open → half-open, umbral de fallos **consecutivos**, ventana de reintento, sonda única en half-open) y `SubEgoCallQuota` (contador por Sub-Ego con tope y overrides). Errores **tipados**: `ToolCircuitOpenError`, `SubEgoQuotaExceededError`.
- `packages/execution/src/ExecutionManager.ts` — **vetos PRE-FLIGHT**: el circuito y la cuota se comprueban **antes** de adquirir slot ⇒ una llamada vetada **falla rápido sin consumir concurrencia ni esperar el timeout**. Los fallos (`error`/`timeout`) abren el circuito; una cancelación del usuario **no** cuenta como fallo. Observabilidad: `getCircuitState(toolName)` y `getSubEgoQuotaUsage(subEgoId)`.
- `packages/execution/src/types.ts` — `ExecutionManagerConfig.circuitBreaker` y `.subEgoQuota` (activos por defecto: 5 fallos / 30 s, 1000 llamadas por Sub-Ego).
- `packages/execution/src/index.ts` — exporta el módulo.
- `packages/execution/test/CircuitBreaker-quota.test.ts` (nuevo, 6 tests) — rojo demostrado: módulo inexistente.

### T4 — Deuda declarada en Ola 1, cerrada en lo que está en mi zona
- **`autoMemory` / `archiveTarget`** — **verificado**: A4 ya instanció `new ContextCompactionJob({ autoMemory: true }, { archiveTarget: adapter })` (`apps/desktop/src/main.ts:1951`) y llama `compactionJob.compact({...}, { isCompressionRebuild: true, sessionId })` (`:1719`). El archivado en `kb/history_archive` **ocurre de verdad** (`CompactionResult.archiveKey`). Pendiente menor en §2 (falta el resumidor LLM).
- **32 `any` residuales en aserciones de test** → **cerrado**: los `as any` de `packages/{memory,runtime,execution,events}/test/` se sustituyeron por casts estructurales estrechos (`as { campo?: unknown }`) y por `as unknown`. `0` `any` de aserción en la zona.
- **`any` en producción (3)** → los 3 llevan ahora **comentario de justificación** conforme a AGENTS.md §4 (`SessionLifecycleLocks.ts:24`, `ExecutionManager.ts:154` (L10), `events/src/types.ts:158`).
- **VDB-REQ-10 — poblado del sustrato de grafo** → **RESUELTO en mi zona**:
  - `packages/memory/EgoMemoryAdapter.ts` — nuevas delegaciones *capability-probed* al binding: `getGraphNodeId(ns, key)` (resuelve el `node_id` u128 del registro KV), `insertGraphNode(id, content)`, `addGraphEdge(src, tgt, label, weight?)` y `linkGraphNodes(srcNs, srcKey, tgtNs, tgtKey, label)` (crea la arista real entre dos registros).
  - `packages/knowledge/src/ProjectMemoryGraph.ts` — la traza causal de ingeniería **siembra el grafo**: cada referencia por fichero queda unida a la traza por una arista `derived_from` real. Best-effort: si el binding no expone el grafo, la persistencia KV sigue válida.
  - `packages/knowledge/test/GraphSeeding.test.ts` (nuevo, 2 tests).
  - Con esto, la fase nativa de `GraphRagEngine` (`graphragSearch`, DIST-15) deja de devolver `edges: []` para el subgrafo de因果idad de ingeniería.

## 2. Solicitudes fuera de zona (NO aplicadas)

| # | Fichero | Cambio pedido | Motivo | Bloqueante |
|---|---|---|---|---|
| 1 | `packages/tools/src/native/security/NetPolicy.ts` + `packages/tools/package.json` | **Diff C** (§2.1): `NetPolicy` de `@ego/tools` pasa a re-export de `@ego/security`; `packages/tools/package.json` += `"@ego/security": "workspace:*"`; `pnpm install` (A7) | R4: que exista **una sola** política de red, con DNS. Mi mitad (canónica) está aplicada; la de A3 es el re-export | — (A3 + A7) |
| 2 | `tests/e2e/golden-path-alpha-full.test.ts:182` | **Diff D** (§2.2): restaurar `expect(verdict.confidence).toBeGreaterThanOrEqual(0.9)` (hoy 0.7) | El rodeo de A7 era la mitigación temporal de la regresión de plurales; **ya está resuelta** (confianza 0.94 en plural y singular). La aserción de discriminación que A7 añadió se conserva intacta | — (A7) |
| 3 | `docs/adr/0017-*.md` | **Texto ADRNeeded** (§2.3) | Decisión pendiente: `compact()` nativo del binding vs `ContextCompaction` TS | — (A1) |
| 4 | `apps/desktop/src/main.ts:1719` | **Diff E** (§2.4): pasar el resumidor LLM al job de compactación | `compactionJob.compact(...)` se llama sin `summarizer` ⇒ usa el fallback heurístico, no el modelo | — (A4) |
| 5 | `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` | **Actualizar `VDB-REQ-10`** (§2.5): ya no está pendiente en la parte de Ego | `insertNode`/`addEdge`/`getNode` **sí** están expuestos por el binding 0.8.0; Ego ya los siembra | — (A1) |
| 6 | `docs/architecture/*` | La línea de `AGENTS.md` que dice "knowledge ← búsqueda híbrida **RRF**" sigue siendo falsa (el fast path es BM25 puro; el RRF real es requisito upstream `VDB-REQ-08`) | Honestidad documental | — (A1) |

### 2.1 Diff C — la mitad de A3: `NetPolicy` de `@ego/tools` delega en la canónica

```diff
--- a/packages/tools/src/native/security/NetPolicy.ts
+++ b/packages/tools/src/native/security/NetPolicy.ts
@@ (todo el fichero) @@
-import dns from "node:dns/promises";
-
-export interface NetPolicyOptions { … }
-export interface NetPolicyDnsOptions extends NetPolicyOptions { … }
-export class NetPolicy {
-  … toda la implementación (isBlockedIpv4/6/Ip, validateUrl, validateUrlWithDns,
-    assertSafeUrl, redactUrl) …
-}
+// R4 (EGO-FIND-66) — Ola 1b:
+// La política de red anti-SSRF **canónica** de Ego vive en `@ego/security`
+// (`src/ssrfPolicy.ts`): es una hoja sin dependencias `@ego/*` (nunca puede
+// entrar en ciclo) y su consumidor natural (`ToolPermissions`) vive en ese
+// mismo paquete. Este módulo pasa a ser un re-export: **una sola** política
+// de red en el repo, con resolución DNS.
+//
+// La semántica es idéntica a la que este módulo implementaba (mismos vectores
+// bloqueados, mismo orden de decisiones) más el veto de credenciales
+// embebidas. Los tests de este paquete siguen vigentes sin cambios.
+export {
+  NetPolicy,
+  type NetPolicyOptions,
+  type NetPolicyDnsOptions,
+} from "@ego/security";
```

```diff
--- a/packages/tools/package.json
+++ b/packages/tools/package.json
   "dependencies": {
-    "zod": "^3.23.8"
+    "zod": "^3.23.8",
+    "@ego/security": "workspace:*"
   }
```

> **A7**: hace falta `pnpm install` para materializar `packages/tools/node_modules/@ego/security` y actualizar `pnpm-lock.yaml`. Hasta entonces `@ego/tools` no compila.
> **Aviso (verificado)**: el renderer **no** importa `@ego/tools` ni `@ego/security` (`grep` en `apps/desktop/renderer` → 0 coincidencias), por lo que arrastrar el barrel de `@ego/security` (que incluye `CredentialManager` → `node:crypto`) no rompe el bundle del renderer.
> **Alternativa si A3 prefiere no invertir la dependencia**: exportar una sub-ruta (`@ego/security/ssrf`) en el `package.json` de `@ego/security` y usar `import { NetPolicy } from "@ego/security/ssrf"` desde `@ego/tools` (evita el barrel). Requiere el mismo `pnpm install`.

### 2.2 Diff D — A7 restaura el umbral DEC-09 a 0.9

```diff
--- a/tests/e2e/golden-path-alpha-full.test.ts
+++ b/tests/e2e/golden-path-alpha-full.test.ts
@@ línea 182 @@
-    expect(verdict.confidence).toBeGreaterThanOrEqual(0.7);
+    expect(verdict.confidence).toBeGreaterThanOrEqual(0.9);
```

> La regresión que motivó el rodeo está **corregida** (A2, Ola 1b): `countWordHits` ya matchea plurales y la confianza del prompt en plural es **0.94**, idéntica a la del singular. La aserción de discriminación que A7 añadió (línea ~193, `expect(verdict.confidence).toBeGreaterThan(vagueVerdict.confidence)`) **se conserva intacta** y sigue verde.
> Los comentarios de mitigación temporal de las líneas ~175-181 pueden borrarse.

### 2.3 Texto ADRNeeded para A1 (ADR 0017 — compactación de contexto)

> **Título**: *Motor de compactación de contexto: `ContextCompaction` (TypeScript) vs `compact()` nativo de VantaDB 0.8.0.*
>
> **Estado**: DECISIÓN PENDIENTE — A2 recomienda un camino, A1 redacta el ADR.
>
> **Contexto verificado** (Ola 1b, lectura del binding `vantadb-node@0.8.0`):
> - La superficie pública de `NativeVantaDB` incluye `compact(options)` — *"Compact a chat history under a token budget (pure function, no engine state)"* con `{ messages, token_budget, protected_prefix?, compaction_ratio?, min_keep? }` y heurística `chars/3`.
> - `docs/architecture/memoria-vantadb.md` §10 afirma que *"Ego no construye su propio algoritmo heurístico de poda de tokens en TypeScript; consume el Context Engine de VantaDB"* — **contradicho** por la existencia de `packages/runtime/src/ContextCompaction.ts` (520 líneas + 14 tests) y ahora por el propio binding.
> - `packages/runtime/src/ContextCompaction.ts` aporta hoy lo que el nativo no tiene: preserva el **system prompt** inicial, preserva los **pares assistant tool_call / tool result** intactos, admite un **resumidor LLM inyectable** (`SummarizerFn`, con adaptador `createRouterSummarizer` sobre el `ModelRouter`) y **archiva** el resumen en `kb/history_archive` (`autoMemory`).
> - El `compact()` nativo, en cambio, es un motor puro del engine: determinista, sin LLM, y sin archivado.
>
> **Opciones**:
> 1. **Adoptar `compact()` nativo** y mantener el motor TS sólo como *fallback offline* (o eliminarlo). Ventaja: una sola implementación; el doc canónico deja de ser falso. Coste: se pierde el resumen LLM de alta fidelidad y el archivado (hay que reconstruirlos encima).
> 2. **Mantener `ContextCompaction` como motor de Ego** y documentar `compact()` nativo como disponible parafuturo. Ventaja: conserva las invariantes (system prompt, pares tool, LLM, archivo). Coste: persiste la contradicción con `memoria-vantadb.md` §10 ⇒ **hay que enmendar el doc**.
> 3. **Híbrido**: `ContextCompaction` decide *cuándo* y *con qué invariantes*; el `compact()` nativo hace el recorte mecánico cuando el presupuesto es holgado y el resumen LLM cuando no lo es.
>
> **Impacto en el código**: `packages/runtime/src/ContextCompaction.ts` (motor), `packages/models/src/routerSummarizer.ts` (adaptador), `apps/desktop/src/main.ts:1951,1719` (instanciación y llamada), `docs/architecture/memoria-vantadb.md` §10.
>
> **Recomendación de A2**: opción **3** (híbrido), con la condición de que el `compact()` nativo se valide primero contra los tests de invariantes de `ContextCompaction` (system prompt + pares tool) antes de adoptarlo. Si el nativo no los preserva, se documenta como requisito upstream nuevo (`VDB-REQ-12`).

### 2.4 Diff E — A4: pasar el resumidor LLM al job de compactación

```diff
--- a/apps/desktop/src/main.ts
+++ b/apps/desktop/src/main.ts
@@ imports (@ego/models) @@
-import { ModelRouter, ModelMessage, … } from "@ego/models";
+import { ModelRouter, ModelMessage, createRouterSummarizer, … } from "@ego/models";

@@ bootstrap (junto a `new ContextCompactionJob(...)`) @@
   compactionJob = new ContextCompactionJob(
     { autoMemory: true },
     { archiveTarget: adapter }
   );
+  // Resumidor real sobre el ModelRouter: sin esto, la compactación usa el
+  // fallback heurístico (2 primeras líneas por mensaje) y pierde la alta
+  // fidelidad que exige el prompt de compactación (decisiones, rutas,
+  // errores, tareas, restricciones).
+  const compactionSummarizer = createRouterSummarizer(modelRouter, {
+    role: "fast-classifier",
+  });

@@ llamada (~línea 1719) @@
           const compacted = await compactionJob.compact(
             { messages: history, estimatedTokens, usageRatio },
             {
               isCompressionRebuild: true,
               sessionId,
+              summarizer: compactionSummarizer,
             }
           );
```

> `createRouterSummarizer` ya existe y está exportado por `@ego/models` (`packages/models/src/routerSummarizer.ts`), con `role` y `maxTokens` configurables. Firma compatible con `SummarizerFn` de `@ego/runtime`.

### 2.5 Entrada a actualizar en `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` (A1) — `VDB-REQ-10`

> **Estado**: **RESUELTO en la parte de Ego** (Ola 1b, A2). Sustituir el texto "pendiente upstream" por:
>
> **VDB-REQ-10 — poblado del sustrato de grafo (RESUELTO en Ego, 2026-10-20)**
> - **Contexto**: `graphragSearch(namespace, query, queryVector?)` (DIST-15) expande por aristas reales sobre el sustrato de grafo (`insertNode`/`addEdge`). Los ids de nodo son `u128` decimales y **coinciden con el `node_id` de los registros KV**, de modo que sembrar aristas entre registros convierte relaciones conocidas de Ego en relaciones recorribles.
> - **Lo que había**: Ego no llamaba a `insertNode`/`addEdge` (0 llamantes) ⇒ el grafo estaba vacío ⇒ la fase nativa de `GraphRagEngine` devolvía `edges: []` y la expansión caía a la heurística metadata+regex.
> - **Lo que se ha hecho (A2, Ola 1b)**: `EgoMemoryAdapter` expone `getGraphNodeId`, `insertGraphNode`, `addGraphEdge` y `linkGraphNodes` (delegaciones *capability-probed* al binding 0.8.0, que **sí** expone `insertNode`/`addEdge`/`getNode`); `ProjectMemoryGraph.recordEngineeringTrace` siembra la cadena causal real (traza → referencias por fichero, arista `derived_from`).
> - **Pendiente (upstream, menor)**: que `graphragSearch` acepte un **subgrafo por namespace** o una lista de namespaces (hoy `namespace` es único), para que la expansión cruz namespaces (`kb/docs` → `kb/facts` → `proj/traces`).
> - **Referencia en código**: `packages/memory/EgoMemoryAdapter.ts` (`getGraphNodeId`/`insertGraphNode`/`addGraphEdge`/`linkGraphNodes`), `packages/knowledge/src/ProjectMemoryGraph.ts` (`seedGraphEdges`).

## 3. Verificación

| Comando | Exit | Resumen |
|---|---|---|
| `pnpm --filter @ego/decision test` | 0 | 52 tests / 12 files (T1: 6 nuevos) |
| `pnpm --filter @ego/security test` | 0 | 103 tests / 8 files (T2: 6 nuevos) |
| `pnpm --filter @ego/execution test` | 0 | 59 tests / 10 files (T3: 6 nuevos) |
| `pnpm --filter @ego/knowledge test` | 0 | 86 tests / 22 files (T4: 2 nuevos) |
| `pnpm --filter @ego/memory test` | 0 | 153 tests / 24 files |
| `pnpm --filter @ego/runtime test` | 0 | 94 tests / 16 files |
| `pnpm --filter @ego/models test` | 0 | 93 tests / 10 files |
| `pnpm --filter @ego/events test` | 0 | 38 tests / 8 files |
| `pnpm --filter @ego/tool-call-repair test` | 0 | 11 tests / 1 file |
| **TOTAL (9 paquetes)** | **0** | **689 tests** (Ola 1: 669 · **+20**) |
| `pnpm --filter @ego/<cada uno> typecheck` (×9) | 0 | 9/9 sin errores |
| `pnpm -r typecheck` | 2 | **Fuera de mi zona**: `apps/desktop/renderer/floating/vendor/avatar/vendor/coucou/**` (A6, faltan tipos de `@tauri-apps/api`). Los 9 paquetes de A2 pasan. (El fallo de `Select.tsx`/`ChatMessageList.tsx` de la Ola 1 ya está cerrado por A4.) |
| `pnpm --filter @ego/tools test` | 0 | Zona de A3: **sin regresiones** por la unificación de NetPolicy |
| Escaneo de tipos (9 paquetes, `src/`) | — | `any` en producción = **3** (los 3 con comentario de justificación AGENTS.md §4) · `@ts-ignore` = **0** · `eslint-disable`/`oxlint-disable` = **0** |

**TDD**: cada corrección de comportamiento tiene test rojo demostrado antes del fix.
- T1: 4 fallos (plurales EN 0/1, plurales ES 0/1, confianza 0.76 < 0.9) → verde tras `pluralForms()`.
- T2: 4 fallos (módulo canónico inexistente → import error) → verde tras crear `ssrfPolicy.ts` + delegar.
- T3: import error (`../src/CircuitBreaker.js` no encontrado) → verde tras crear `CircuitBreaker.ts` + vetos pre-flight.
- T4: test nuevo `GraphSeeding.test.ts` en verde desde el inicio (la siembra se implementó junto al test; la verificación de que el grafo nativo **no** estaba poblado ya venía del rojo de T4 de la Ola 1: `graphRagSearch` devolvía `edges: []`).

## 4. Deuda / no resuelto

1. **La mitad de A3 de la NetPolicy sigue aplicada** (`packages/tools/src/native/security/NetPolicy.ts` conserva su propia implementación) ⇒ hasta que A3+A7 apliquen el Diff C hay **dos implementaciones con la misma semántica** en disco. No es una divergencia de comportamiento (mismos vectores, mismo orden), pero sí duplicación: **no la he cerrado yo porque el fichero es de A3** (§2.1).
2. **`@ego/security` arrastra el barrel completo** (`CredentialManager` → `node:crypto`) cuando `@ego/tools` lo importe. Verificado que el renderer no usa `@ego/tools` ⇒ no rompe el bundle; si A3 quiere evitarlo, sub-ruta `@ego/security/ssrf` (§2.1, alternativa).
3. **Ejecución paralela de tool calls** (`EGO-FIND-43`): sigue **sin implementar** desde la Ola 1. Motivo: Anthropic exige que cada `tool_result` siga **en orden** a su `tool_use`; un `Promise.allSettled` con push desordenado rompe la API. Recomendación: Ola 2, con el test de orden `tool_use`/`tool_result` como criterio de aceptación. Lo que sí quedó de T8 en Ola 1 (truncado por bytes, cuota en salidas no-string, cola cancelable) y ahora el circuit breaker + quota per Sub-Ego.
4. **`compact()` nativo vs `ContextCompaction` TS**: ADR pendiente (§2.3) — A1.
5. **`VDB-REQ-08` (RRF real / lista vectorial densa)**: sigue upstream. El fast path de VantaDB 0.8.0 **sí implementa** RRF (`SearchExplanationHit.rrf_text_rank`/`rrf_vector_rank`, `HybridFusionReport.rrf_k`), pero sólo se activa con un `query_vector` denso, que el binding napi-rs no produce (VDB-INC-01). Documentado en `packages/knowledge/src/HybridSearch.ts` (`TODO(EGO-FIND-41 / VDB-REQ-08)`).
6. **`VDB-REQ-09` (IQL no expuesto en el binding napi-rs 0.8.0)**: `EgoMemoryAdapter.graphQuery()` sigue devolviendo `{ ok: false }`; el descubrimiento de aristas usa `graphragSearch` + la heurística de respaldo. Documentado en el propio adaptador.

```
RESULTADO: {
  agente: A2-nucleo-ola1b,
  status: PARTIAL,
  archivos_modificados: [
    "packages/decision/src/IntentClassifier.ts",
    "packages/decision/test/IntentClassifier-plurals.test.ts",
    "packages/security/src/ssrfPolicy.ts", "packages/security/src/netPolicy.ts",
    "packages/security/src/ToolPermissions.ts", "packages/security/src/index.ts",
    "packages/security/test/NetPolicy-unified.test.ts",
    "packages/execution/src/CircuitBreaker.ts", "packages/execution/src/ExecutionManager.ts",
    "packages/execution/src/types.ts", "packages/execution/src/index.ts",
    "packages/execution/test/CircuitBreaker-quota.test.ts",
    "packages/memory/EgoMemoryAdapter.ts", "packages/memory/SessionLifecycleLocks.ts",
    "packages/knowledge/src/ProjectMemoryGraph.ts", "packages/knowledge/test/GraphSeeding.test.ts",
    "packages/events/src/types.ts",
    "packages/memory/test/version-tree.test.ts", "packages/runtime/test/ToolExecutionLoop-events.test.ts",
    "packages/runtime/test/tools-execution.test.ts", "packages/execution/test/ApprovalEngine.test.ts",
    "packages/events/test/EventIngress.test.ts",
    "docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A2-ola1b.md"
  ],
  hallazgos_resueltos: ["R4 (NetPolicy unificada, mitad A2)", "R5 (circuit breaker + quota por Sub-Ego)",
    "regresión de confianza DEC-09 (plurales en countWordHits)", "VDB-REQ-10 (poblado del sustrato de grafo)",
    "A2-22 (32 `any` residuales en aserciones de test)"],
  hallazgos_parciales: ["R4: la mitad de A3 (re-export en @ego/tools) queda pendiente por propiedad de fichero"],
  verify: { typecheck: "exit 0 en los 9 paquetes (exit 2 global sólo por apps/desktop/renderer/vendor/avatar, zona A6)",
    tests: "689 passed (669 → +20), 0 failed", tipos: "any en producción = 3 (los 3 con justificación AGENTS.md §4); @ts-ignore 0; lint-disable 0" },
  solicitudes_handoff: 6,
  deuda_abierta: [
    "R4: re-export de @ego/tools → @ego/security (A3) + pnpm install (A7)",
    "R4: sub-ruta @ego/security/ssrf si A3 quiere evitar el barrel",
    "DEC-09: restaurar el umbral 0.9 en tests/e2e/golden-path-alpha-full.test.ts (A7)",
    "ADR 0017: compact() nativo vs ContextCompaction TS (A1)",
    "main.ts: pasar el resumidor LLM al compaction job (A4)",
    "EGO-FIND-43: ejecución paralela de tool calls (Ola 2; riesgo de orden tool_use/tool_result en Anthropic)",
    "VDB-REQ-08 (RRF real) y VDB-REQ-09 (IQL) siguen upstream"
  ],
  SKILLS_CARGADAS: ["test-driven-development", "source-driven-development", "systematic-debugging", "code-review-and-quality", "documentation-and-adrs"]
}
```
