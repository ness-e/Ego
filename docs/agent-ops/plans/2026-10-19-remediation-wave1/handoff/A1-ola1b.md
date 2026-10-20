# Handoff A1 (Ola 1b) — 2026-10-20 #

> **Agente:** A1 (documentación canónica, ADRs, Backlog)
> **Ola:** 1b — reasignaciones `R7`–`R12` y `R17` de
> [`VERDICT.md` §4.2](../VERDICT.md), más el cierre documental de `EGO-FIND-18..79`.
> **Plan:** `docs/agent-ops/plans/2026-10-19-remediation-wave1/A1-docs.md` (T1–T9)
> **Zona:** `docs/index.md`, `docs/adr/**`, `docs/roadmap/**`, `docs/PLAN-EGO.md`, `AGENTS.md`,
> `docs/engineering/**`, `docs/product/**` (salvo los 3 de A6), `docs/architecture/**`
> (salvo `character-system.md`), `docs/user/**`, `docs/deployment/**`, `docs/operations/**`,
> `docs/testing/**`, `docs/design/**`, `docs/references/**`, `docs/changelog.md`,
> `docs/.vitepress/**`, `docs/agent-ops/**`, `docs/research/README.md`,
> `docs/dev/e2e-skip-inventory.md` (transferido por A7 en la Ola 1).

---

## Cambios aplicados (ficheros propios) ##

### B1 — ADR 0018: motor de personaje (`R10`) ###

- `docs/adr/0018-motor-de-personaje.md` (**nuevo**) — texto entregado por A6
  (`handoff/A6.md:181-274`) sobre la plantilla canónica (§Contexto/§Alternativas/§Decisión/
  §Consecuencias/§Referencias), con la decisión del owner **D5** (tres copias mantenidas,
  canonicidad en la Ola 2) y el estado real de `CharacterEngine` (tipos + `hexToRGB`).
- `docs/adr/0018-motor-de-personaje.md` — cifras **verificadas por mí**, no copiadas:
  `packages/avatar/src` = 47 ficheros `.js` (A6 decía 49), 11 203 líneas.

### B2 — ADR 0019: canal dual + taint tracking (`R7`) ###

- `docs/adr/0019-canal-dual-taint-tracking.md` (**nuevo**) — símbolos **verificados con grep**
  antes de citarlos: `DATA_CHANNEL_OPEN/CLOSE/WARNING`, `ChannelSplit`, `isTainted`,
  `splitChannels`, `assembleTrustedPrompt`, `TaintFilterResult`,
  `filterTaintedForDestructiveAction`, `markUntrusted` (`packages/runtime/src/TrustBoundary.ts`);
  `CONTROL_TAGS` (11 tags), `INJECTION_PATTERNS`, `UntrustedContentSanitizer.inspectContent/
  wrapUntrustedContent/neutralizeControlTags` (`packages/memory/UntrustedContentSanitizer.ts`);
  `taintedDestructiveGuard` y el evento `hook.decided` con
  `hookId: "trust-boundary:untrusted-content"` (`packages/runtime/src/ToolExecutionLoop.ts:500-522`).
- El ADR explica por qué implementa la §11.2 del documento maestro y declara explícitamente
  que **DOMPurify/CSP `img-src` no los cubre** (son del ámbito del DOM, no del prompt).

### B3 — Reconciliar `memoria-vantadb.md` y `namespaces.md` (`R8`, `R9`) ###

- `docs/architecture/memoria-vantadb.md:190-196` — §10 **reescrito**: la afirmación
  *"Ego no construye su propio algoritmo heurístico de poda de tokens en TypeScript"* era
  **falsa**; ahora hay tabla de los **dos motores** (TS propio `ContextCompaction.ts` ✅
  cableado · `contextAssemble()` nativo `vantadb-node@0.8.0` ⏸️ sin callsite) con la
  recomendación de A2 (migrar al nativo, conservar el TS como fallback offline) y la
  deuda de Ola 2 · E2.
