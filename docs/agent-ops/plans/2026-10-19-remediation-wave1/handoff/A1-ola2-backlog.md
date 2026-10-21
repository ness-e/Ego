# Handoff A1 (Ola 2, cierre) — 2026-07-20 — Backlog, VERDICT, informe de cierre y changelogs

> **Agente:** A1 (documentación canónica, ADRs, Backlog, informes)
> **Ola:** 2 — cierre documental. Encadena el turno anterior (ADRs D-A/D-B/D-C).
> **Plan:** `docs/agent-ops/plans/2026-10-19-remediation-wave1/A1-docs.md` (continuación)
> **Zona:** `docs/roadmap/**`, `docs/agent-ops/**`, `docs/index.md`, `docs/adr/**`,
> `docs/architecture/**`, `docs/product/**`, `docs/engineering/**`, `docs/design/**`,
> `docs/research/README.md`, `docs/user/**`, `docs/.vitepress/**`, `AGENTS.md`,
> `CHANGELOG.md`.
> **Sin commits. Sin `git checkout/reset/stash/clean`. Sin `pnpm install`.**
> **No he tocado `packages/**` ni `apps/**`** — A4 trabaja en `apps/desktop/**`,
> A6 en `packages/avatar/**` y A7 en `.github/**` · `scripts/**` · raíz. He leído
> sus ficheros **solo** para medir la evidencia que cito.

---

## 1. Qué he cerrado en esta ola

| Trabajo | Entregable | Estado |
|---|---|---|
| **T1** | `docs/roadmap/Backlog.md`: 4 hallazgos cerrados + 3 filas nuevas | ✅ |
| **T2** | `docs/agent-ops/plans/.../VERDICT.md`: estado real de la Ola 2 + Ola 3 revisada | ✅ |
| **T3** | `docs/agent-ops/reports/reviews/remediation-wave2-2026-10-20.md` (nuevo) + registro en `docs/agent-ops/reports/INDEX.md` | ✅ |
| **T4** | `docs/architecture/character-system.md` + `docs/product/mascota.md` | ✅ |
| **T5** | `CHANGELOG.md` raíz + `docs/changelog.md` + `docs/user/changelog.md` | ✅ |

---

## 2. T1 — Backlog: el estado real de la Ola 2

### 2.1 Cerrados (4), con evidencia verificada por mí

| ID | Antes | Ahora | Evidencia medida |
|---|---|---|---|
| `EGO-FIND-54` (descomposición de `main.ts`) | 🟡 | ✅ | **1 287 líneas** (objetivo < 1 500) · **0 `let` de módulo** fuera de `app-context.ts` · **gate de CI** `apps/desktop/test/e6-runtime-state.test.ts` con 4 comprobaciones |
| `EGO-FIND-61` (DOMPurify + CSP) | 🟡 | ✅ | DOMPurify en `renderer/lib/sanitize-html.ts:39` · CSP con **`img-src 'self' data: blob:`** en `electron-security.ts:120`, aplicada vía `onHeadersReceived` (`create-window.ts:985-990`) |
| `EGO-FIND-71` (contraste WCAG AA) | 🟡 | ✅ | **0 `it.fails` en todo el repo** · el contraste se calcula sobre `theme-tokens.css` (`wcagRatio(...) ≥ 4.5`) |
| `EGO-FIND-23` (electron EOL) | 🟡 | ✅ | `electron` `^33.2.0` → **`^41.10.7`** en el manifiesto · el `pnpm.overrides` que aplicaba el salto sin tocar el manifiesto (prohibido por **D1**) **desaparece** |

### 2.2 Verificación de `EGO-FIND-43` (ya cerrado en mi turno anterior)

La evidencia **era** una medición, no una afirmación: `N=6 L=100ms C=3 → real=220ms`
frente a 200 ms (paralelo teórico) y 600 ms (serie), con `concurrencia_max_observada=3`.
Se mantiene sin cambios.

