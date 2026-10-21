# Handoff A1 (Ola 6) — 2026-07-21 — Integridad del Backlog maestro y cierre del registro de VantaDB

> **Agente:** A1 (documentación canónica, ADRs, Backlog, informes)
> **Ola:** 6 — tarea corta de integridad: rutas rotas del Backlog · Backlog ↔
> catálogo de extracción · publicación del ADR-0023 y estado real del registro.
> **Plan:** `docs/agent-ops/plans/2026-10-19-remediation-wave1/A1-docs.md` (continuación)
> **Zona:** `docs/**` salvo `docs/{review,extractions}/**` (A5) y
> `docs/research/{arquitectura-master-matrix,verificacion-anthropic-tool-order}.md` (A8).
> **Sin commits. Sin `git checkout/reset/stash/clean`. Sin `pnpm install`.**
> **No he tocado `packages/**`, `apps/**`, raíz ni `scripts/**`.**

---

## 1. T1 — Las rutas rotas del Backlog (esto era lo que ponía el gate en rojo)

`node docs/testing/check-docs-paths.mjs` pasó de **exit 1 (5 rutas inexistentes)** a
**exit 0 (0)**.

El Backlog maestro citaba en su columna `Archivo:línea` ficheros que **A2bis retiró**
en la Ola 5 (11 módulos + 2 métodos). **Cada ruta se verificó antes de escribirla**:
no basta con que exista, tiene que ser *la correcta*.

### 1.1 El criterio, fila por fila (no al azar)

| Fichero retirado | Fila afectada | Qué se hizo y **por qué** |
|---|---|---|
| `packages/execution/src/SafeConfigMutation.ts` | `ACT-09` (evidencia) | El patrón de mutación segura **vive inline** en `packages/integrations/src/mcp/McpClient.ts:97,218,234-243` (compuerta COUC-10: recarga atómica con rollback transaccional) — verificado por mí. La celda dice que el módulo **se retiró** y que `ZeroContextKernel` **sigue vivo** (lo usa el sandbox SEC-08.C, `tests/security/injection-boundaries.test.ts:38`). |
| `packages/memory/UntrustedContentSanitizer.ts:22-58,109-112` | `EGO-FIND-60` | La `Archivo:línea` pasa a `packages/runtime/src/TrustBoundary.ts:1` (el canal dual + taint, que es lo que **resolvió** la fila) y el texto dice explícitamente que el **detector de inyección de prompt** no tiene replacement ⇒ hueco de capacidad escalado al owner. |
| `packages/execution/src/SafeConfigMutation.ts` | `docs/adr/0011-stab14-asimilados-descartes.md:39` | La línea del asimilado dice: *retirado el 2026-10-21 (A2-bis); el patrón vive inline en `McpClient.ts`*. |
| `packages/memory/UntrustedContentSanitizer.ts` + su test | `docs/adr/0019-canal-dual-taint-tracking.md` (5 sitios: `:14`, `:77`, `:82-86`, `:143-144`) | §Contexto, el título de §2, los tres bullets de neutralización y las **referencias** se marcan *(retirado)*, y las referencias apuntan al artefacto que **sí** cubre la parte resuelta: `packages/runtime/src/TrustBoundary.ts` (canal dual + taint), con la constatación de que el detector de prompt **no** tiene replacement. |

**Lo que NO se hizo a propósito:** poner una ruta que exista pero no tenga nada que ver
con la fila. Una `Archivo:línea` "viva" pero falsa es peor que una rota, porque
engaña al que la lee.

### 1.2 Un archivo más, por honestidad

La nota de la línea 48 del Backlog mencionaba `SafeConfigMutation` como patrón
asimilado. No era una ruta rota (el gate no la veía), pero era una afirmación que
ya no era cierta ⇒ se actualizó con el mismo criterio.

---

## 2. T2 — La inconsistencia Backlog ↔ catálogo de extracción

`node scripts/verify-backlog-gates.mjs` pasó de **exit 1 (40 discrepancias)** a
**exit 0**: **546 filas coherentes** (antes 506).