- `docs/architecture/memoria-vantadb.md:38-44` — el matiz que separa *"lo que el motor de
  VantaDB puede hacer"* de *"lo que Ego consume hoy"*.
- `docs/architecture/memoria-vantadb.md:118-136` — **nuevo §3 bis "Aviso: búsqueda híbrida —
  ¿qué es realmente *true*?"** con la tabla Fast Path (BM25 léxico, `query_vector: []` por
  `VDB-REQ-02`, re-rank mono-lista, MMR de coseno **léxica**, **sin RRF**) vs Cognitive Path
  (`graphragSearch`, `memoryRecall`, `contextAssemble`, `memoryConsolidate`, `memoryReinforce` —
  `vantadb-node@0.8.0 index.d.ts:603-636`; solo el primero tiene callsite).
- `docs/architecture/memoria-vantadb.md:319` — la matriz de responsabilidades marca la
  búsqueda híbrida como **parcial** (no "Consume" a secas).
- `docs/architecture/namespaces.md:48-58` — **nueva nota** con la misma distinción
  fast path / path cognitivo.
- Correcciones adicionales en la misma clave, por coherencia (mismo defecto, misma verdad):
  `docs/engineering/stack-tecnico.md:35` (la línea "Híbrida RRF"),
  `docs/architecture/ciclo-memoria-unificado.md:55,91` (diagrama y "usando RRF"),
  `docs/product/modulos.md:52` ("`hybrid search` (RRF)"),
  `docs/product/definicion-soc.md:16` ("híbrida RRF"),
  `docs/roadmap/Backlog.md:30,276,284,297` (Fase 06 y `KB-04`),
  `docs/research/README.md` (las dos líneas de RRF y de PTY).
- **Corrección de premisa:** la tarea decía que `namespaces.md` afirmaba *"knowledge ←
  búsqueda híbrida RRF"*. **Esa frase no existe** en `namespaces.md` (0 coincidencias de
  "RRF"); la afirmación equivalente estaba en `memoria-vantadb.md`, `stack-tecnico.md`,
  `ciclo-memoria-unificado.md`, `modulos.md`, `definicion-soc.md` y el Backlog — las he
  corregido **todas**.

### B4 — Cerrar los findings resueltos en el Backlog (`R11` + 62 filas) ###

- `docs/roadmap/Backlog.md` — **62 filas `EGO-FIND-18..79`** actualizadas con el estado real
  y **evidencia verificable** (`fichero:línea` o test) añadida a la columna `Descripción`.
  Resultado: **66 ✅ Completada · 11 🟡 Parcial · 2 🆕 Pendiente** (`43`, `49`).
  `EGO-FIND-48` lo cerró A4 con la reasignación `R3` durante la Ola 1b
  (0 ramas `domainId === "..."` en `DomainCanvasView.tsx`).
  - **NO inventé cierres**: `EGO-FIND-43` y `EGO-FIND-61` quedan **abiertos/parciales**,
    tal como pide la instrucción.
  - 11 filas quedan **🟡 Parcial** con la parte que falta escrita: `22`, `23`, `29`, `46`,
    `54`, `61`, `63`, `64`, `69`, `71`, `74`.
- `docs/roadmap/Backlog.md:42,44,45` — las **3 correcciones de wording de A5**
  (A5-S1 hot-reload/file watcher → "descartados con justificación";
  A5-S2 "PTY" → "terminal 16 KB/tick (sobre pipes) / ring-buffer 2 MB";
  A5-S3 "coseno" → "umbral de similitud (`ScoreThresholdFilter`)").
- `docs/roadmap/Backlog.md:317` — compuerta `OCLW-15`: `✅ Asimilada` → `✅ Completada` con
  evidencia (`packages/tasks/src/TaskCheckpoint.ts` → `main.ts:52,211,768`) — es la parte
  viva de A5-S4; `OCLW-16`/`OCLW-17` **no** tienen fila en la matriz del maestro (A5 ya
  las marcó como descartadas en su propio backlog).