### 2.3 Filas nuevas (3)

| ID | Severidad | Prioridad | Esfuerzo | Estado | Qué es |
|---|---|---|---|---|---|
| **`EGO-FIND-84`** | 🟡 Media | 🟠 P1 | 1d | ✅ | **Estado `warning` del motor + encadenado en el renderer** — capacidad nueva, no corrección. Cierra el hueco de producto: el avatar no tenía representación para «degradación tolerable» (con una tool fallando mostraba `thinking`, es decir, mentía). |
| **`EGO-FIND-85`** | 🟡 Media | 🟠 P1 | 1d | ✅ | **Guard de contrato de estados** (`avatar-state-contract.test.ts`, 7 tests) — es un **gate**, no una feature: enumera todos los `CharacterState` y comprueba que ninguno cae en el `idle` de reserva (el síntoma exacto de «falta el `case»`). |
| **`EGO-FIND-86`** | 🟠 Alta | 🟠 P1 | 0.5d | 🆕 | **La lista blanca de `design-lint` se indexa por ID posicional** (`EGO-DL-0NN`, asignado en orden de escaneo) → se autodesactiva bajo refactor. Bug real encontrado por A4. |

> **IDs 82 y 83 son de A5** (cadena de atribución de licencia y la licencia AGPL-3.0
> de `khoj`), creados en paralelo durante esta ola. **No los he tocado.** Por eso mis
> filas empiezan en 84 y no en 82.

### 2.4 Revisión de los 🟡 y 🆕 que quedan abiertos (ajuste solo con evidencia)

| ID | Estado | Verificación |
|---|---|---|
| `EGO-FIND-22` | 🟡 (se queda) | `DelegationRouter` **ya está** instanciado (`packages/subegos/src/DelegationRuntime.ts:14`) → lo anoto como progreso; pero `DreamConsolidator` y `MemoryCurator` siguen con **0 instanciaciones** → no se cierra. |
| `EGO-FIND-29` | 🟡 (se queda) | El path cognitivo nativo sigue sin cablear (solo `graphragSearch`). Es **E2** de la Ola 3. |
| `EGO-FIND-63` | 🟡 (se queda) | 28 de 135 ficheros de test leen ficheros. El caso de `a11y.test.tsx` sí se resolvió (lee `theme-tokens.css` en vez de paletas hardcodeadas), pero el patrón sigue vivo. |
| `EGO-FIND-64` | 🟡 (se queda) | **`file:../../../VantaDB/vantadb-node` sigue en los dos manifiestos** (`apps/desktop/package.json:36`, `packages/memory/package.json:27`). El diff de A7 nunca se aplicó. |
| `EGO-FIND-49` | 🆕 (se queda) | `overrideExisting: true` sigue en `McpManager.ts`. |
| `EGO-FIND-80` | 🆕 (se queda) | La doc oficial de Anthropic sigue geobloqueada por región en este entorno. |
| `EGO-FIND-81` | 🆕 (se queda) | Bloqueo del owner (ver §6). |

### 2.5 Estado final del Backlog

**76 ✅ Completada · 4 🟡 Parcial · 6 🆕 Pendiente** (86 filas `EGO-FIND`).

---

## 3. T2 — VERDICT.md: estado de la Ola 2 y Ola 3

### 3.1 §3 «Estado de la Ola 2» — reescrito con datos medidos

Cerradas: **E1**, **E6**, **E7**, estado `warning` (motor + renderer), guard de contrato,
round-trip Ego→studio→Ego, `correlationId`, vitest 3, corpus legal fuera del lint,
electron fuera de EOL. Abiertas: **E2** (path cognitivo nativo), **E3** (bloqueo owner),
**E10** (residual: `prefers-contrast` con **0 coincidencias** y `@container` con **1**).

**Correcciones respecto a lo que se suponía al inicio de la ola:**

