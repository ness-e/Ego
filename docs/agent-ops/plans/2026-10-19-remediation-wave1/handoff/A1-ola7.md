# Handoff A1 (Ola 7) — 2026-07-21 — Cierre de 3 filas obsoletas del Backlog

> **Agente:** A1 (documentación canónica, ADRs, Backlog, informes)
> **Ola:** 7 — tarea surgical: 3 filas cuyo trabajo ya estaba hecho y que seguían
> marcadas como pendientes.
> **Plan:** `docs/agent-ops/plans/2026-10-19-remediation-wave1/A1-docs.md` (continuación)
> **Zona:** `docs/**` salvo `docs/{review,extractions}/**` (A5) y
> `docs/research/{arquitectura-master-matrix,verificacion-anthropic-tool-order}.md` (A8).
> **Sin commits. Sin `git checkout/reset/stash/clean`. Sin `pnpm install`.**
> **No he tocado `packages/**`, `apps/**`, raíz ni `scripts/**`.**

---

## 1. Las 3 filas cerradas (T1) — con la evidencia verificada por mí

Cada número de línea de esta sección lo comprobé **yo**, sobre el árbol, antes de
escribirlo. No copié el enunciado de nadie.

### 1.1 `EGO-FIND-49` → ✅ Completada — el veto a las tools nativas es absoluto

**Lo que la fila decía:** `McpManager.connectServer` sobrescribía tools nativas con
`overrideExisting: true` — un servidor MCP podía apropiarse de `fs_read_file` o
`terminal_exec` y el agente ejecutaría el código del servidor creyendo que es la
tool de Ego.

**Lo que verifiqué:**

| Hecho | Dónde |
|---|---|
| El docstring dice que una tool con `origin === "native"` **NUNCA** puede ser sobrescrita, *«ni siquiera con `overrideExisting: true`»* | `packages/integrations/src/mcp/McpClient.ts:301` |
| El flag se lee **explícitamente** | `McpClient.ts:329` — `const allowOverride = options.overrideExisting === true;` |
| El **veto se aplica antes de mirar el flag** y se registra como `skipped_native_protected` | `McpClient.ts:341` — `if (existing.origin === "native") { … }` (`:342-352`) |
| La auditoría **ya no es un `console.warn`**: se emite al **EventBus** con `code: "MCP_NATIVE_TOOL_PROTECTED"` y `severity: "error"` | `packages/integrations/src/mcp/McpManager.ts:297` (código) · `:301-302` (severidad) · `:305-310` (emisión) · `:49` (el docstring que lo describe) |
| Tests: fixture de protección, test del `McpManager` y **test de auditoría de override** | `packages/integrations/test/mcp-native-tool-protection.test.ts` (8 referencias) · `packages/integrations/test/McpManager.test.ts` (3) · `apps/desktop/test/mcp-override-audit.test.ts` (4) |

> **Matiz que dejé escrito en la celda (no lo borré):** el `console.warn` de
> `McpClient.ts:381` **sigue existiendo** para el override *consentido* de una tool
> **de servidor**. Lo que cambió es que la **protección de la tool nativa** ya no se
> audita por consola sino por el bus, con severidad `error`. Digo «la auditoría ya
> no es un `console.warn`» **precisamente** de la native-protection, que es lo que
> la fila pedía. Los otros dos `console.warn` de `McpClient` (`:574`, `:619`) y los de
> `McpManager` (`:190`, `:325`) no tienen relación con el override.

**También:** la protección es **fail-closed** — sin bus, la tool nativa **sigue sin
poder ser sobrescrita**; lo que se pierde es la traza, no el veto.

### 1.2 `EGO-FIND-29` → ✅ Completada — el path cognitivo está cableado

**Lo que la fila decía:** el Cognitive Path no existía; `assembleContext/recall/
consolidate/reinforce/checkpoint` no estaban implementados.

**Lo que verifiqué (callsites reales, no menciones en comentarios):**

| API | Callsite en `packages/memory/EgoMemoryAdapter.ts` |
|---|---|
| `graphRagSearch` | `:1147`, `:1160` |
| `memoryRecall` (con `trust_aware`) | `:1188`, `:1193`, `:1208`, `:1212` |
| `contextAssemble` | `:1228`, `:1235`, `:1240`, `:1244` |
| `memoryConsolidate` | `:1257`, `:1267`, `:1272`, `:1275` |
| `memoryReinforce` | `:1287`, `:1292`, `:1297`, `:1300` |