- `docs/roadmap/Backlog.md` — corregidas 2 rutas inexistentes que mis propias evidencias
  introdujeron (`scripts/check-gui-coverage.cjs` → `tests/gui/scripts/…`;
  `scripts/debt-baseline.json` → "se genera con `pnpm audit:debt:baseline`").

### B5 — `AGENTS.md`: excepción de tipado del avatar (`R12`) ###

- `AGENTS.md:180-213` — **nueva sección §4 "Excepción de tipado: el motor de personaje
  (`packages/avatar`) es JavaScript plano"**: qué es (47 ficheros `.js`, 11 203 líneas,
  `index.d.ts` de 380 líneas, `allowJs`+`checkJs`, `strict: false`), **por qué** (port de un
  repo externo; migrarlo es un proyecto propio), **qué NO se relaja** (el resto del
  monorepo sigue estricto; no habilita `any` en código de Ego), las **5 puertas** que la
  sostienen y la **condición de cierre**.
- Verificado antes de escribir: `pnpm --filter @ego/avatar typecheck` → **exit 0**
  (`tsc -p tsconfig.json`, ya no es un no-op) y `pnpm --filter @ego/avatar build` → **exit 0**
  (50 ficheros en `dist/`).

### B6 — `docs/design/DESIGN.md` ###

- `docs/design/DESIGN.md` (**nuevo**) — ficha de producto del design system:
  §1 por qué OKLCH · §2 las **4 paletas** (valores **verificados contra
  `theme-tokens.css`, no copiados del handoff**) + rampa de superficie L0-L3 + §3 el
  **contrato de contraste WCAG 2.2** con sus umbrales y el estado de la deuda FIND-A11Y ·
  §4 la **tabla de primitives** del `ui-kit` (7 filas, con el motivo D3 de cada una) y
  **§4.1 las 4 primitives ad-hoc** (combobox, dropdown, popover, tooltip) con su decisión
  y el paquete que necesitan · §5 estado por superficie · §6 referencias.
- `docs/design/design-system.md:9` — la cabecera apunta a `DESIGN.md` como documento
  complementario (sin duplicar fuentes de verdad).

### B7 — `docs/research/README.md` + índice (`R17`) ###

- `docs/research/README.md` — **hub reescrito**: inventario del directorio (7 ficheros con
  su estado), el aviso de que **nada de `docs/research/` es normativo**, la entrada de
  **`arquitectura-master-matrix.md`** (matriz de contraste de las 22 secciones, verificada
  por A8) y la del **documento maestro marcado como "research externo — NO normativo"**
  con su remisión a ADR-0011. Correcciones de las dos líneas factualmente incorrectas (RRF y
  PTY).
- `docs/index.md` — **19 ADRs** (0018 y 0019 añadidos) · `design/DESIGN.md` ·
  `research/arquitectura-master-matrix.md` · `agent-ops/reports/reviews/` con los dos
  informes · `agent-ops/plans/2026-10-19-remediation-wave1/`.

### B7-bis — `docs/adr/README.md` (índice de ADRs) ###

- `docs/adr/README.md` (**nuevo**) — índice de las 19 decisiones con **estado** (Aceptado /
  Superseded / parcial) y **nivel jerárquico**; qué es un ADR, cuándo escribirlo y su
  ciclo de vida (`PROPOSED → ACCEPTED → SUPERSEDED | DEPRECATED`).
  Necesario: el hub de research enlazaba `docs/adr/` como directorio y VitePress lo
  resolvíaba como `../adr/index` → **enlace muerto** en el build del sitio.

### B7-ter — El build del sitio, roto por un tercer `{{` (fix estructural) ###

- `docs/.vitepress/config.mts` — **regla `EGO-VUE-INTERPOLATION`** en `markdown.config`:
  el sitio compila cada `.md` como plantilla Vue, así que un `{{` literal
  (p. ej. `{{SECRET:clave}}`) **rompe el build** con
  `vite:vue → "Did not expect a type annotation here"`. Ya había pasado dos veces en la
  Ola 1; esta vez lo disparó `docs/research/arquitectura-master-matrix.md` (A8) y
  `docs/extractions/swe-agent.md` (A5).