> **El número real era 40, no 4.** El brief citaba 4 ejemplos; el gate comparaba las
> 546 filas de compuertas contra `docs/review/backlog-*.md` (la fuente canónica) y
> encontró **33 filas** cuyo catálogo dice *descarte* y **7** cuyo catálogo dice
> *integrado*, todas con la celda del Backlog en `🆕 Pendiente`.

### 2.1 Las 33 filas alineadas a `🚫 Descartada (con justificación)`

Cada celda lleva **el puntero a la fila canónica** (repo + ID), para que el lector
pueda ir al catálogo y leer la justificación real en vez de fiarse de un emoji:

```text
🚫 Descartada (con justificación) — ver `../review/backlog-hermes.md` §Catálogo Detallado → `HERM-06`
```

### 2.2 Las 7 filas alineadas a `✅ Completada` (con el caller REAL)

Aquí la celda **no** puede llevar la ruta del upstream: el catálogo cita
`apps/desktop/electron/window-state.ts` o `NotchBuddy/Sources/App/…`, que **no existen
en Ego** (son el fichero del clon de referencia). La evidencia correcta es el
**caller de producción**, y **verifiqué que cada uno existe**:

| Fila | Caller de producción verificado |
|---|---|
| `HERM-08` | `apps/desktop/src/windows/WindowStateManager.ts:5` importa `WindowStateHelper` de `@ego/ui-runtime` (uso en `:305` y `:337`) |
| `COUC-08` | `packages/ui-runtime/src/PayloadRef.ts:137` (el `PayloadRegistry`), importado en `apps/desktop/src/main/mcp/mcp-server-runtime.ts:29` → `packages/integrations/src/mcp/McpServer.ts:79,259,292` |
| `OCLW-07` | `packages/tools/src/native/git/NativeGitTool.ts:8` importa `SessionDiffRevisions`; la tool se registra por `packages/tools/src/native/index.ts:39`; test en `packages/tools/test/SessionDiffRevisions.test.ts` |
| `OCLW-11` | `packages/ui-runtime/src/MermaidComponent.ts:2` + registro en el Canvas del renderer `apps/desktop/renderer/components/canvas/registry.ts:79-84` |
| `COUC-09` | `apps/desktop/src/main/state/app-context.ts:40` + `apps/desktop/src/main/window/create-window.ts:114,312` (el `RunRecorder` se crea en el arranque del main) |
| `HERM-15` | `packages/recovery/src/CrashRecoveryEngine.ts:5` importa `StorageHealthLatch`; el engine está instanciado en `app-context.ts` y en `main.ts` |

### 2.3 Las 2 celdas con texto descriptivo (reescritas, no sólo el emoji)

`COUC-10` y `DSEK-05` tenían texto que mencionaba ficheros ya retirados. Reescritas:

- **`COUC-10`**: *«🚫 Descartada — el módulo `SafeConfigMutation` **se retiró el 2026-10-21**
  (código muerto: sin caller de producción) y el patrón de mutación segura vive
  **inline** en `packages/integrations/src/mcp/McpClient.ts:218,234-243` (recarga
  atómica con rollback transaccional). Ver `../review/backlog-coucou.md` §Catálogo
  Detallado → `COUC-10`»*.
- **`DSEK-05`**: *«🚫 Descartada (con justificación) — ver
  `../review/backlog-deepseek-harness.md` §Catálogo Detallado → `DSEK-05`»*.

### 2.4 La regla que dejó esta sección

Queda escrita en el VERDICT §7 (regla 5): *una fila de compuerta del Backlog **no se
corrige cambiando el emoji**: el catálogo canónico es la fuente de verdad del estado, y
la celda debe **apuntar a la fila canónica** o al **caller real**.*

---

## 3. T3 — Lo que A2bis dejó para mí

### 3.1 ADR-0023: leído, **verificado** y publicado