Más el **puente de alcance HybridRuntime** (`packages/memory/CognitivePath.ts:70`,
`resolveCognitiveBinding`), que llega al binding por la fachada que ya lo tiene
abierto: `CognitivePath.ts:82-84` toma `handle.inner` y comprueba que trae las
APIs. `inner` es un campo **público** en el JS compilado de la fachada
(`vantadb@0.9.0/dist/native.js:123` → `inner;`), aunque el `.d.ts` lo declare
`private` ⇒ **no hace falta un fix upstream** para el camino cognitivo. Y
`VDB-REQ-13` (las invariantes) está **RESUELTO** y verificado empíricamente.
Decisión y medición de las 3 vías: `docs/adr/0023-path-cognitivo-nativo.md`.

**Lo que dejé explícito en la celda (no se borra, es información para el owner):**

- La petición **upstream** `VDB-REQ-16` (a): que el wrapper `vantadb@0.9.0`
  re-exponga las APIs cognitivas y declare `vantadb-node` como dependencia **no
  opcional**. **No bloquea** (la parte de Ego está cerrada), pero es el
  **destino** del puente.
- La **decisión de activar** el nativo como motor canónico de compactación: sigue
  siéndolo el TS (`ContextCompaction`); su ADR-0020 exige un ADR **nuevo**, no
  editar el aceptado.

### 1.3 `EGO-FIND-89` → ✅ Completada — el circuito, de extremo a extremo

**Lo que la fila decía:** el presupuesto de Sub-Ego no tenía límite de tiempo ni
degradación de modelo, y el tope de coste por llamada no estaba conectado al
`ModelRouter`.

**Lo que verifiqué:**

| Hecho | Dónde |
|---|---|
| `getMaxCostPerCallUsd()` existe y devuelve `number \| undefined` | `packages/models/src/ModelRouter.ts:593` |
| `resolveCheaperModel()` existe | `packages/models/src/ModelRouter.ts:628` |
| **Guard de contrato en tiempo de compilación**: si el router deja de satisfacer `BudgetAwareRouterLike`, el `typecheck` falla | `packages/models/src/BudgetRouterContract.ts:54` (interfaz `BudgetRouterContractRequired`) · `:63` (`AssertTrue`) · `:74` (`ModelRouter extends BudgetRouterContractRequired ? true : false`) |
| **Los dos casts fuera**: `router: modelRouter` sin cast | `apps/desktop/src/main.ts:611` y `:678` · **0** ocurrencias de `as unknown as BudgetRouter` en el árbol |
| El circuito de presupuesto consume la API real y **lleva `costUsd`** | `apps/desktop/src/main/subegos/budget-guard.ts:113` (`estimate?: { tokens?, costUsd? }`) · `:212` (`usage: { tokens, costUsd?, … }`) · `:220` (`costUsd: request.usage.costUsd ?? 0`) |

**Los dos bugs reales que la ola encontró y corrigió** (los dejé escritos, porque
son la prueba de que el circuito no era teórico):

1. La **«trampa del tope 0»**: `getMaxCostPerCallUsd()` devolvía `0` en vez de
   `undefined` ⇒ con el MÍNIMO(Sub-Ego, 0) = 0, **se detenían todos los turnos**.
2. El **estimate del turno nunca llevaba `costUsd`** ⇒ la rama de coste del
   breaker **no se ejecutaba nunca** (el breaker de coste era decorativo).

Con el router **real** (no un mock), el circuito degrada al más barato real,
**detiene con error tipado** cuando no hay alternativa (nunca degrada a un
`mock`), con tope efectivo = **MÍNIMO**, y la degradación es **visible**
(`system.alert` al bus → `NotifyCenter` + `StructuredLogger`).

### 1.4 `EGO-FIND-63` — revisada, **NO** se cierra (T3)

**Medido** con el instrumento canónico
(`node scripts/inventory-tautological-tests.mjs`):

```text
[inventory-tautological] 6 fichero(s) con asserts sobre texto de fuente
[inventory-tautological] asserts por zona: {"A4":11,"A7":3}
  apps/desktop/renderer/test/ShikiOffload.test.tsx            [A4]  (4)
  apps/desktop/test/compaction-summarizer-wiring.test.ts      [A4]  (3)
  tests/e2e/contract/floating-wiring.contract.test.ts          [A7]  (3)
  apps/desktop/renderer/test/DomainCanvasRegistry.test.tsx    [A4]  (2)
  apps/desktop/renderer/test/floating-avatar-vendor.test.ts   [A4]  (1)
  apps/desktop/test/e6-runtime-state.test.ts                   [A4]  (1)
```

