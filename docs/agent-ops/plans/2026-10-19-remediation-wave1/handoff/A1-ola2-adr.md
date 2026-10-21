# Handoff A1 (Ola 2) — 2026-07-20 — ADRs del owner + estado del Backlog

> **Agente:** A1 (documentación canónica, ADRs, Backlog)
> **Ola:** 2 — registro de las 3 decisiones ratificadas por el owner (D-A, D-B, D-C),
> cierre de 4 hallazgos del Backlog y plan de la Ola 3.
> **Plan:** `docs/agent-ops/plans/2026-10-19-remediation-wave1/A1-docs.md` (continuación)
> **Zona:** la de la Ola 1b (`docs/adr/**`, `docs/roadmap/**`, `docs/index.md`,
> `docs/adr/README.md`, `docs/agent-ops/plans/.../VERDICT.md`).
> **Sin commits. Sin `pnpm install`. Sin tocar `packages/**` ni `apps/**`.**

---

## Cambios aplicados (ficheros propios)

### T1 — ADR 0021: transporte y token del MCP Server (`D-A` + `D-B`)

- `docs/adr/0021-mcp-server-transporte-y-token.md` (**nuevo**) — plantilla canónica
  (contexto · alternativas · decisión · **invariantes de seguridad** · consecuencias · referencias).
  - **Alternativas evaluadas** con veredicto y motivo: *proceso hijo stdio* (descartada: proxiaría
    el `ToolRegistry` y la memoria por el pipe → el catálogo expuesto sería una copia
    desincronizada; además `startStdio()` existía pero **nunca se arrancó**), *socket local*
    (descartada: mismo problema de proxying + permisos por fichero en Windows, sin aportar nada
    sobre loopback), *HTTP streamable en `127.0.0.1` in-proceso* (**elegida**: el único que
    expone el runtime real sin duplicarlo).
  - **Criterio de decisión** escrito: *"¿el cliente MCP externo habla con el runtime real de
    Ego o con una copia?"* → exigía in-proceso.
  - **Los 5 invariantes de seguridad**, redactados como invariantes (no notas):
    1. **Solo loopback**: otra interfaz (`0.0.0.0`, `::`, IP de LAN) → **el arranque falla**.
    2. **Bearer obligatorio y las peticiones sin token se rechazan ANTES de tocar el registry**
       (401, comparación en tiempo constante).
    3. **Token de 32 bytes aleatorios, cifrado en el keychain, revocado al cerrar** (si
       sobreviviera, un cliente que lo cacheó seguiría autenticando contra un servidor que el
       usuario cree apagado).
    4. **Gate HITL fail-closed con el mismo `ApprovalEngine` del chat**: sin gate, la llamada se
       rechaza. Un cliente MCP externo no puede saltarse la aprobación humana.
    5. **El token no se expone al renderer** (el renderer es *untrusted*; un token en el
       renderer es un token en manos de la UI ante una XSS).
  - **Contrato de obtención para clientes externos**: variable de entorno con nombre explícito
    (`EGO_MCP_TOKEN`) y alternativa de fichero en el directorio de datos con permisos `0600`,
    con la **tarea de `docs/user/` explícitamente abierta** (es documentación de cara al
    usuario final, no interna) y **bloqueo owner** en el canal definitivo + el descubrimiento del
    puerto efímero.
- **Evidencia verificada por mí antes de escribir** (no copiada): `mcp-server-runtime.ts`
  (token en keychain + revocación), `mcp-http-server.ts:96-99` (loopback) y `:134-136`
  (bearer antes del registry), `mcp-http-server.ts:62-66` (`timingSafeEqual`),
  `main.ts:1436-1442` (`before-quit` → cierre que revoca).

### T2 — ADR 0018: retirada de la FSM legacy (`D-C`)

