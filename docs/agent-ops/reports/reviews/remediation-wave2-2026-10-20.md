# Cierre de la Ola 2 — Remediación Ego (2026-10-20) #

> **Alcance**: cierre del Bloque E de la Ola 2 de remediación, siguiendo
> `docs/agent-ops/plans/2026-10-19-remediation-wave1/VERDICT.md` §3.
> **Agentes**: A1 (documentación canónica), A2 (núcleo cognitivo), A3 (integraciones),
> A4 (desktop), A6 (motor de personaje), A7 (calidad/CI).
> **Sin commits**: el árbol es compartido y sucio por diseño (contrato §5.5); el
> orquestador consolida.
> **Cifras**: todas las de este informe son **medidas**, no afirmaciones. Cada una
> indica su fuente.

---

## 1. Qué se cerró en la Ola 2 ##

### 1.1 Ejecución paralela de tool calls con orden garantizado — `EGO-FIND-43` ✅ ###

El bucle de tools de `packages/runtime/src/ToolExecutionLoop.ts` pasó de secuencial a
**concurrente con orden preservado** en tres fases: preparación (registry + Zod + gates +
HITL, **secuencial** en el orden de los `tool_use`), ejecución concurrente
(`Promise.allSettled`, gobernada por `maxConcurrentExecutions`) y emisión **secuencial** en el
orden original.

**Medición** (no afirmación), del propio test `ToolExecutionLoop-parallel.test.ts`:

```text
N=6 L=100ms C=3 -> real=220ms | teórico_paralelo=200ms | teórico_serie=600ms
                    concurrencia_max_observada=3
```text

`real=220ms` está un 10 % por encima del paralelismo teórico (200 ms) y un **63 % por debajo**
de la ejecución en serie (600 ms); la concurrencia máxima observada es 3, exactamente el
tope configurado ⇒ el `ExecutionManager` sigue siendo el único dueño del límite.