- **E7 no estaba «a medio hacer»**: `img-src 'self' data: blob:` **ya estaba** en la CSP y
  DOMPurify **ya se aplicaba**. E7 está **cerrada**.
- **Los 6 `it.fails` de contraste ya no existen** (0 en el repo) → E10 avanza.
- **El round-trip que «perdía 4 estados» ya está cerrado** por A6. Lo he **medido** sobre
  el mapa real (`packages/avatar/src/studio/adapter.js`): **15/15 estados con identidad,
  0 LOSSY**.
- **`main.ts` está en 1 287 líneas**, no en 1 520 (el dato del turno anterior quedó viejo).

### 3.2 §7 «Ola 3» — 18 capacidades, ordenadas por la progresión de fases de `AGENTS.md` §6

Se quitan E7 (cerrada) y el round-trip (cerrado); se añaden el remate de `main.ts`
(tray + 3 bloques), `EGO-FIND-64`, `EGO-FIND-22`, `EGO-FIND-86` y `EGO-FIND-49`.
**E2 sigue siendo el mayor multiplicador**: el binding expone las 5 APIs y solo
`graphragSearch` está cableado, con la puerta de invariantes del ADR-0020 por delante.
Los **3 bloqueos del owner** siguen marcados: `DIST-04`, `DIST-09`, `EGO-FIND-81`.

---

## 4. T3 — Informe de cierre de la Ola 2

`docs/agent-ops/reports/reviews/remediation-wave2-2026-10-20.md` (nuevo), registrado en
`docs/agent-ops/reports/INDEX.md` (fila + resumen).

Contiene: qué se cerró con **evidencia medida** · los **3 bugs de producción que los tests
verdes escondían** · la **tabla de 23 gates** con su exit y su fuente · los **gates que no
están verdes** con su causa · la deuda con dueño · los 3 bloqueos del owner · 5 lecciones.

**Los 3 bugs** (ninguno lo cazó un test):

1. **`toolEvents` acumulativo** → un `tool_error` del turno 1 dejaba el avatar en ámbar
   **durante todos los turnos siguientes**. `toolEvents` es historial y no se limpia en
   `executeTurn` (solo en `/clear`). El aviso —que significa «degradación tolerable»— se
   convertía en estado permanente: el peor fallo posible de una señal de alerta.
2. **Round-trip con pérdida de identidad** en 4 estados (`thinking`, `approval`,
   `question`, `ratelimit`). El mapa del studio, no el render, era el que mentía.
3. **Lista blanca de `design-lint` indexada por ID posicional**: un hex literal nuevo
   desplaza los IDs y la entrada `EGO-DL-010` deja de suprimir nada. Un mecanismo de
   excepción que se autodesactiva da falsa confianza.

---

## 5. T4 y T5 — Documentación de producto y changelogs

### 5.1 `docs/architecture/character-system.md` y `docs/product/mascota.md`

A6 ya había documentado el estado `warning` y los 15 estados; **he completado lo que
faltaba y he corregido lo que quedó viejo**:

- El diagrama pasa de `avatarLiveState = useMemo(...)` a **`resolveAvatarLiveState`**
  (**función pura** en `avatar-live-state.ts`) con la precedencia real y el acotado por
  `turnStartToolSeq`.
- La FSM **fue retirada** en `cce55ae` (ya no "no se instancia": **no existe**), con el
  motivo y el principio **D3** en la tabla de legado y en `mascota.md`.
- `266 tests → 274`, `168 → 174` combinaciones, y **15/15** de round-trip.
- Se añade el **guard de contrato** como estado de la implementación.
- Se explica el **bug de `toolEvents`** (por qué el aviso se acotó al turno).

### 5.2 Los 3 changelogs

Entrada de la **Ola 2** en `CHANGELOG.md` raíz, `docs/changelog.md` y
`docs/user/changelog.md` (versión amigable, con la nota de migración del Electron y la
honestidad sobre el canal del token MCP, que **todavía no está cerrado**).