- La regla escapa el `{{` de apertura en el HTML final del Markdown
  (`&#123;&#123;`): el navegador lo decodifica a `{{` **después** de que Vue haya analizado
  la plantilla → se ve literal y no se interpola. Solo se escapa la apertura: un `}}`
  suelto es texto inocuo para Vue. Los documentos de Ego son Markdown plano (no usan
  interpolación Vue legítima), así que el escape no pierde información.
- **Consecuencia**: `research/Arquitectura*.md` (el research externo) **vuelve a
  publicarse** en el sitio — ya no hace falta excluirlo, que era el motivo original de la
  exclusión.
- Efecto: `pnpm docs:build` → **exit 0** con las rutas de research publicadas.

### B8 — `docs/dev/e2e-skip-inventory.md` ###

- `docs/dev/e2e-skip-inventory.md` — **reescrito con el estado real medido**:
  18 skips (antes decía 22) · **11** bloques `describe.skip` (antes decía 13) · 3 specs
  activos (`14-visual`, `floating-full`, `floating-island`) · la **taxonomía en el código**
  (el título de cada skip lleva ya "Clase B") · `tests/gui` en el workspace · el job `gui`
  **ejecuta pero no reactiva** · **§1.1 el cambio de contrato del E2E Electron**
  ("minimize sin trabajo → **aparece** la isla y se auto-oculta al restaurar"; el gate
  `shouldAutoShow` quedó derogado por `d50a050`) · **§4 el procedimiento para reactivar** un
  skip de Clase B.
- Tabla maestra con las líneas reales (los guards de Electron están en `:105`/`:110`/`:224`
  y `:54`/`:59`, no en `:69`/`:74`/`:189`).
- §3.3 reescrita: con las paletas ya en OKLCH, modularizar `dim`/`border-strong` es más
  barato y el harness `ThemeTokensOklch.test.tsx` permite hacerlo con **RED primero**.

### B9 — Informe de cierre + registro ###

- `docs/agent-ops/reports/reviews/remediation-wave1-2026-10-19.md` (**nuevo**) — qué se
  cerró por bloque con evidencia, **las 17 reasignaciones `R1..R17`** con su estado, los
  **14 hallazgos no cerrados** (3 abiertos + 11 parciales, con lo que falta en cada uno),
  la tabla de verificación (9 puertas con exit) y la conclusión (el riesgo residual es
  `E6`; la brecha más urgente es `E7`).
- `docs/agent-ops/reports/INDEX.md` — **registrados los dos informes** con el formato
  `fecha | tipo | modo | veredicto | archivo | estado`, más un resumen del cierre.

### B10 — Changelog ###

- `docs/changelog.md` — entrada de la Ola 1 completa (Added/Changed/Fixed) y **declaración
  explícita** de que el `CHANGELOG.md` raíz (fuera de mi zona) queda pendiente.
- `docs/user/changelog.md` — versión **amigable** de la misma entrada, con una sección
  **Migración** real (los `<select>` nativos ahora son un componente accesible; el tema ya
  no sigue al SO).

---

## Solicitudes fuera de zona (NO aplicadas) ##