`docs/adr/0023-path-cognitivo-nativo.md` (escrito por A2-bis) — **verifiqué sus
afirmaciones medibles antes de publicarlo**:

| Afirmación | Verificación |
|---|---|
| `db.inner` es alcanzable en runtime y es un `VantaDb` | ✅ `vantadb@0.9.0/dist/native.js:123` → `inner;` es un **campo público** de la clase (el `private` sólo existe en el `.d.ts`) |
| Las 5 APIs cognitivas están en el binding | ✅ `vantadb-node@0.9.0/index.d.ts:603 graphragSearch` · `:614 memoryRecall` · `:622 contextAssemble` · `:629 memoryConsolidate` · `:636 memoryReinforce` |
| La resolución de `vantadb` es uniforme | ✅ `packages/memory`, `apps/desktop` y `tests` resuelven **los tres** `vantadb@0.9.0` |
| El puente está encapsulado | ✅ `packages/memory/CognitivePath.ts:70` → `resolveCognitiveBinding(handle)`, con *capability probe* y degradación a `null` |
| Las 5 APIs están cableadas en Ego | ✅ `EgoMemoryAdapter.ts:1147` · `:1169` · `:1219` · `:1251` · `:1282` |
| La pre-reserva son 320 MB de **disco**, no de RAM | ✅ 320,03–320,06 MB (medido por mí en la Ola 4) |

**Correcciones que le hice al publicarlo:**

1. El *Decisor* decía *«pendiente de ratificación por A1»* → ahora *«verificado y
   publicado por A1 (Ola 6)»*.
2. **Una corrupción de texto**: *«deja de poderYLEGAR»* → *«deja de poder **llegar**»*.
3. **Una línea citada que no apuntaba**: `EgoMemoryAdapter.ts:308` → la real es
   **`:303`** (el único punto de apertura de store, `NativeVantaDB.connect`).

**Publicado en**: `docs/adr/README.md` (fila del `0023` + el índice por estado, que
ahora incluye `0023`) y con la nota de numeración corregida: el `0022` lo ocupa E4
(yo, Ola 4), el contrato de la Ola 3 lo había reservado para A2 ⇒ **A2 usa el `0023`**
(que es donde quedó su ADR) y el `0024` es de A3.

### 3.2 El hallazgo que debía quedar constatado

> ***La vía (iii) HybridRuntime funciona porque `db.inner` es alcanzable en runtime y es
> un `VantaDb` ⇒ no hace falta un fix upstream para el path cognitivo.***

Consta en **tres** sitios, que es donde alguien lo buscará:
1. El **ADR-0023** (decisión 2 y alternativa (iii)).
2. El **ADR-0020** §2.1 (la segunda condición de alcance: *«ya no hace falta un fix
   upstream»*).
3. El **registro de VantaDB** (`VDB-REQ-16`) y el **Backlog** (`EGO-FIND-29` → 🟡 con
   el estado real: invariante verde + puente funcionando + falta el *call site*).

### 3.3 El registro de VantaDB, con los 4 estados que cambiaron