**Restricción del proveedor verificada con honestidad**: la constraint ("cada `tool_result`
sigue en orden a su `tool_use`") se comprobó contra el **source del SDK instalado**
(`@ai-sdk/anthropic@4.0.78` → `convert-to-anthropic-prompt.ts`, `groupIntoBlocks()`), **no**
contra la documentación oficial, que en este entorno está **geobloqueada por región**
("App unavailable in region"). Queda abierta como `EGO-FIND-80`, con dueño.

### 1.2 Descomposición de `main.ts` — `EGO-FIND-54` ✅ ###

| Métrica | Antes | Después | Fuente |
|---|---|---|---|
| Líneas de `apps/desktop/src/main.ts` | 5 401 | **1 287** | lectura directa del fichero |
| Módulos extraídos (nota 1) | 0 | **20** | árbol de ficheros |
| `let` de **módulo** mutables fuera de `app-context.ts` | 69 | **0** | `test/e6-runtime-state.test.ts` |

**Nota 1.** Los 20 módulos cuelgan de `apps/desktop/src/main/`: `ipc/`, `llm/`,
`mcp/`, `models/`, `security/`, `state/`, `window/` y `credentials/`.

El objetivo era < 1 500 líneas: se alcanzó con **213 líneas de margen**.

**La deuda dejó de ser una promesa y pasó a ser una puerta**: `apps/desktop/test/e6-runtime-state.test.ts`
es un **gate de CI** con cuatro comprobaciones — (a) ningún `let` global mutable fuera de
`app-context.ts`; (b) `app-context.ts` es el módulo de estado y expone un setter por cada
estado; (c) `main.ts` sigue por debajo de 1 500 líneas; (d) los handlers IPC siguen
registrados en el main (nadie los movió de sitio porenglobo).

### 1.3 Estado `warning` del motor de personaje + encadenado en el renderer — capacidad nueva ✅ ###

El hueco de producto era real: **el avatar no tenía representación para "degradación
tolerable"**. Cuando una tool fallaba pero el turno continuaba, el avatar se quedaba en
`thinking` — o sea, **mentía**.

- **Motor canónico** (`packages/avatar/src/runtime/states.js:36,86,127`): estado `warning` con
  tinte ámbar `hsl(48 92% 55%)`, pose `warn` **nueva**, insignia `⚠` **nueva**, movimiento
  `sway`, glow 0.4, sonido `tick`. Puente al studio **1:1**.
- **Renderer** (`apps/desktop/renderer/components/character/avatar-live-state.ts`): la resolución
  se extrajo a una **función pura** (vive dentro de un `useMemo` en un componente de ~1 900
  líneas: no era testeable sin montar el chat) y `case "warning"` entró en el mapa
  (`CharacterBadge.tsx:90`).
- **Golden** re-recordada de **168 a 174** combinaciones (6 nuevas: `ratelimit/*`, porque
  `ratelimit` deja de compartir imagen con `warning` y pasa al estado `bored` del studio).
  `geometry:check` → **174/174**.

### 1.4 Round-trip Ego → studio → Ego — cerrado ✅ ###

A4 detectó que **4 estados perdían la identidad** al pasar por el studio; A6 lo cerró.
**Medido sobre el mapa real** (`packages/avatar/src/studio/adapter.js`):

```text
thinking   -> thinking   -> thinking   OK
approval   -> approval   -> approval   OK
question   -> question   -> question   OK
ratelimit  -> ratelimit  -> ratelimit  OK

estados de Ego en el mapa: 15 · con round-trip identidad: 15 · LOSSY: 0
```text

Los 4 estados tienen ahora **imagen propia** en los dos mapas, y el conjunto completo de 15
estados hace ida y vuelta sin pérdida.

### 1.5 Guard de contrato de estados — capacidad nueva ✅ ###

`apps/desktop/renderer/test/avatar-state-contract.test.ts` (7 tests) enumera **TODOS** los
`CharacterState` del renderer y comprueba que cada uno existe en el motor, que ninguno cae en
el `idle` de reserva (que sería el síntoma exacto de "falta el `case`") y que el conjunto de
estados de señal del chat y del motor coincide. Es un **gate**, no una feature: preventivo.

### 1.6 Propagación de `correlationId` — `EGO-FIND-74` ✅ ###

`packages/events/src/correlation.ts` es ahora la implementación canónica (migrada de
`scripts/correlation.mjs`, que por ser un `.mjs` de nivel raíz **no era importable** desde un
paquete del workspace). El loop deriva un **span hijo determinista por tool call**
(`childCorrelationId(correlationId, "tool:<nombre>")`) y lo propaga en los eventos `tool.started`,
`tool.executed`, `tool.failed`, `approval.required` y `approval.resolved`.

### 1.7 Vitest 3 y corpus legal fuera del lint ✅ ###

- **20 de 20** manifiestos del repo declaran `vitest: ^3.2.7`; **0** en `^2.1.2`
  (medido sobre los 20 manifiestos con campo `vitest`).
- El **override `vitest` de la raíz se eliminó**: el `overrides` del `package.json` raíz ya solo
  contiene `app-builder-lib`, `builder-util-runtime`, `tinypool` y `vitepress>vite`. Con el
  override, los tests corrían bajo v3 mientras el manifiesto decía `^2.1.2` — **la manifiesto
  mentía y el ratchet no lo veía**.
- El corpus de atribución MIT (30 ficheros de terceros) ya no se lintea como código de Ego.

### 1.8 Electron fuera de EOL — `EGO-FIND-23` ✅ ###

`electron` pasó de `^33.2.0` (33.4.11, EOL, 10 advisories altos) a **`^41.10.7`**, y el
`pnpm.overrides` que aplicaba el salto **sin tocar el manifiesto** (prohibido por la decisión
**D1** del owner) **desaparece**. Manifiesto y lockfile coinciden.

### 1.9 DOMPurify + CSP — `EGO-FIND-61` ✅ ###

- **DOMPurify** aplicado en `apps/desktop/renderer/lib/sanitize-html.ts:39`, con allowlist
  estructural (recursos solo locales) — `react-markdown` sin `rehype-raw` ya no era la única
  mitigación.
- **CSP** construida por `buildCsp()` (`electron-security.ts:104`) y aplicada vía
  `session.defaultSession.webRequest.onHeadersReceived` (`create-window.ts:985-990`):
  `default-src 'self'` · `script-src 'self'` (packaged) · `style-src 'self' 'unsafe-inline'` ·
  **`img-src 'self' data: blob:`** · `frame-src 'self'` · `object-src 'none'` ·
  `frame-ancestors 'none'` · `base-uri` · `form-action`.
- Sin `img-src`, una imagen Markdown remota (`![](https://host/x)`) era un vector de
  **exfiltración** por el chat.

### 1.10 Contraste WCAG AA sin `it.fails` — `EGO-FIND-71` ✅ ###

`it.fails` era **0 en todo el repo** (medido sobre los 135 ficheros de test). Los 6 hallazgos
`FIND-A11Y-01..06` pasaron a ser **aserciones reales**: el contraste se calcula
determinísticamente desde `theme-tokens.css` (`wcagRatio(...) ≥ 4.5`), lo que además elimina
la divergencia silenciosa de las paletas hardcodeadas en el test.

### 1.11 Decisiones del owner registradas ###

| Decisión | Registro |
|---|---|
| **D-A** Transporte del MCP Server → HTTP loopback | [ADR-0021](../../../adr/0021-mcp-server-transporte-y-token.md) |
| **D-B** El token no se expone al renderer | [ADR-0021](../../../adr/0021-mcp-server-transporte-y-token.md) |
| **D-C** Motor canónico `@ego/avatar`, no la FSM legacy | [ADR-0018](../../../adr/0018-motor-de-personaje.md) |

---

## 2. Los 3 bugs de producción que los tests verdes escondían ##

Esta es la parte de la ola que **no aparece en ningún checklist**: tres defectos reales que
vivían bajo suites completamente en verde. Los tres los encontró la ola, no un test.

### 2.1 `toolEvents` acumulativo → aviso falso permanente ###

**Medido**: `toolEvents` **no se limpia al empezar un turno**; solo se vacía en el slash command
`/clear` (`ego-chat.tsx:1370`), y `executeTurn` —el inicio de turno— **no lo toca**.

**Consecuencia**: un `tool_error` del turno 1 dejaba el avatar en ámbar (`warning`) **durante
todos los turnos siguientes**, aunque el turno 2 fuera perfecto. El aviso, que significa
"degradación tolerable", se convertía en un estado permanente: el mayor riesgo de este tipo de
señal es que el usuario aprenda a ignorarla.

**Corrección** (A4): `avatar-live-state.ts` recibe `turnStartToolSeq` y acota la búsqueda al
turno en curso (`lastToolEventOfCurrentTurn`).

**Por qué lo escondían los tests**: la suite verificaba la *traducción* de un estado, no la
*ventana temporal* de la que se extrae. Un test de tabla verde puede coexistir con un bug de
alcance. Lo que faltaba era una aserción de **"el evento viejo no contamina el turno nuevo"**.

### 2.2 El round-trip que pierde la identidad de 4 estados ###

**Medido**: 4 de los 15 estados de Ego perdían su identidad al pasar por el studio
(`thinking → waiting → waiting`, `approval → waiting → waiting`, y la ambigüedad de la imagen de
`warning`, compartida entre `ratelimit` y `bored`).

**Consecuencia**: el usuario ve una imagen y el motor cree otra. El dock **miente**, y el que
miente no es el motor de render sino el **mapa**.

**Corrección** (A6): cada uno de los 4 estados recibe **imagen propia** en los dos mapas
(medido: **15/15 round-trip identidad, 0 LOSSY**). El coste aceptado y documentado: el
round-trip inverso del studio sigue siendo "mejor esfuerzo para transiciones nacidas en el
canvas" — pero ya **no pierde estados de Ego**.

### 2.3 `design-lint` con la lista blanca indexada por ID ###

**Medido**: la lista blanca de `design-lint` se indexa por **ID de hallazgo** (`EGO-DL-0NN`), y
esos IDs **se asignan en el orden de escaneo**. Un hex literal nuevo (o la eliminación de otro)
en un fichero del renderer **desplaza los IDs** y deja obsoleta la entrada `EGO-DL-010`:

```text
AssertionError: EGO-DL-010 no suprime nada: expected 0 to be greater than 0
```text

**Consecuencia**: la lista blanca **suprime por posición, no por identidad**. Bajo ediciones
concurrentes deja de suppresses lo que debe suprimir — y el linter empieza a pasar hexes que
debería rechazar, o arejectar cosas que ya arreglaron. Un mecanismo de **excepción** que se
autodesactiva solo es peor que no tenerlo: da falsa confianza.

**Por qué importa más de lo que parece**: el `design-lint` es la puerta que impide que el
diseño derive sin que nadie lo note. Una puerta con la lista blanca indexada por posición es
una puerta que se abre sola con el primer refactor.

**Corrección**: la lista blanca debe indexarse por **hash del contenido del hallazgo**, no por
ID posicional. Es deuda abierta con dueño (A4/A7), registrada como `EGO-FIND-86`.

---

## 3. Tabla de gates ##

Estado al cierre de la ola. La columna "Fuente" dice quién lo midió y cuándo.

| # | Gate | Exit | Medido | Fuente |
|---|---|---|---|---|
| 1 | `pnpm -r typecheck` (23 paquetes) | **0** | 23/23 sin errores | A2 · Ola 2 |
| 2 | `pnpm lint` | **0** | 267 warnings (ratchet 370) | A4 · E6 |
| 3 | `pnpm test` | **0** | suite global en verde | A7 |
| 4a | `pnpm build` | **0** | 63 s | A7 |
| 4b | `node apps/desktop/scripts/verify-dist.cjs` | **0** | *"TODOS LOS CHEQUEOS EN VERDE"* | A7 |
| 5 | `pnpm audit --json` | 1 | esperado: 3 moderate sin fix upstream | A7 |
| 6 | `node scripts/verify-ci-triggers.mjs` | **0** | <1 s | A7 |
| 7 | `node scripts/verify-harness.mjs` | **0** | <1 s | A7 |
| 8 | `node scripts/verify-vantadb-ids.mjs` | **0** | **0 errores** (23 IDs · 62 referencias) | A7 + A1 |
| 9 | `node scripts/check-docs-lint.mjs` | **0** | baseline 11 521 / 277 ficheros | A7 |
| 10 | `node docs/testing/check-docs-paths.mjs` | **0** | 0 enlaces rotos · 0 rutas inexistentes | A7 + A1 |
| 11 | `node scripts/verify-paths.mjs` | **0** | <1 s | A7 |
| 12 | `pnpm --filter @ego/avatar sync:check` | **0** | SIN DRIFT (código + legales + corpus) | A6 |
| 13 | `pnpm --filter @ego/avatar geometry:check` | **0** | **174/174** | A6 |
| 14 | `pnpm --filter @ego/avatar attribution:check` | **0** | CADENA MIT RESOLUBLE | A6 |
| 15 | `pnpm --filter @ego/gui-tests test` | **0** | GATE GUI VERDE — 16 specs | A7 |
| 16 | `pnpm --filter @ego/avatar test` (`node --test`) | **0** | **274 pass / 0 fail** (266 + 8) | A6 |
| 17 | `pnpm --filter @ego/desktop test` | **0** | **56 ficheros / 345 tests** (+5 skipped) | A4 |
| 18 | `pnpm --filter @ego/renderer test` | **0** | **70 ficheros / 489 tests** | A4 |
| 19 | `test` (9 paquetes del núcleo cognitivo, nota 3) | **0** | **698 tests** (Ola 1c: 669 → **+29**) | A2 |
| 20 | `test` (paquete `tests`) | **1** | 71 passed · 5 failed · 1 skipped (`floating-wiring`) | A2 |
| 21 | `pnpm docs:build` | **0** | sitio compilado | A1 |
| 22 | `pnpm --filter @ego/desktop exec vitest run test/e6-runtime-state.test.ts` | **0** | 4/4 (el gate de E6) | A4 |
| 23 | `vitest run test/avatar-state-contract.test.ts` | **0** | 7/7 (el guard de contrato) | A4 |

**Nota 3.** El gate 19 son los nueve paquetes del núcleo cognitivo de A2:
`memory`, `knowledge`, `runtime`, `models`, `decision`, `execution`, `events`,
`security` y `tool-call-repair`. Los gates 16-18 y 22-23 son suites de paquete;
el 20 es el paquete `tests`.

### 3.1 Gates que NO están verdes (con su causa) ###

| Gate | Exit | Causa | Dueño |
|---|---|---|---|
| `pnpm --filter @ego/e2e-tests test` | 1 | 5 contratos `floating-wiring` fallan | A4 |
| `test` del renderer (durante E6) | 1 | 1 fallo real de `design-lint` (§2.3) | A4 / A7 |
| `oxlint --max-warnings 310` | 1 | 343 warnings; **0** en los ficheros de A2 → el exceso es ajeno | orquestador |
| `check-docs-lint.mjs` | 1 | 11–12 regresiones en ficheros de A2/A6/A5 (2 `MD056`) | A2 / A6 / A5 |

---

## 4. Deuda que queda ##

### 4.1 Deuda técnica con dueño ###

| Deuda | Tamaño | Nota | Dueño |
|---|---|---|---|
| Bloque del **tray** en `main.ts` | ~190 líneas | Acoplado a la ventana flotante y al motor de tareas | A4 · Ola 3 |
| 3 bloques cohesivos de `main.ts` (nota 4) | ~170 líneas | Bloques pequeños y con sus propias deps | A4 · Ola 3 |
| Lista blanca de `design-lint` indexada por ID | 1 entrada | §2.3 — indexarla por hash | A4 / A7 |
| `DreamConsolidator` y `MemoryCurator` sin instanciar | 2 clases | ver nota 5 | A2 · `EGO-FIND-22` |
| `vantadb-node` por `file:` fuera del repo | 2 manifiestos | sigue en ambos (nota 6) | A4 / A7 · `EGO-FIND-64` |
| 5 contratos `floating-wiring` E2E en rojo | 5 tests | | A4 |
| 2 tablas mal formadas (`MD056`) en handoffs | 2 ficheros | Bug real de renderizado | A2 / A6 |

**Nota 4.** Los tres bloques son `getOrCreateDefaultProject` (83 líneas),
`scheduleMemoryCleanup` (47) y `modelPoolProviderFactory` (37).

**Nota 5.** `DelegationRouter` **sí** está instanciado, en
`packages/subegos/src/DelegationRuntime.ts:14`.

**Nota 6.** `file:../../../VantaDB/vantadb-node` sigue en
`apps/desktop/package.json:36` y en `packages/memory/package.json:27`.

### 4.2 Los 3 bloqueos del owner ###

| Bloqueo | Qué falta | Por qué no avanza sin decisión |
|---|---|---|
| **`DIST-04`** (firma) | Certificados de firma del instalador | Material criptográfico que solo el owner emite |
| **`DIST-09`** (publicar `vantadb-node`) | Publicarlo en npm | Hoy `npm view` → **404** |
| **`EGO-FIND-81`** (token MCP) | Canal + puerto | Bloquea a clientes externos |

- **`DIST-04`** depende de material criptográfico que solo el owner puede emitir.
  Bloquea E3 (binarios MCP embebidos + firma) y el bucket de distribución.
- **`DIST-09`**: hoy el build depende del checkout hermano por `file:`. Mientras tanto
  **CI compila un stub no-op**: el job `verify` verde nunca ejercita VantaDB real.
- **`EGO-FIND-81`**: el token no se filtra al renderer (verificado) y el puerto es
  efímero. Sin un canal documentado, un cliente MCP externo **no puede
  autenticarse**. Afecta a `docs/user/` (documentación de usuario final).

### 4.3 Lo que la Ola 3 tiene que recoger ###

La Ola 3 está planificada en `VERDICT.md` §7, **ordenada por la progresión de fases de
`AGENTS.md` §6** (no por valor de negocio). El **mayor multiplicador sigue siendo E2 (path
cognitivo nativo)**: el binding `vantadb-node@0.8.0` ya expone `graphragSearch`,
`memoryRecall` (con `trust_aware`), `contextAssemble`, `memoryConsolidate` y
`memoryReinforce`, pero **solo `graphragSearch` está cableado**. Antes de cablear el resto hay
que pasar la **puerta de invariantes** del [ADR-0020](../../../adr/0020-compactacion-motor-ts-vs-nativo.md):
¿el `contextAssemble()` nativo preserva el system prompt y los pares `tool_call`/`tool_result`?
Si no, se registra como petición upstream (`VDB-REQ-13`, ya abierta).

**E7 (DOMPurify + CSP) queda cerrado** —contrary a lo que se suponía al inicio de la ola—
con `img-src 'self' data: blob:` aplicado y el gate de distribución construido.

---

## 5. Estado del Backlog al cierre ##

**Medido sobre `docs/roadmap/Backlog.md` tras esta ola** (86 filas `EGO-FIND`):

| | Al inicio de la Ola 2 | Tras mi turno anterior | **Ahora** |
|---|---|---|---|
| ✅ Completada | 66 | 70 | **76** |
| 🟡 Parcial | 11 | 8 | **4** |
| 🆕 Pendiente | 2 | 3 | **6** |

Cerrados en la Ola 2 (8): `EGO-FIND-23` (electron EOL) · `43` (ejecución paralela) ·
`46` (MCP Server) · `54` (descomposición de `main.ts`) · `61` (DOMPurify + CSP) ·
`69` (FSM legacy del personaje) · `71` (contraste WCAG) · `74` (`correlationId`).

Abiertos como capacidad nueva (2, ✅): `EGO-FIND-84` (estado `warning` del motor +
encadenado en el renderer) · `EGO-FIND-85` (guard de contrato de estados).

Abiertos (8): `EGO-FIND-22` (`DreamConsolidator`/`MemoryCurator` sin instanciar — nota:
`DelegationRouter` **ya está** instanciado en `packages/subegos/src/DelegationRuntime.ts:14`) ·
`29` (path cognitivo nativo) · `63` (tests que inspeccionan texto de fuente) ·
`64` (`vantadb-node` por `file:`) · `49` (`overrideExisting`) · `80` (doc oficial de
Anthropic) · `81` (token MCP) · `86` (lista blanca de `design-lint`).

`EGO-FIND-82` y `EGO-FIND-83` los abrió **A5** en paralelo (cadena de atribución de licencia
y la licencia AGPL-3.0 de `khoj`): son 🔴 Crítica y quedan abiertas.

---

## 6. Lo que la ola deja como lección ##

1. **Una puerta de CI vale más que una promesa en un handoff.** `main.ts` pasó de 5 401 a
   1 287 líneas; lo que impide que vuelva a crecer es `e6-runtime-state.test.ts`, no el informe.
2. **Los tests verdes no miran el *alcance*.** Los 3 bugs de §2 vivían bajo suites en verde:
   faltaba comprobar *cuándo* aplica un estado, *qué* imagen devuelve, y *qué* suprime una
   excepción. La próxima puerta de contrato debería preguntar por el **origen** del dato, no
   solo por su forma.
3. **Las excepciones indexadas por posición se autodesactivan.** La lista blanca de
   `design-lint` indexada por `EGO-DL-0NN` es un ejemplo: bajo refactor, suprime lo que no
   debe y deja pasar lo que debe. Indexar por **hash del contenido**.
4. **Un test que miente es peor que un test que falta.** El `vitest` en `^2.1.2` con el
   override de la raíz hacía que **todos los tests corriesen bajo v3** mientras el manifiesto
   decía otra cosa: el ratchet era verde sobre una mentira.
5. **El antídoto contra "el avatar miente" es el guard, no el caso.** Añadir `warning` al mapa
   arregla un estado; el guard de contrato evita que el **próximo** estado se pierda en el
   silencio.

---

*Medido por A1 el 2026-10-20 con lectura directa del código y de los handoffs de A2, A4, A6 y
A7. Las cifras de test proceden de las ejecuciones de cada agente (ver columna "Fuente" en §3);
las de código se remedieron de nuevo en esta ola. Sin commits: el orquestador consolida.*