| # | Fichero | Cambio pedido | Motivo | Bloqueante |
|---|---|---|---|---|
| 1 | `CHANGELOG.md` (raíz) | Añadir la entrada de la Ola 1. **Texto literal** en `docs/changelog.md` §`[Unreleased]` (secciones Added/Changed/Fixed, 22 viñetas). Yo actualicé los **dos espejos** (`docs/changelog.md` y `docs/user/changelog.md`) y declaré en ambos que la raíz manda; el bloque de texto es el que hay que copiar. | Raíz fuera de mi zona. Sin esto, `docs/changelog.md` deriva de la fuente canónica. | No |
| 2 | `apps/desktop/package.json` + `package.json` (raíz) | **`electron`: quitar el `pnpm.overrides` y subir el manifiesto.** Hoy el manifiesto declara `electron: ^33.2.0` y el salto a 41.10.7 se aplica por `pnpm.overrides` — que la decisión **D1 del owner prohíbe explícitamente** ("No apliques `pnpm.overrides` para congelar Electron"). Cambio: `apps/desktop/package.json` → `"electron": "^41.10.7"` y eliminar la entrada `"electron"` de `pnpm.overrides` en el `package.json` raíz. | `package.json` raíz es de A7; el manifiesto de `apps/desktop` es de A4. Cierra `EGO-FIND-23` (🟡 → ✅). | No |
| 3 | `apps/desktop/package.json` + `packages/memory/package.json` | **Aplicar el diff de `vantadb-node`** (A7 ya escribió el script y el diff exacto): `"vantadb-node": "file:../../../VantaDB/vantadb-node"` → `"file:../../vendor/vantadb-node/vantadb-node-0.8.0.tgz"`, en los **dos** manifiestos, y versionar el tarball. | `git diff` de ambos manifiestos está **vacío** → el cambio propuesto por A7 (T7) **no se aplicó**. Cierra `EGO-FIND-64` (🟡 → ✅). Manifiestos de A4 / A2. | No |
| 4 | `apps/desktop/src/main.ts` | **Instanciar `EgoMcpServer`** (`packages/integrations/src/mcp/McpServer.ts` existe y está testeado; **0 instanciaciones** en `src/`) e **inyectar el `secretResolver`** (keychain) en el `McpClient` (`McpClient.ts:81,118` ya lo soporta). | Reasignaciones `R1` y `R2` del VERDICT. Cierra `EGO-FIND-46` (🟡 → ✅). Falta decidir transporte (subproceso stdio vs. socket local). | **Sí** — falta la decisión de transporte (owner) |
| 6 | `packages/integrations/src/mcp/McpManager.ts:120` | Quitar `overrideExisting: true` o exigir `allowOverride` explícito por servidor, y **auditar** el override (hoy es un `console.warn`). | `EGO-FIND-49` (🆕). Un servidor MCP puede pisar tools nativas. | No |
| 7 | `apps/desktop/renderer/components/character/core/CharacterEngine.ts` | **Decidir el destino del último fichero legacy**: sobrevive solo por sus tipos (`RGB`, `EyeShape`) y `hexToRGB`. Archivar o absorber. | `R14`/`R15` ya las aplicó A4 (`CharacterCanvas.tsx` y `CharacterMiniBadge.tsx` **borrados**; la FSM reescrita como `state/character-state.ts`). Lo que queda es decisión del owner → `EGO-FIND-69` sigue 🟡. | **Sí** — decisión del owner |
| 8 | `apps/desktop/renderer/**` + `apps/desktop/src/main.ts` (CSP) | **DOMPurify** (1 dependencia + 1 línea en `shiki-highlight.tsx:188`) y añadir **`img-src`** a `buildCsp()` (`apps/desktop/src/main.ts:2665`). | Reasignación `R6` → **Ola 2 · E7**. Cierra `EGO-FIND-61` (🟡 → ✅). Es la última brecha de §11 del documento maestro. | No (dep nueva → A7) |
| 9 | `apps/desktop/renderer/test/` + `apps/desktop/test/` | 3 tests tautológicos que deben dejar de afirmar sobre texto de fuente: `apps/desktop/test/ipc-bridges-t13.test.ts` (4 asserts), `apps/desktop/renderer/test/ShikiOffload.test.tsx` (2), `apps/desktop/test/tasks-wiring.test.ts` (1). | Cierra `EGO-FIND-63` (🟡 → ✅). Detector de A7: `scripts/inventory-tautological-tests.mjs`. | No |
| 10 | `packages/runtime/src/ToolExecutionLoop.ts:387` | Ejecución **paralela** de tool calls con reordenamiento ordenado de los `tool_result`. | `EGO-FIND-43` (🆕). **Bloqueada por diseño**: Anthropic exige que cada `tool_result` siga en orden a su `tool_use`; un `Promise.allSettled` ingenuo rompe la API → **Ola 2 · E1**, con el orden como criterio de aceptación. | **Sí** — Ola 2 |
| 11 | `packages/runtime/src/TrustBoundary.ts` + `packages/events/src/` | **Cablear el `correlationId`**: A7 dejó `scripts/correlation.mjs` (`newCorrelationId`, `childCorrelationId` determinista) y el sink rotado, pero `correlationId` tiene **0 callsites** en `packages/` y `apps/`. | `EGO-FIND-74` (🟡 → ✅). | No |
| 12 | `packages/knowledge/src/HybridSearch.ts` + `packages/memory/EgoMemoryAdapter.ts` | **Path cognitivo nativo** (Ola 2 · E2): instanciar `contextAssemble` / `memoryRecall` / `memoryConsolidate` / `memoryReinforce` (binding `index.d.ts:603-636`, hoy 0 callsites). Además, decidir si el motor de compactación **nativo** sustituye al TS (decisión que A2 recomienda y que necesita ADR). | `EGO-FIND-29` (🟡 → ✅) y la deuda de §10 de `memoria-vantadb.md`. | **Sí** — Ola 2 + ADR |
| 13 | `apps/desktop/renderer/test/a11y.test.tsx` | Los **6 `it.fails`** de contraste (FIND-A11Y-01..06). Con las paletas ya en OKLCH, modularizar `dim` y `border-strong` por paleta es barato y el harness `ThemeTokensOklch.test.tsx` permite hacerlo con **RED primero**. | `EGO-FIND-71` (🟡 → ✅). | No |
| 14 | `apps/desktop/src/main.ts` | Descomposición restante: sigue siendo un god file con **79 handlers IPC** en 2 857 líneas. | `EGO-FIND-54` (🟡 → ✅). **Ola 2 · E6**, primera tarea estructural. | **Sí** — Ola 2 |
| 15 | `docs/extractions/{graphrag,mcp-servers}.md`, `docs/review/backlog-{claude-squad,crush,graphiti,mcp-servers,opencode}.md` | **31 regresiones de markdownlint** (MD003, MD013, MD040, MD056, MD004, MD022, MD001, MD038) detectadas por `node scripts/check-docs-lint.mjs`. Fix: headings en estilo `atx_closed` (`## Título ##`), fences con lenguaje, `*énfasis*` con espacio, `MD056` (columnas de tabla) y `MD013` en prosa (las filas de tabla no cuentan). | El gate de docs-lint **falla** por estos ficheros (ninguno es mío). Decisión de baseline: regenerar (`--write-baseline`) o corregir. | No |
| 16 | `docs/extractions/*.md` + `docs/review/backlog-*.md` | 32 patrones en limbo y 0 filas `🚫 Descartada (con justificación)` en las fichas (A5 lo resolvió en los backlogs, **las fichas siguen sin la marca**). | Guardrail duro de `AGENTS.md` §4. Zona de A5. | No |