| ID | Antes | Ahora | Evidencia |
|---|---|---|---|
| `VDB-REQ-02` | RESUELTO, *«el workaround puede retirarse»* | ✅ **RESUELTO y retirado** | El workaround ya no está en el código (A2-bis). Medido: `search` con `text_query` funciona **sin** `query_vector`. **Matiz**: el guard de `VDB-BUG-05` **se conserva** (`text_query: ""` **con** `query_vector: []` **lanza**). |
| `VDB-REQ-15` | 🟡 PARCIAL, *«sin cablear»* | ✅ **CABLEADO** | `EgoMemoryAdapter.memoryRecall` + `packages/memory/CognitivePath.ts` + `TrustBoundary.trustedAllowPrefixes`/`selectTrustedForInjection`; verificado contra el motor real (`packages/memory/test/memory-recall-trust.test.ts`, 5 tests). |
| `VDB-REQ-16` | 🟡 PARCIAL, *«sin el enlace materializado»* | 🟡 **PARCIAL** — (b) **RESUELTA** + (a) pendiente | (b) **resuelta por A7**: la **raíz** declara `"vantadb": "0.9.0"` y `"vantadb-node": "0.9.0"` (`package.json:70-71`) ⇒ **resolución ascendente** a los 20 miembros, y **puerta bloqueante en CI**: `scripts/verify-vantadb-resolution.mjs` (`vantadb:check`, también en `verify:all`). (a) sigue pendiente *upstream*, mitigado por el puente HybridRuntime. Petición upstream ampliada: que `vantadb` declare `vantadb-node` **no opcional** y su **versión mínima de Node**. |
| `VDB-REQ-14` | PERSISTE, sin cuantificar | ❌ **PERSISTE, cuantificada** | 1 store en producción = **320,03 MB de disco** y **≈ 0,45 MB de RAM** (Δ RSS medido: 0,39/0,50/0,53 MB). **La pre-reserva es de disco, no de RAM**; el pico de ~19 GB es un artefacto de la **suite de tests**, no del producto. |

**El registro queda en 26 hallazgos: 8 resueltos · 4 parciales · 4 persisten · 10 sin
verificar**, y el gate `verify-vantadb-ids.mjs` sigue en **exit 0 con 0 errores**
(comprueba las 84 referencias del código: **ninguna apunta a un fichero retirado** —
lo verifiqué con un barrido de los 11 módulos retirados sobre todo el registro).

### 3.4 El Backlog, con el trabajo verificado de A4 y A7

Además de las filas de la §2, A4 y A7 deliveraron trabajo **verificado** que no estaba
registrado. **Comprobé cada afirmación antes de escribirla**:

| Fila | Estado | Evidencia verificada por A1 |
|---|---|---|
| `EGO-FIND-86` (lista blanca por ID posicional) | 🆕 → ✅ | La lista blanca **dejó de indexarse por ID**: ahora declara **huellas de contenido** (`fingerprints: [{ hash: '…', match: '#…' }]`, `design-lint.cjs:413-432`) ⇒ un hex nuevo **no desplaza** los IDs. 6 entradas · 79 huellas · 3 casos verificables. |
| `EGO-FIND-88` (E5 identidad) | 🟡 → ✅ | `resolveTurnSoul` → `resolveSubEgoIdentity` en `apps/desktop/src/main/subegos/identity.ts:1` (95 líneas) · 5 tests. |
| `EGO-FIND-89` (E5 presupuesto) | 🟡 → 🟡 | `budget-guard.ts` + `handle-llm-stream.ts` · 8 tests. **El tope de coste** sigue esperando los 2 métodos del router de A2. |
| `EGO-FIND-90` (E13 metatools) | 🟡 → ✅ | `registerProgressiveMetaTools` en `create-window.ts` · 6 tests. |
| `EGO-FIND-93` (auditoría desacoplada) | ✅ → ✅ | Ahora mide **color** y abre el **canvas de avatares** (paso `04b-avatares-canvas`): **7/7 pasos, 0 infracciones**. Encontró un defecto real (6 `TARGET`, dos botones a 18 px). |
| `EGO-FIND-94` (resolución de `vantadb`) | 🆕 → 🟡 | (b) resuelta por A7 (raíz + puerta `vantadb:check`); (a) pendiente *upstream*, mitigada por el puente. |
| `EGO-FIND-95` (nuevo god file) | 🆕 → ✅ | `register-ipc.ts`: **2 571 → 85 líneas** (raíz de composición) + **22 módulos de dominio** bajo `apps/desktop/src/main/ipc/domains/` (el mayor: `settings.ts`, 379 líneas). Criterio de A4: **un módulo por dominio de canal**. Gate: `apps/desktop/test/ipc-modules-gate.test.ts` (6 checks, incluido *«el número de canales sigue siendo 81»*). |

**Backlog tras la Ola 6: 85 ✅ · 5 🟡 · 5 🆕** (95 filas `EGO-FIND`).

### 3.5 El design system, con lo que A4 hizo obligatorio