**Regla de precedencia: mantenida y reforzada.** El espejo `docs/changelog.md` **había
derivado** (decía «17 ADRs» donde la raíz decía 20) → lo he **re-sincronizado desde la
raíz** con un script que copia la sección `[Unreleased]` literal, para que la deriva no
pueda repetirse. Los tres ficheros declaran **«manda la raíz»**.

---

## 6. Solicitudes fuera de zona (NO aplicadas)

| # | Fichero | Cambio pedido | Motivo | Bloqueante |
|---|---|---|---|---|
| 1 | `apps/desktop/package.json` + `packages/memory/package.json` | **Aplicar el diff de `vantadb-node`** (A7 ya escribió el script y el diff exacto): `"file:../../../VantaDB/vantadb-node"` → tarball vendorizado, y versionarlo. | `git diff` de ambos manifiestos vacío → **el cambio nunca se aplicó**. `EGO-FIND-64` (🟡). Mientras tanto CI compila un stub no-op. | No |
| 2 | `packages/integrations/src/mcp/McpManager.ts:116-119` | Quitar `overrideExisting: true` o exigir `allowOverride` explícito por servidor, y **auditar** el override. | `EGO-FIND-49` (🆕). Un servidor MCP puede pisar `fs_read_file` o `terminal_exec`. | No |
| 3 | `apps/desktop/renderer/test/design-lint.test.tsx` + `apps/desktop/scripts/design-lint.cjs` | Indexar la lista blanca por **hash del contenido** del hallazgo, no por ID posicional. | `EGO-FIND-86` (🆕, abierto en este turno). | No |
| 4 | `packages/knowledge/src/HybridSearch.ts` + `packages/memory/EgoMemoryAdapter.ts` | **Path cognitivo nativo** (E2) y ejecutar la **puerta de invariantes** del ADR-0020. | Cierra `EGO-FIND-29` (🟡) y da el visto bueno a la vía nativa. | **Sí** — Ola 3 · E2 |
| 5 | `packages/runtime/src/ToolExecutionLoop.ts` / `packages/models/` | Contrastar la constraint del proveedor contra la **doc oficial de Anthropic** (`EGO-FIND-80`). | La doc está geobloqueada por región; A2 verificó contra el *source* del SDK. | No |
| 6 | `packages/tasks/src/DreamConsolidator.ts` + `packages/memory/` | Instanciar `DreamConsolidator` y `MemoryCurator` (o retirar la clase si el diseño cambió). | `EGO-FIND-22` (🟡): 2 commits P0 mejoraron código muerto. `DelegationRouter` ya está instanciado. | No |
| 7 | `docs/user/` (guía de usuario final) | **Redactar el contrato de obtención del token MCP**: variable de entorno `EGO_MCP_TOKEN` y/o fichero `0600` + descubrimiento del puerto (efímero hoy). | `EGO-FIND-81`. Es documentación **de cara al usuario**, no interna. | **Sí** — el owner debe confirmar el canal definitivo |
| 8 | `apps/desktop/src/main.ts` | Extraer el bloque del **tray** (~190 líneas) y los 3 bloques cohesivos (~170). | Residual de E6 → **E6-res**, primera tarea de Fase 02 en la Ola 3. | No |
| 9 | `packages/events/src/` + `packages/runtime/` | Verificar que la correlación cubre también el **camino de error** (`tool.failed`), no solo el de ejecución. | `EGO-FIND-74` ya está ✅; esto es completitud, no un cierre pendiente. | No |
| 10 | `tests/e2e/**` | Los **5 contratos `floating-wiring`** en rojo (71 passed · 5 failed · 1 skipped). | E12 (pirámide de tests) en la Ola 3. | No |
| 11 | `docs/research/licencias-obligaciones.md` (A5) + `docs/.vitepress/config.mts` (mío) | **Resuelto sin tocar el fichero de A5**: los enlaces `../../LICENSE` y `../../packages/avatar/LICENSE.md` apuntan fuera del root del sitio, así que los añadí al `ignoreDeadLinks` de la config de VitePress (mi zona). El build estaba **rojo** por eso. | El fichero es de A5; la config es mía. Con la config no se toca su contenido. | No |
| 12 | `packages/avatar/**` (A6) + `apps/desktop/**` (A4) | A6 ya cerró el round-trip (15/15 medido) y A4 el `warning` en el renderer. **Nada pendiente de ellos.** | Verificado. | No |