⇒ **6 ficheros / 14 asserts** (A4 → 11, A7 → 3). La fila **ya lo decía** (la
corregí en el turno anterior con esta misma medición), así que **no la toco**:
sigue 🟡 y su texto es el estado real. Lo que **no** hago es cerrarla: quedan
14 asserts por convertir en aserciones de comportamiento.

> Nota: de los 3 ficheros que la fila nombraba antes (`ipc-bridges-t13.test.ts`,
> `ShikiOffload.test.tsx`, `tasks-wiring.test.ts`), **sólo queda 1**
> (`ShikiOffload.test.tsx`): A4 convirtió los otros 2. Y los que quedan **no son
> los que decía**: el inventario real es de 6 ficheros.

---

## 2. Recuento final por estado (medido, no estimado)

> **El número de filas ha crecido durante la ola**, porque A5 abrió 8 hallazgos
> de revisión visual (`EGO-FIND-96..103`) y luego 1 más. El encargo decía
> «95 filas»; el estado real al cierre de este turno es otro, y lo doy real.

| Estado | Filas `EGO-FIND` | % |
|---|---:|---:|
| ✅ Completada | **89** | 85,6 % |
| 🟡 Parcial | **3** | 2,9 % |
| 🆕 Pendiente | **12** | 11,5 % |
| **Total** | **104** | 100 % |

**Evolución:** 81 ✅ (Ola 6) → 89 ✅ (esta ola). Las 3 que cerré =
`EGO-FIND-49` + `EGO-FIND-29` + `EGO-FIND-89` ⇒ **+3 en `✅`, −3 abiertas**.

---

## 3. Lista exacta de las que quedan abiertas, con su motivo en una línea

### 3.1 Las 3 🟡 Parcial

| Id | Motivo (una línea) |
|---|---|
| `EGO-FIND-22` | `DelegationRouter` **ya** se instancia en producción (`packages/subegos/src/DelegationRuntime.ts:14`); `DreamConsolidator` y `MemoryCurator` aparecen **sólo en sus propios tests** ⇒ instanciarlos o retirarlos (decisión de producto) |
| `EGO-FIND-63` | Quedan **6 ficheros / 14 asserts** sobre texto de fuente (A4 → 11, A7 → 3); convertirlos en aserciones de comportamiento o aislarlos como lint-tests |
| `EGO-FIND-94` | **(b) RESUELTA** (A7: raíz + resolución ascendente + puerta `vantadb:check` bloqueante en CI); **(a) es upstream**: el wrapper `vantadb@0.9.0` no re-expone las APIs cognitivas ⇒ `VDB-REQ-16` a, mitigada en Ego por el puente HybridRuntime |

### 3.2 Las 12 🆕 Pendiente

| Id | Motivo (una línea) |
|---|---|
| `EGO-FIND-81` | El **canal de obtención del token MCP** para clientes externos no está decidido ⇒ **decisión del owner** (env `EGO_MCP_TOKEN` vs. fichero `0600` + descubrimiento del puerto efímero) |
| `EGO-FIND-82` | La cabecera canónica de atribución de licencia no está desplegada en **0 de 313** ficheros de `packages/` |
| `EGO-FIND-83` | `khoj` es **AGPL-3.0** y el catálogo de extracción lo presenta como origen de 4 compuertas ✅ asimiladas ⇒ corregir la clasificación |
| `EGO-FIND-87` | `VDB-REQ-14` (**upstream**): 320,03 MB de pre-reserva por store, no parametrizable |
| `EGO-FIND-96` | El CTA «Enviar» **deshabilitado es visualmente idéntico** al habilitado (`bg-brand` a opacidad plena) |
| `EGO-FIND-97` | **3 selectores de modelo y 3 superficies de Sub-Ego visibles a la vez** en la vista Chat |
| `EGO-FIND-98` | *Empty states* desalineados: Workbench «Navegador» y «Temas» dejan ~70 % de superficie vacía sin guía |
| `EGO-FIND-99` | Los **presets de paleta canónicos no son visibles ni intercambiables** en la UI |
| `EGO-FIND-100` | El **idioma del CTA primario no es estable**: coexisten ámbar sólido y blanco-outline como acciones primarias |
| `EGO-FIND-101` | Anillo de foco ámbar **doble y denso** en el Selector de Modelos sobre dark |
| `EGO-FIND-102` | El shell del panel anima `width`: la **única transición no-composited** de la app (reflow por frame) |
| `EGO-FIND-103` | La **escala de motion no está canonizada**: duraciones/easings en producción son defaults de Tailwind, no tokens |