---

## Verificación ##

| Comando | Exit | Resumen |
|---|---|---|
| `node docs/testing/check-docs-paths.mjs` | **0** | 337 docs escaneados · **0 enlaces rotos · 0 rutas inexistentes en docs canónicos** · 203 en worklogs (informativo) |
| `node scripts/check-docs-lint.mjs` | 1 | **0 regresiones de A1** · 31 de A5/A6/A7 (solicitud #15): `docs/extractions/{graphrag,mcp-servers}.md`, `docs/review/backlog-{claude-squad,crush,graphiti,mcp-servers,opencode}.md`. Violaciones actuales 12 922 vs base 12 781 → el delta es exactamente de los ficheros ajenos |
| `pnpm docs:build` | **0** | sitio VitePress compilado tras la regla `EGO-VUE-INTERPOLATION` (que rompe la clase de fallos "`{{` literal en Markdown") y la publicación del research externo |
| `pnpm --filter @ego/avatar typecheck` | **0** | `tsc -p tsconfig.json`, 0 errores (ya no es un no-op) |
| `pnpm --filter @ego/avatar build` | **0** | 50 ficheros → `dist/` + manifiesto SHA-256, "dist/ al día" |
| `pnpm --filter @ego/avatar test` | **0** | 266 pass / 0 fail (verificado por A6) |
| `pnpm --filter @ego/avatar sync:check` | **0** | SIN DRIFT entre el paquete y la copia vendorizada (SHA-256) |
| `pnpm --filter @ego/avatar geometry:check` | **0** | 168/168 combinaciones con traza idéntica a la golden |
| `pnpm test` | **0** | verde (verificado por el orquestador) |
| `pnpm lint` | **0** | verde (verificado por el orquestador) |
| Conteo final `EGO-FIND-18..79` | — | **66 ✅ Completada · 11 🟡 Parcial · 2 🆕 Pendiente** (`43` y `49`, los dos que el owner marcó como NO cerrados; `48` lo cerró A4 con la reasignación `R3` durante la Ola 1b) |
| `docs/adr/` | — | **19 ADRs** numerados `0001`–`0019`, 0 colisiones, todos en `docs/index.md` |

---

## Deuda / no resuelto ##

1. **7 de las 17 reasignaciones no son mías** (`R1`, `R2`, `R4`, `R5`, `R6`, `R13` y el resto
   de `R14`/`R15`) y 6 filas del Backlog dependen de ellas. `R3` y la parte ejecutable de
   `R14`/`R15` las aplicó A4 en paralelo durante la Ola 1b (verificado en el árbol de
   trabajo). Detalle exacto en §"Solicitudes fuera de zona".
2. **`EGO-FIND-43` y `EGO-FIND-61` no están cerrados**, tal como instruía la tarea. Sus filas
   lo dicen con la parte que falta, sin adornos.
3. **`EGO-FIND-23` y `EGO-FIND-64` quedan 🟡** porque la implementación existe pero **los
   manifiestos no se cambiaron** (`electron` por `pnpm.overrides` — prohibido por D1 —;
   `vantadb-node` sigue en `file:` fuera del repo). Solicitudes #2 y #3.
4. **El `CHANGELOG.md` raíz sigue sin la entrada** de la Ola 1 (solicitud #1). Actualicé los
   dos espejos y declaré la divergencia en ambos para que no sea silenciosa.
5. **El gate de docs-lint falla por 3 ficheros ajenos** (solicitud #15). No regeneré la
   línea base: eso decidiría si el corpus se reescribe o si la base se ajusta, y es
   decisión del orquestador/A7.
6. **La deuda MD013 sistémica** que reporté en la Ola 1 (2 518 líneas >120) la resolvió A7
   con un **gate de línea base** (`scripts/check-docs-lint.mjs`), no con un rewrite del
   corpus. Es la salida correcta y ya no está pendiente de mí.
7. **El ADR de compactación (TS vs. nativo)** sigue sin redactar: A2 recomienda migrar a
   `contextAssemble()` nativo y conservar el TS como fallback offline, pero la decisión es
   de Nivel 4 → requiere ADR (solicitud #12).

---

## Nota de estado del árbol ##

Working tree sucio y compartido con A2–A8 — **esperado por contrato** (README §5.5).
**No he hecho ningún commit, ni `git checkout/reset/stash/clean`, ni `pnpm install`.**
No he tocado `packages/**`, `apps/**`, `tests/**`, `.github/**`, `docs/extractions/**`,
`docs/review/**` ni `docs/research/**` (salvo `docs/research/README.md`, que la
reasignación `R17` me asignó).

> **Ficheros que `git status` atribuye a "A1" pero NO son míos:**
> `docs/architecture/character-system.md`, `docs/product/mascota.md` y
> `docs/product/character-art-direction.md` los reescribió **A6** en su Ola 1b
> (ahora citan `@ego-avatar`; +263/−56 líneas). A1 no los tocó: son de A6 por
> propiedad de ficheros.