---

## 7. Verificación

| Comando | Exit | Resumen |
|---|---|---|
| `node docs/testing/check-docs-paths.mjs` | **0** | 366 docs · **0 enlaces rotos** · **0 rutas inexistentes** en docs canónicos · 224 en worklogs (informativo) |
| `node scripts/verify-vantadb-ids.mjs` | **0** | **0 errores** · 24 avisos (0 W1) · 23 IDs · 62 referencias |
| `pnpm docs:build` | **0** | `build complete in 118.78s` (tras añadir `/LICENSE/` y `/packages\/avatar\/LICENSE/` al `ignoreDeadLinks`: el build **estaba rojo** por los enlaces legales de A5) |
| `node scripts/check-docs-lint.mjs` | **0** | **0 regresiones** · 11 652 violaciones en 281 ficheros (base: 11 668 en 282 → mi informe **bajó** el recuento global) |
| Round-trip Ego→studio→Ego | — | **15/15 identidad, 0 LOSSY** (medido sobre `packages/avatar/src/studio/adapter.js`) |
| Backlog | — | **76 ✅ · 4 🟡 · 6 🆕** (86 filas) |

---

## 8. Deuda / no resuelto

1. **El canal de obtención del token MCP está bloqueado por el owner** (solicitud #7): sin
   esa decisión, un cliente MCP externo **no puede autenticarse** de forma documentada.
   `EGO-FIND-81` sigue 🆕.
2. **`vantadb-node` por `file:`** (solicitud #1): los dos manifiestos siguen apuntando al
   checkout hermano y **CI compila un stub no-op**. `EGO-FIND-64` sigue 🟡.
3. **`EGO-FIND-49`** (solicitud #2): un servidor MCP puede pisar tools nativas.
4. **La lista blanca de `design-lint`** (solicitud #3): se autodesactiva bajo refactor.
   `EGO-FIND-86` nuevo.
5. **E2 (path cognitivo nativo)** sigue siendo el mayor multiplicador: 4 de las 5 APIs
   nativas sin cablear, y la puerta de invariantes del ADR-0020 sin ejecutar.
6. **El Backlog lo editan varios agentes a la vez**: A5 añadió ~500 filas de compuertas y
   2 hallazgos nuevos (82, 83) durante esta ola. Mis ediciones y las suyas se intercalan
   en el mismo fichero — **el orquestador debe revisar ese diff con cuidado**.
7. **`docs/research/licencias-obligaciones.md` enlaza a ficheros fuera del root del sitio.**
   Lo resolví en la config (mi zona), pero la solución de fondo sería que esos enlaces
   apunten a rutas publicables o a URLs absolutas.
8. **El baseline de `check-docs-lint.mjs` lo regenera otro agente** durante la ola (se movió
   11 471 → 11 668 durante esta ola): re-verificar antes de confiar en cualquier delta.

---

## 9. Nota de estado del árbol

Working tree sucio y compartido con A2–A8 — **esperado por contrato** (README §5.5).
**No he hecho ningún commit, ni `git checkout/reset/stash/clean`, ni `pnpm install`.**
No he tocado `packages/**` ni `apps/**`. Los ficheros de otros agentes que `git status`
puede mostrar y **no son míos**: `docs/research/licencias-obligaciones.md` (A5),
`docs/agent-ops/plans/.../handoff/A{2,6,7}-ola2-*.md` (A2/A6/A7),
`packages/avatar/**` (A6), `apps/desktop/**` (A4).