`docs/design/design-system.md`:
- **R12** (nueva): CSS crudo fuera del design system (`!important` + `rgb()/hsl()`
  literales), con la excepción de los ficheros de tokens. La deuda heredada del CSS del
  flotante está **nombrada** (`EGO-DL-024`, `DEBT_CSS_RAW`, 40 grandfathered).
- **R7 ahora cubre las tablas `cva({…})`** (antes sólo el JSX literal).
- **La lista blanca cambió de CONTRATO**: se indexa por **hash del contenido**, no por
  ID posicional — con el porqué escrito: *«un mecanismo de excepción que se
  autodesactiva es peor que no tenerlo, porque da falsa confianza»*.
- **§10.1 reescrito**: el arnés es ahora **dos caminos con un solo spec**
  (`design-audit-spec.mjs` compartido · `ego-browser-audit.mjs` de referencia ·
  `design-audit-headless.mjs` de rescate · `run-design-audit.ps1` que cae al rescate).

### 3.6 El VERDICT

`VERDICT.md` §7: la fila de **E2 pasa de «⛔ BLOQUEADA por alcance» a «🟡 DESBLOQUEADA
por alcance»** (con el puente de la vía (iii)), y se añade **§7.5** con el estado real
de las olas 5 y 6 (5 trabajos de A2-bis + 3 de esta ola), más la regla 5 sobre cómo se
corrige una fila de compuerta.

---

## 4. Solicitudes fuera de zona (NO aplicadas) — con diff exacto

### 4.1 A2 (`packages/models`) — los 2 métodos del router (desbloquean `EGO-FIND-89`)

Es lo único que le queda a `EGO-FIND-89` (E5 presupuesto). El diff exacto está en el
handoff de A4 §7.1; el contrato que consume su lado es:

```ts
// packages/models/src/ModelRouter.ts (o el fichero que corresponda)
+ /**
+  * Tope de coste por llamada **global** del router, para que el circuit breaker
+  * de presupuesto de Sub-Ego pueda calcular el mínimo efectivo.
+  */
+ getMaxCostPerCallUsd(): number | undefined;
+
+ /**
+  * Modelo más barato disponible que satisfaga el tope indicado.
+  * Devuelve `undefined` si no hay ninguno: el circuito **detiene** (fail-closed),
+  * nunca degrada a un `mock`.
+  */
+ resolveCheaperModel(maxCostPerCallUsd: number): string | undefined;
```ts

### 4.2 A4 (`apps/desktop/**`) — el cast del router y el `BudgetRouter` sin uso

```diff
  // apps/desktop/src/main.ts:613 y :636
-    // El `as` es deliberado: el `ModelRouter` actual todavía NO expone
-    // `getMaxCostPerCallUsd()` / `resolveCheaperModel()` (son de A2). El
-    // contrato los declara opcionales, así que el router de hoy simplemente
-    // NO los tiene y el circuito funciona con el presupuesto del Sub-Ego.
-    // Cuando A2 los añada, el cast desaparece solo (el router structurally
-    // satisface la interfaz y el tope efectivo pasa a ser el MÍNIMO).
-    router: modelRouter as unknown as BudgetRouter,
+    // El `ModelRouter` satisface estructuralmente `BudgetAwareRouterLike`
+    // (`getMaxCostPerCallUsd` / `resolveCheaperModel`, añadidos en A2-bis):
+    // el tope efectivo pasa a ser el MÍNIMO(Sub-Ego, router) y la
+    // degradación a un modelo más barato deja de ser teórica.
+    router: modelRouter,
```diff

Y el import de `BudgetRouter` en `main.ts:31` queda sin uso → **A4 lo borra**.

### 4.3 Owner / A1 — el clon confinado por Sub-Ego (diff 3 de A3)

En el desktop **no existe** `cloneRegistryForProfile` y hay **un** registro de
producción. Es una **decisión de producto** (¿un registro global o uno por perfil?),
no un bug: la respuesta cambia quéSub-Ego ve qué tools. **No la he tomado yo.**