- `docs/adr/0018-motor-de-personaje.md` — **nueva sección §"Retirada de la FSM legacy"** con:
  - El commit `cce55ae` y lo que retiró: `CharacterStateMachine.ts` (396 líneas),
    `CharacterCanvas.tsx` (124), `CharacterMiniBadge.tsx` (113) → sustituidos por
    `state/character-state.ts` (66) + `CharacterLegacy.test.tsx` (95).
  - **Motivo verificado con evidencia** (tabla comparativa): el motor canónico `@ego/avatar` es
    una **tabla de datos** de 14 estados + 11 emotes + `STATE_SOUND` + 22 estados de studio con
    puente bidireccional, más el motor que interpola (`core/anim.js`, easings/springs,
    sub-stepping 240 Hz, poses ARA, micro-gestos, `fx-eyes`, sonido, partículas), con **266 tests**,
    golden 168/168, sync SHA-256 y cadena MIT resoluble; la FSM legacy era un **interpolador
    cinético** de 14 canales numéricos escrito en Ego (adaptación COUC-06) que **nunca se
    instanció** → su modelo de interpolación nunca se ejecutó y no tenía verificación posible.
  - **Principio D3** explícito: el motor del repo `avatar` **es** la primitive; la FSM era la
    reimplementación. Retirarla no es borrar capacidad: es dejar de mantener dos
    implementaciones de lo mismo, de las que solo una funcionaba.
  - **Estado del vocabulario**: 9 coinciden · 4 cambian de nombre con equivalencia mapeada en
    `CharacterBadge.mapCharacterStateToAvatarState` (`approval_required→approval`,
    `generating|using_tool→working`, `attention→approval`) · **`warning` cerrado por A6 en la
    Ola 2** (`states.js:36,86,127`; golden 168 → 174; `character-state.ts:45,62` con 14 estados),
    con el **único punto residual** (A4): el diff de A6 para que `avatarLiveState` devuelva
    `"warning"` ante `tool_error`.
- `docs/adr/0018-motor-de-personaje.md` — `Estado` actualizado (la FSM legacy *ya se retiró*) y la
  consecuencia sobre `CharacterEngine.ts` (ya no dibuja: sobrevive por `RGB`/`EyeShape`/`hexToRGB`).

### T3 — Backlog: reflejan las decisiones del owner

- `docs/roadmap/Backlog.md` — **4 hallazgos cerrados** con evidencia verificable:
  - **`EGO-FIND-43`** (ejecución paralela) → ✅ Completada. Diseño en 3 fases (preparación
    secuencial → ejecución concurrente → emisión secuencial) y **medición, no afirmación**:
    `N=6 L=100ms C=3 → real=220ms · teórico_paralelo=200ms · teórico_serie=600ms ·
    concurrencia_max_observada=3`.
  - **`EGO-FIND-46`** (MCP Server) → ✅ Completada. Arrancado desde main; invariantes
    implementados; **48 tests** relacionados (nombrados uno a uno).
  - **`EGO-FIND-69`** (legacy del personaje) → ✅ Completada (retirada con veredicto).
  - **`EGO-FIND-74`** (`correlationId`) → ✅ Completada (`packages/events/src/correlation.ts`).
- `docs/roadmap/Backlog.md` — **nueva sección §"Tareas abiertas de la Ola 2 (2026-07-20)"** con
  2 tareas nuevas y dueño:
  - **`EGO-FIND-80`** — contrastar la constraint `tool_use`/`tool_result` contra la **doc oficial
    de Anthropic**. A2 la verificó contra el *source* del SDK instalado
    (`@ai-sdk/anthropic@4.0.78` → `convert-to-anthropic-prompt.ts` `groupIntoBlocks()` L1569-1577)
    porque la doc está **geobloqueada por región** en este entorno. Verificación sólida pero
    **no es la fuente primaria** → queda **explícitamente** como tarea con dueño (A2).
  - **`EGO-FIND-81`** — contrato de obtención del token MCP para clientes externos, en
    `docs/user/` (documentación de usuario final). **Bloqueo owner** en el canal definitivo.
- `docs/roadmap/Backlog.md` — **reparación de tabla**: mis filas contenían `|` crudos (el
  separador de la medición y las alternativas `resources/list|read`), lo que rompía las columnas
  y desbalanceaba los code spans (MD056/MD038). También se escapó un `|` crudo preexistente en
  `memory("put"|"delete")` (fila `EGO-FIND-53`).