### 3.3 Decisiones de producto que esperan al owner (7, sin cambio)

Las 7 del §7.6.2 del VERDICT siguen vigentes: (1) `OpaqueId`+`SessionCheckpointPolicy`
¿retirar o cablear? · (2) `ZeroContextKernel` ¿se cablea en producción? · (3) el
hueco del **detector de inyección de prompt** tras retirar el sanitizer ·
(4) el **clon confinado por Sub-Ego** · (5) el **canal del token MCP** ·
(6) los **certificados de firma** (`DIST-04`) · (7) el **cifrado at-rest**
(`VDB-REQ-08`).

### 3.4 Peticiones upstream que quedan (no son trabajo de Ego)

`VDB-REQ-14` (dimensionar la pre-reserva) y `VDB-REQ-16` (a) (que el wrapper
re-exponga las APIs y declare `vantadb-node` no opcional). Detalle en el VERDICT
§7.6.3.

---

## 4. Verificación

| Comando | Exit | Resumen |
|---|---|---|
| `node docs/testing/check-docs-paths.mjs` | **0** | 394 docs · **0 enlaces rotos** · **0 rutas inexistentes** en docs canónicos |
| `node scripts/verify-backlog-gates.mjs` | **0** | La matriz de compuertas coincide con el catálogo canónico |
| `node scripts/verify-vantadb-ids.mjs` | **0** | **0 errores** · 2 avisos (W2 ×2, peticiones upstream) |
| `node scripts/check-docs-lint.mjs` | **0** | **0 regresiones** · 7 147 violaciones en 342 ficheros (base 7 148 → **−1**) |
| Recuento del Backlog | — | **89 ✅ · 3 🟡 · 12 🆕** (104 filas `EGO-FIND`) |

> **Un extra que no era mío:** el `MD013` que quedaba en el Backlog venía del
> párrafo «Origen» (753 caracteres) de la **sección de revisión visual que
> añadió otro agente**. Lo **envuelvo** —sólo saltos de línea, **ni una palabra
> cambia**— porque el Backlog es mi zona y el gate debe estar en verde.

---

## 5. Deuda / no resuelto

1. **`EGO-FIND-22`**: `DreamConsolidator` y `MemoryCurator` siguen sin instanciar
   (sólo en sus tests). Decisión de producto: instanciarlos o retirarlos.
2. **`EGO-FIND-63`**: 14 asserts sobre texto de fuente (6 ficheros).
3. **`EGO-FIND-94` (a)**: upstream — el wrapper no re-expone las APIs cognitivas.
   Mitigada en Ego, no resuelta.
4. **`EGO-FIND-87`**: upstream — `VDB-REQ-14`, los 320 MB por store.
5. **`EGO-FIND-81`**: el canal del token MCP, decisión del owner.
6. **`EGO-FIND-82` / `-83`**: cabecera de atribución sin desplegar, y la
   clasificación AGPL de `khoj` (A5).
7. **`EGO-FIND-96..103`**: 8 hallazgos de la revisión visual, de UX (8 abiertos).
8. Las **7 decisiones de producto** esperando al owner (§3.3).
9. **El recuento del Backlog sigue moviéndose** (95 → 104 en dos olas): el
   número de la §2 es el medido al cierre de este turno.

---

## 6. Nota de estado del árbol

Working tree sucio y compartido con A2–A8 — **esperado por contrato** (README §5.5).
**No he hecho ningún commit, ni `git checkout/reset/stash/clean`, ni `pnpm install`.**
No he tocado `packages/**`, `apps/**`, raíz ni `scripts/**`.

> **Ficheros de otros agentes que `git status` puede mostrar y no son míos:**
> `docs/review/**` · `docs/extractions/**` (A5) · `docs/research/**` (A8) ·
> `packages/**` (A2, A3, A6) · `apps/desktop/**` (A4) · raíz y `scripts/**` (A7).