### 4.4 Owner — `VDB-REQ-08` (cifrado at-rest) y `EGO-FIND-81` (canal del token MCP)

Sin cambio: siguen bloqueados por el owner.

---

## 5. Verificación

| Comando | Exit | Resumen |
|---|---|---|
| `node docs/testing/check-docs-paths.mjs` | **0** | 389 docs · **0 enlaces rotos** · **0 rutas inexistentes** en docs canónicos (antes: 5 rutas inexistentes) |
| `node scripts/verify-backlog-gates.mjs` | **0** | **546 filas de compuerta coherentes** con el catálogo canónico (antes 506 · 40 discrepancias) |
| `node scripts/verify-vantadb-ids.mjs` | **0** | **0 errores** · 2 avisos (W2 ×2, peticiones upstream) · 26 IDs · 84 referencias · **ninguna apunta a un fichero retirado** |
| `node scripts/check-docs-lint.mjs` | **0** | **0 regresiones** · 7 118 violaciones en 338 ficheros (base 7 119) |
| `pnpm docs:build` | **0** | `build complete in 18.82s` (el árbol volvió a estar sano: A7 rehizo la instalación y `vitepress` está de vuelta) |
| Barrido de módulos retirados | — | Los **11** módulos retirados por A2bis + los 2 métodos, barridos sobre todo el registro y los ADRs: **0 citas** a ficheros inexistentes |
| Estado del Backlog | — | **85 ✅ · 5 🟡 · 5 🆕** (95 filas `EGO-FIND`) |
| Estado del registro de VantaDB | — | **26 hallazgos** — 8 resueltos · 4 parciales · 4 persisten · 10 sin verificar |

---

## 6. Deuda / no resuelto

1. **El tope de coste por llamada de E5** depende de los 2 métodos del router de A2
   (§4.1) ⇒ `EGO-FIND-89` queda 🟡 por eso y no por otra cosa. Bloqueo: **A2**.
2. **El cast del router** en `main.ts` sigue ahí hasta que A2 exponga los métodos
   (§4.2). Bloqueo: **A2** primero, **A4** después.
3. **El clon confinado por Sub-Ego** (diff 3 de A3) no tiene ancla en el desktop: es
   una **decisión de producto** (registro global vs. por perfil). Bloqueo: **owner**.
4. **`VDB-REQ-16` (a)**: el wrapper `vantadb@0.9.0` no re-expone las APIs cognitivas
   ⇒ petición **upstream**. Mitigada en Ego por el puente HybridRuntime, que es
   **fail-soft** y degradable a `null`.
5. **El detector de inyección de prompt** (el módulo `UntrustedContentSanitizer`
   retirado) **no tiene replacement**: el `TrustBoundary` cubre el canal dual y el
   taint, pero no la detección de vectores. Hueco de capacidad escalado al owner
   (consta en `EGO-FIND-60` y en el ADR-0019).
6. **`VDB-REQ-14`**: 320,03 MB de disco por store, no parametrizable upstream.
7. **`EGO-FIND-81`** (canal del token MCP) y **`VDB-REQ-08`** (cifrado at-rest): siguen
   bloqueados por el **owner**.
8. **La suite GUI**: los **11 `describe.skip`** siguen sin reactivarse (sin handoff de
   A2 desde la Ola 2).

---

## 7. Nota de estado del árbol

Working tree sucio y compartido con A2–A8 — **esperado por contrato** (README §5.5).
**No he hecho ningún commit, ni `git checkout/reset/stash/clean`, ni `pnpm install`.**
No he tocado `packages/**`, `apps/**`, raíz ni `scripts/**`.

> **Ficheros de otros agentes que `git status` puede mostrar y no son míos:**
> `docs/review/**` · `docs/extractions/**` (A5) · `docs/research/**` (A8) ·
> `packages/**` (A2, A3, A6) · `apps/desktop/**` (A4) · raíz y `scripts/**` (A7).