- `docs/roadmap/Backlog.md` — enlaces a ADRs corregidos (`../../adr/` → `../adr/`, desde
  `docs/roadmap/`) y `../extractions/hermes.md` → `../extractions/hermes-agent.md` (27 enlaces
  rotos que rompían el build del sitio; **ninguno era mío** (los introdujo A5 al
  añadir las compuertas nuevas, pero el fichero es mío).
- `docs/roadmap/Backlog.md` — **estado final**: 70 ✅ · 8 🟡 · 3 🆕
  (`EGO-FIND-49`, `EGO-FIND-80`, `EGO-FIND-81`).

### T4 — `VERDICT.md`: estado de la Ola 2 + Ola 3

- `docs/agent-ops/plans/2026-10-19-remediation-wave1/VERDICT.md`:
  - **§3 · "Estado de la Ola 2 (verificado 2026-07-20)"** — tabla con E1 ✅ (A2, con la
    medición), E6 🟡 en curso (A4: `main.ts` 5 507 → 2 857 → **1 520** líneas con 20 módulos
    extraídos), E2 ⏸️ (con la puerta de invariantes del ADR-0020), E7 ⏸️, E10 🟡 parcial, E3 ⛔
    bloqueo owner, `warning` cerrado en el motor (A6) con el residual del renderer en A4.
  - **§3 · "Decisiones del owner ratificadas el 2026-07-20"** — tabla D-A / D-B / D-C con su
    registro (ADR-0021, ADR-0018, `EGO-FIND-81`).
  - **§7 · "Ola 3 — siguiente (pendientes de la Ola 2)"** — 15 capacidades reordenadas por la
    **progresión de fases de `AGENTS.md` §6**, no por valor, con el tipo (a)/(b) heredado del
    plan A8 y el estado/bloqueo de cada una. Los **3 bloques con bloqueo del owner** quedan
    marcados: `DIST-04` (firma), `DIST-09` (publicar `vantadb-node`) y el canal del token MCP.
  - Reglas de progresión por fases de la Ola 3 + regla explícita: *ningún bloque marcado ⛔
    BLOQUEO OWNER avanza sin desbloqueo*.
  - **§6** actualizado: el texto sobre la regresión de `main.ts` (5 401 → 5 507) se corrige con
    el dato actual (**1 520** líneas, objetivo < 1 500 → quedan 20).

### Índices

- `docs/index.md` — ADR-0021 indexado.
- `docs/adr/README.md` — 21 ADRs en la tabla de decisiones; estados actualizados (0018 y 0020
  como "parcial" con el detalle real; 0021 como aceptado).

---

## Solicitudes fuera de zona (NO aplicadas)

| # | Fichero | Cambio pedido | Motivo | Bloqueante |
|---|---|---|---|---|
| 1 | `apps/desktop/renderer/components/ego-chat.tsx` (función `avatarLiveState`) | Aplicar el diff que A6 entrega en `handoff/A6-ola2-warning.md` §5.2: si el **último** evento de tool es `tool_error` → `return "warning"`. Hoy ese evento cae en la rama del mensaje y el avatar se queda en `thinking` aunque el turno continúe. | Es el **único** punto residual de `EGO-FIND-69` y de `D-C`. **Zona de A4.** | No |
| 2 | `apps/desktop/package.json` + `package.json` raíz | **`electron`: quitar el `pnpm.overrides` y subir el manifiesto.** Hoy el manifiesto declara `electron: ^33.2.0` y el salto a 41.10.7 se aplica por `pnpm.overrides` — que la decisión **D1 del owner prohíbe explícitamente**. | `EGO-FIND-23` (🟡). Manifiestos de A4 / A7. | No |
| 3 | `apps/desktop/package.json` + `packages/memory/package.json` | **Aplicar el diff de `vantadb-node`** (A7 ya escribió el script y el diff exacto): `"file:../../../VantaDB/vantadb-node"` → `"file:../../vendor/vantadb-node/vantadb-node-0.8.0.tgz"`, y versionar el tarball. | `git diff` de ambos manifiestos vacío → el cambio de A7 (T7) **no se aplicó**. `EGO-FIND-64` (🟡). | No |
| 4 | `packages/integrations/src/mcp/McpManager.ts:120` | Quitar `overrideExisting: true` o exigir `allowOverride` explícito por servidor, y **auditar** el override. | `EGO-FIND-49` (🆕). Un servidor MCP puede pisar tools nativas. | No |
| 5 | `packages/knowledge/src/HybridSearch.ts` + `packages/memory/EgoMemoryAdapter.ts` | **Path cognitivo nativo** (Ola 2 · E2) y ejecutar la **puerta de invariantes** del ADR-0020: ¿el `contextAssemble()` nativo preserva el system prompt y los pares `tool_call`/`tool_result`? Si no, se registra como petición upstream (ya abierta: `VDB-REQ-13`). | Cierra `EGO-FIND-29` (🟡) y da el visto bueno a la vía nativa del ADR-0020. | **Sí** — Ola 2 · E2 |
| 6 | `packages/runtime/src/ToolExecutionLoop.ts` / `packages/models/` | **Contrastar la constraint del proveedor contra la doc oficial de Anthropic** (`EGO-FIND-80`). La doc está geobloqueada por región en este entorno; A2 verificó contra el *source* del SDK. | Tarea con dueño ya abierta en el Backlog. | No |
| 7 | `docs/user/` (guía de usuario final) | **Redactar el contrato de obtención del token MCP** para clientes externos: variable de entorno `EGO_MCP_TOKEN` y/o fichero `0600` en el directorio de datos de la app + descubrimiento del puerto (efímero hoy). | `EGO-FIND-81`. Es documentación **de cara al usuario**, no interna. | **Sí** — el owner debe confirmar el canal definitivo |
| 8 | `packages/runtime/src/TrustBoundary.ts` + `packages/events/src/` | Verificar que la correlación cubre también el camino de **error** (`tool.failed`) y no solo el de ejecución. | `EGO-FIND-74` ya está ✅; esto es una comprobación de completitud, no un cierre pendiente. | No |
| 9 | `docs/extractions/*.md` + `docs/review/backlog-*.md` | 22 avisos del registro de VantaDB (W5=10, W3=11, W4=1) por normalizar las 15 entradas legacy: `**Estado:**`, `**Impacto en Ego:**` y `archivo:línea` en `Componente`. | Cada `Impacto en Ego` debe ser una **afirmación comprobable**, no un relleno. | No |
| 10 | `docs/agent-ops/plans/.../handoff/A2-ola2-E1.md`, `A6-ola2-warning.md`, `docs/research/{character-audit-and-coucou-inventory,sintesis-capacidades-ego}.md` | 11 regresiones de markdownlint (MD003 ×27, MD013 ×6, MD040 ×5, MD032 ×1, MD056 ×1, MD047 ×1, MD029 ×5) en ficheros de A2, A6 y A5/A8. | El gate `check-docs-lint.mjs` sale en rojo por ellos. **No son mis ficheros**; lo dejo documentado para que el orquestador lo asigne. | No |

---

## Verificación

| Comando | Exit | Resumen |
|---|---|---|
| `node docs/testing/check-docs-paths.mjs` | **0** | 359 docs · **0 enlaces rotos** · **0 rutas inexistentes** en docs canónicos · 219 en worklogs (informativo) |
| `node scripts/verify-vantadb-ids.mjs` | **0** | **0 errores** · 24 avisos (0 W1) · 23 IDs · 62 referencias · 838 ficheros |
| `pnpm docs:build` | **0** | `build complete in 170.74s` (el sitio volvió a compilar tras reparar los 27 enlaces `extractions/hermes.md` y los `|` crudos de mis filas) |
| `node scripts/check-docs-lint.mjs` | 1 | **0 regresiones en ficheros de A1** · 11 regresiones, todas en ficheros de A2/A6/A5-A8 (solicitud #10) |
| Estado del Backlog | — | **70 ✅ · 8 🟡 · 3 🆕** (`EGO-FIND-49`, `EGO-FIND-80`, `EGO-FIND-81`) |

---

## Deuda / no resuelto

1. **El diff del renderer para `warning` es de A4** (solicitud #1): sin él, el estado `warning` existe
   en el motor pero el avatar no lo muestra ante `tool_error`.
2. **El canal de obtención del token MCP está bloqueado por el owner** (solicitud #7): sin esa
   decisión no se puede escribir la guía de `docs/user/`, y un cliente MCP externo **no puede
   autenticarse** hoy de forma documentada.
3. **La constraint de Anthropic sigue sin contrastarse contra su doc oficial**
   (solicitud #6 / `EGO-FIND-80`): la verificación de A2 contra el *source* del SDK es sólida, pero
   no es la fuente primaria, y la doc está geobloqueada por región en este entorno.
4. **Dos hallazgos del owner siguen bloqueados por una causa externa**: `DIST-04` (certificados de firma)
   y `DIST-09` (publicar `vantadb-node` en el registry: `npm view vantadb-node` → 404). El build
   depende hoy del checkout hermano por `file:`.
5. **`EGO-FIND-49` sigue abierto** (solicitud #4): un servidor MCP puede pisar tools nativas.
6. **11 regresiones de markdownlint en ficheros ajenos** (solicitud #10): el gate de docs-lint
   seguirá rojo hasta que A2/A6/A5 las corrijan o el orquestador regenere la línea base.
7. **El Backlog lo están editando varios agentes a la vez** (A5 añadió ~500 filas de compuertas
   nuevas durante esta ola). Mis ediciones y las suyas se intercalan en el mismo fichero: el
   orquestador debe revisar el diff del Backlog con cuidado al consolidar.

---

## Nota de estado del árbol

Working tree sucio y compartido con A2–A8 — **esperado por contrato** (README §5.5).
**No he hecho ningún commit, ni `git checkout/reset/stash/clean`, ni `pnpm install`.**
No he tocado `packages/**` ni `apps/**`: A4 trabaja en `apps/desktop/**` y A6 en
`packages/avatar/**`, y he leído sus ficheros **solo** para verificar la evidencia que cito.

> **Ficheros de otros agentes que `git status` puede mostrar y no son míos:**
> `docs/agent-ops/plans/.../handoff/A2-ola2-E1.md`, `handoff/A6-ola2-warning.md`,
> `docs/research/{character-audit-and-coucou-inventory,sintesis-capacidades-ego}.md`,
> y las ~500 filas de compuertas nuevas que A5 añadió al Backlog durante la Ola 2
> (las he respetado; solo he corregido mis 4 filas y 2 tareas nuevas).
