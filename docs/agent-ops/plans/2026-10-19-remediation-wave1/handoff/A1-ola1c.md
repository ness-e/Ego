# Handoff A1 (Ola 1c) — 2026-10-20 ##

> **Agente:** A1 (documentación canónica, ADRs, Backlog, registro de VantaDB)
> **Ola:** 1c — desbloqueo del gate mecánico de trazabilidad de IDs de VantaDB +
> cierre de las solicitudes que quedaron de la Ola 1b.
> **Plan:** `docs/agent-ops/plans/2026-10-19-remediation-wave1/A1-docs.md` (T1–T9)
> **Veredicto de la ola:** 🟡 PARTIAL — el gate que bloqueaba la ola está **verde**;
> quedan 14 de 17 reasignaciones de `R1..R17` en otras zonas.

---

## Cambios aplicados (ficheros propios) ##

### T1 — Registrar `VDB-REQ-10`, `VDB-REQ-11` y `VDB-REQ-12` (CRÍTICO) ###

- `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` — **3 entradas nuevas** con fila de índice +
  sección de detalle, replicando el texto de A2 (`handoff/A2-ola1c.md` §2.1–§2.3):
  - `VDB-REQ-10` — canal denso (embeddings) + fusión RRF real ausente en el fast path.
  - `VDB-REQ-11` — motor IQL y grafo nativo no expuestos por el binding.
  - `VDB-REQ-12` — sustrato de grafo (`insertNode`/`addEdge`) sin sembrar por parte de Ego.
- **Estructura de cada entrada** (la que valida la puerta): `Componente` · `Petición` ·
  `Situación Actual` · `Evidencia en Ego` · `Impacto en Ego` ·
  `Solución recomendada en VantaDB` · `Estado`.
- **Corrección respecto al texto de A2:** A2 escribió los nombres de campo sin tilde
  (`Peticion`, `Situacion Actual`, `Solucion recomendada en VantaDB`). La puerta busca
  literalmente `Petición`, `Situación Actual` y `Solución recomendada en VantaDB`, así
  que sin tilde esas entradas habrían generado 3 avisos W5 cada una. Se usaron los
  **nombres de campo canónicos**; el contenido es el de A2 sin cambios.
- **Corrección de severidad:** A2 escribió `Alta`/`Media` sin emoji; se usaron
  `🔴 Alta`/`🟠 Media` para igualar el resto de la tabla. La puerta solo mira el
  texto (`/alta|cr[ií]tica|…/i`), así que el comportamiento es idéntico.
- **`VDB-REQ-13` (nueva, de mi propia decisión):** la condición del ADR-0020
  ("si el `contextAssemble()` nativo no preserva el system prompt y los pares
  tool, se documenta como requisito upstream nuevo")需要一个 ID. A2 proponía
  `VDB-REQ-12`, pero ese ID ya lo ocupa la siembra del grafo → se registró como
  **`VDB-REQ-13`**.

### T2 — Filas de índice que faltaban (E3) ###

- `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` — filas de índice de **`VDB-INC-04`** y
  **`VDB-BUG-06`** (texto de A2 §2.4). Ambas tenían sección de detalle pero no
  fila: eso es E3 y bloqueaba la puerta.
- Normalización de las 23 filas de índice a **≤120 columnas** (el índice es un
  resumen; el detalle lleva el texto completo).

### T3 — Normalizar los avisos W1 ###

- **`VDB-BUG-02`**: la fila de índice solo citaba el síntoma IEEE-754, pero el
  código la usa para **dos** facetas del mismo origen — los enteros `f64` **y** el
  envoltorio etiquetado de primitivos (`{ Float }`/`{ String }`/`{ Bool }`, que el
  propio detalle ya describía). Fila y título reescritos para cubrir ambas →
  los 4 W1 de metadata desaparecen.
- **`VDB-INC-03`**: la fila decía *"re-inyección en consumers"*; el código habla de
  *"adaptador mnemónico"* y *"hot recovery"*. Fila reescrita con esos términos →
  W1 resuelto.
- **Cierre del `Componente`:** en 8 entradas el campo `Componente` lleva ahora el
  `archivo:línea` **al principio** (la puerta lo parsea en una sola línea →
  comprobación W3) y es corto. Sin esto, el formateo a 118 columnas habría
  empujado la evidencia a la línea siguiente y creado W3 falsos.

### T4 — Verificar el gate ###

- `node scripts/verify-vantadb-ids.mjs` → **exit 0**, **0 errores**.
- `node scripts/verify-vantadb-ids.mjs --json` → recuento final (abajo).
- `node docs/testing/check-docs-paths.mjs` → **exit 0**.

### T5 — Cerrar las solicitudes de la Ola 1b ###

| # | Solicitud | Estado |
|---|---|---|
| 1 | `docs/architecture/memoria-vantadb.md` §10 + línea de `AGENTS.md` sobre RRF | ✅ §10 reescrito (tabla de los 2 motores); `AGENTS.md:81` y `:270` corregidos (el árbol de paquetes y la fase 06 decían "búsqueda híbrida RRF"); `docs/engineering/vantadb-readiness-plan.md:28` corregido (describía RRF como disponible hoy en el Fast Path). `grep -rn "RRF"` deja `RRF` solo donde se habla del **path cognitivo**, del **motor de VantaDB** o de un **descarte**. |
| 2 | **ADR de compactación** | ✅ `docs/adr/0020-compactacion-motor-ts-vs-nativo.md` (nuevo). Decisión: **opción 3 (híbrido) condicionada**. Ver §"La decisión" abajo. |
| 3 | `CHANGELOG.md` raíz | ✅ Copiada la entrada de la Ola 1 y **eliminada la divergencia declarada** entre los tres ficheros (`CHANGELOG.md` raíz, `docs/changelog.md`, `docs/user/changelog.md`): los tres declaran ahora la misma regla de precedencia. |
| 4 | `docs/research/arquitectura-master-matrix.md` | ✅ Cifras **recalculadas** y evidencia obsoleta corregida. Ver §"La matriz" abajo. |
| 5 | `docs/agent-ops/reports/INDEX.md` | ✅ Registrado el informe de la Ola 1b/1c (`docs/agent-ops/reports/reviews/remediation-wave1b-2026-10-20.md`, nuevo) con su resumen. |

**Extras necesarios para que cerrara la ola:**

- `docs/.vitepress/config.mts` — `ignoreDeadLinks` ahora incluye `/AGENTS/`: un
  documento de research **nuevo de otro agente** enlazaba `../../AGENTS.md`
  (fuera del root del site) y rompía el build. Es la misma clase que
  `CHANGELOG`/`CONTRIBUTING`/`CODE_OF_CONDUCT`, que ya estaban ahí.
- `docs/adr/README.md` — actualizado con los 20 ADRs (0018, 0019, 0020).
- `docs/index.md` — ADR-0020 indexado.

### La decisión del ADR-0020 (compactación) ###

- **Motor canónico: `ContextCompaction` (TypeScript)** — 742 líneas, 21 tests, y
  lo único que preserva *system prompt*, pares `tool_call`/`tool_result`, resumen
  LLM inyectable (`createRouterSummarizer` sobre el `ModelRouter`) y archivado en
  `kb/history_archive`. Es además el único cableado (`main.ts:1965` instancia,
  `main.ts:1731` llama, `main.ts:1737` pasa el resumidor).
- **El `contextAssemble()` nativo es "vía disponible", no sustituto**: se activa
  solo cuando supere la **puerta de invariantes**; si no las preserva, queda como
  petición upstream `VDB-REQ-13` y el motor TS sigue siendo el único canónico.
- **Corrección de nombre (la misma clase de error que la Ola 1c vino a
  arreglar):** el método nativo de compactación de historial se llama
  **`contextAssemble()`**, **no `compact()`**. El binding sí tiene
  `compactLayout()` (vector store) y `compactWal()` (WAL), que son otra cosa.
  El texto de A2 en `handoff/A2-ola1b.md` §2.3 decía `compact(options)`; el ADR
  lo corrige.
- **Estado del ADR:** `Aceptado (condicional)` — la vía nativa es una promesa
  condicionada, no una capacidad entregada, y el ADR lo dice explícitamente.

### La matriz de contraste (recalculada) ###

- `docs/research/arquitectura-master-matrix.md`:
  - **Cifras recalculadas y documentadas:** el vector de estados **no ha cambiado**
    (0 ✅ / 19 🟡 / 1 ❌ / 1 🚫 / 1 ➖) → **~43 % bruto y ~62 % adaptado se
    mantienen**. Dos secciones suben en sub-requisitos cumplidos sin cambiar de
    estado (§11 sanitizador, §18 OKLCH + `DESIGN.md`).
  - **B6 → Refutada (cerrada)**: `UntrustedContentSanitizer` neutraliza ya las
    **11** tags de control (`:30-42`, `:196-198`), no solo las detectadas.
  - **B7 → Refutada (cerrada)**: `DreamConsolidator` declara `truncated: boolean`
    (`:19,122`) y lo devuelve al truncar (`:149` ok / `:155` truncado).
  - **B2**: líneas corregidas (`main.ts:1731,1965` — `main.ts` encogió de 5 507 a
    2 857 y las referencias apuntaban más allá del final).
  - **§11, §18, §2, §3, §4, §9, §10, §20**: evidencia actualizada (la §18 decía
    "0 ocurrencias de `oklch`" y "`DESIGN.md` solo en `packages/avatar/`" — ambas
    falsas tras T14 y tras la Ola 1b).
  - **Balance de brechas**: 7 refutadas · 0 parciales · 7 confirmadas.

---

## Solicitudes fuera de zona (NO aplicadas) ##

| # | Fichero | Cambio pedido | Motivo | Bloqueante |
|---|---|---|---|---|
| 1 | `packages/memory/EgoMemoryAdapter.ts:637` | `// Workaround: VDB-BUG-02` → `// Workaround: VDB-BUG-02 (metadata etiquetada)`. La puerta mira **hacia atrás** (10 líneas previas); la línea 638 (donde está "metadata") queda fuera del contexto → aviso W1. | Último W1 vivo. **Zona de A2.** | No |
| 2 | `scripts/verify-vantadb-ids.mjs` | Con `--json` imprime el JSON **y** después la línea `"[verify-vantadb-ids] gate OK..."`, lo que rompe el parseo con `ConvertFrom-Json` / `jq`. Sugerencia: `if (!JSON_OUT) console.log(...)` para el mensaje final. | 1 línea. **Zona de A7.** | No |
| 3 | `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` | **Normalizar las 15 entradas legacy** al formato nuevo (añadir `**Estado:**` → W4, `**Impacto en Ego:**` → W5, `archivo:línea` en `Componente` → W3). Quedan **22 avisos** (W5=10, W3=11, W4=1, W2=2) y **0 errores**. | La propia puerta dice: *"A1 puede promover W5 a error cuando normalice la forma de las 19 entradas"*. Cada `Impacto en Ego` debe ser una **afirmación comprobable**, no un relleno: por eso no lo he hecho de relleno. | No |
| 4 | `apps/desktop/package.json` + `package.json` raíz | **`electron`: quitar el `pnpm.overrides` y subir el manifiesto.** Hoy el manifiesto declara `electron: ^33.2.0` y el salto a 41.10.7 se aplica por `pnpm.overrides` — que la decisión **D1 del owner prohíbe explícitamente**. | `EGO-FIND-23` (🟡). Manifiestos de A4 / A7. | No |
| 5 | `apps/desktop/package.json` + `packages/memory/package.json` | **Aplicar el diff de `vantadb-node`** (A7 ya escribió el script y el diff exacto): `"file:../../../VantaDB/vantadb-node"` → `"file:../../vendor/vantadb-node/vantadb-node-0.8.0.tgz"`, y versionar el tarball. | `git diff` de ambos manifiestos está **vacío** → el cambio propuesto por A7 (T7) **no se aplicó**. `EGO-FIND-64` (🟡). | No |
| 6 | `apps/desktop/src/main.ts` | **Instanciar `EgoMcpServer`** (`packages/integrations/src/mcp/McpServer.ts` existe y está testeado; **0 instanciaciones** en `src/`) e **inyectar el `secretResolver`** (keychain) en el `McpClient` (`McpClient.ts:81,118` ya lo soporta). | Reasignaciones `R1`/`R2`. Cierra `EGO-FIND-46` (🟡). Falta decidir el transporte (subproceso stdio vs. socket local). | **Sí** — decisión de transporte (owner) |
| 7 | `packages/integrations/src/mcp/McpManager.ts:120` | Quitar `overrideExisting: true` o exigir `allowOverride` explícito por servidor, y **auditar** el override. | `EGO-FIND-49` (🆕). Un servidor MCP puede pisar tools nativas. | No |
| 8 | `apps/desktop/renderer/components/domains/DomainCanvasView.tsx` | Eliminar las **10 ramas `domainId === "…"`** (`:228,244,257,292,304,426,501,626,827,859`) y resolver por `componentKind` contra el registry. | Reasignación `R3`. Cierra `EGO-FIND-48`. Verificado: las 10 ramas siguen. | No |
| 9 | `apps/desktop/renderer/**` + `apps/desktop/src/main.ts` (CSP) | **DOMPurify** (1 dependencia + 1 línea en `shiki-highlight.tsx:188`) y añadir **`img-src`** a `buildCsp()`. | Reasignación `R6` → **Ola 2 · E7**. Cierra `EGO-FIND-61` (🟡). Última pata de §11. | No (dep nueva → A7) |
| 10 | `apps/desktop/renderer/test/` + `apps/desktop/test/` | 3 tests tautológicos que deben dejar de afirmar sobre texto de fuente: `ipc-bridges-t13.test.ts` (4 asserts), `ShikiOffload.test.tsx` (2), `tasks-wiring.test.ts` (1). | Cierra `EGO-FIND-63` (🟡). Detector de A7: `scripts/inventory-tautological-tests.mjs`. | No |
| 11 | `packages/runtime/src/ToolExecutionLoop.ts:387` | Ejecución **paralela** de tool calls con reordenamiento ordenado de los `tool_result`. | `EGO-FIND-43` (🆕). **Bloqueada por diseño**: Anthropic exige que cada `tool_result` siga en orden a su `tool_use`; un `Promise.allSettled` ingenuo rompe la API → **Ola 2 · E1**. | **Sí** — Ola 2 |
| 12 | `packages/runtime/src/TrustBoundary.ts` + `packages/events/src/` | **Cablear el `correlationId`**: A7 dejó `scripts/correlation.mjs` (`newCorrelationId`, `childCorrelationId` determinista) y el sink rotado, pero `correlationId` tiene **0 callsites** en `packages/` y `apps/`. | Cierra `EGO-FIND-74` (🟡). | No |
| 13 | `packages/knowledge/src/HybridSearch.ts` + `packages/memory/EgoMemoryAdapter.ts` | **Path cognitivo nativo** (Ola 2 · E2): instanciar `contextAssemble` / `memoryRecall` / `memoryConsolidate` / `memoryReinforce` (binding `index.d.ts:603-636`, hoy **0 callsites**) y ejecutar la **puerta de invariantes** del ADR-0020 contra los tests de `ContextCompaction`. | Cierra `EGO-FIND-29` (🟡) y da el visto bueno a la vía nativa del ADR-0020. | **Sí** — Ola 2 |
| 14 | `apps/desktop/renderer/test/a11y.test.tsx` | Los **6 `it.fails`** de contraste (FIND-A11Y-01..06). Con las paletas ya en OKLCH, modularizar `dim` y `border-strong` por paleta es barato y `ThemeTokensOklch.test.tsx` permite hacerlo con **RED primero**. | Cierra `EGO-FIND-71` (🟡). | No |
| 15 | `apps/desktop/src/main.ts` | Descomposición restante: sigue siendo un god file con **79 handlers IPC** en 2 857 líneas. | `EGO-FIND-54` (🟡). **Ola 2 · E6**, primera tarea estructural. | **Sí** — Ola 2 |
| 16 | `docs/extractions/*.md` + `docs/review/backlog-*.md` | 32 patrones en limbo y filas `🚫 Descartada (con justificación)` en las **fichas** (A5 lo resolvió en los backlogs, las fichas siguen sin la marca). | Guardrail duro de `AGENTS.md` §4. Zona de A5. | No |

---

## Verificación ##

| Comando | Exit | Resumen |
|---|---|---|
| **`node scripts/verify-vantadb-ids.mjs`** (obligatorio) | **0** | **0 errores** · 25 avisos · 23 IDs registrados · 62 referencias vigiladas · 838 ficheros escaneados |
| `node scripts/verify-vantadb-ids.mjs --json` | 0 | `errors: 0` · `warnings: W1=1 W5=10 W3=11 W4=1 W2=2` · `registeredIds: 23` · `references: 62` · `filesScanned: 838` |
| `node docs/testing/check-docs-paths.mjs` | **0** | 351 docs · **0 enlaces rotos** · **0 rutas inexistentes** en docs canónicos · 216 en worklogs (informativo) |
| `pnpm docs:build` | **0** | `build complete in 15.83s` (con la regla `EGO-VUE-INTERPOLATION` y `ignoreDeadLinks: /AGENTS/`) |
| `node scripts/check-docs-lint.mjs` | 1 | **0 regresiones** de A1 · violaciones actuales 11 405 vs base 11 406 (el baseline lo regeneró otro agente durante la ola) |
| `pnpm --filter @ego/avatar typecheck` | 0 | `tsc -p tsconfig.json`, 0 errores |
| `pnpm --filter @ego/avatar build` | 0 | 50 ficheros en `dist/` + manifiesto SHA-256 |
| `pnpm --filter @ego/avatar test` | 0 | 266 pass / 0 fail |
| `pnpm --filter @ego/avatar sync:check` | 0 | SIN DRIFT entre el paquete y la copia vendorizada |
| `pnpm --filter @ego/avatar geometry:check` | 0 | 168/168 combinaciones idénticas a la golden |
| Estado del Backlog | — | **66 ✅ · 11 🟡 · 2 🆕** (`EGO-FIND-43`, `EGO-FIND-49`) — sin cambios en esta ola |

### Los 25 avisos que quedan (no bloquean, todos preexistentes o explicados) ###

| Código | Nº | Qué son |
|---|---|---|
| `W1` | 1 | `packages/memory/EgoMemoryAdapter.ts:637` — comentario `VDB-BUG-02` sin descripción; la evidencia ("metadata") está en la línea *siguiente*, que la puerta no mira. **Solicitud #1 (A2).** |
| `W2` | 2 | `VDB-REQ-08` / `VDB-REQ-09` de severidad Alta que el código nunca cita: peticiones puramente upstream. |
| `W3` | 11 | Entradas legacy cuyo `Componente` no incluye `archivo:línea`. |
| `W4` | 1 | 15 entradas legacy sin campo `**Estado:**`. |
| `W5` | 10 | 10 entradas legacy sin `**Impacto en Ego:**`. |

---

## Deuda / no resuelto ##

1. **El ADR-0020 decide, pero no ejecuta.** La puerta de invariantes del motor
   nativo no se ha evaluado (0 callsites del path cognitivo) → **Ola 2 · E2**
   (solicitud #13).
2. **22 avisos del registro** quedan: normalizar las 15 entradas legacy exige
   escribir 15 `Impacto en Ego` que sean afirmaciones comprobables, no relleno.
   Es trabajo verificable, pero de otro tamaño → solicitud #3.
3. **14 de las 17 reasignaciones** `R1..R17` no son mías y siguen abiertas
   (solicitudes #4–#15).
4. **`EGO-FIND-43` y `EGO-FIND-61` siguen abiertos** por decisión (bloqueo de
   diseño de Anthropic y última brecha de §11).
5. **El `CHANGELOG.md` raíz** ya está sincronizado, pero **no he tocado
   `docs/agent-ops/reports/verify-audit.jsonl`** (lo modificó otro agente).

---

## Nota de estado del árbol ##

Working tree sucio y compartido con A2–A8 — **esperado por contrato** (README §5.5).
**No he hecho ningún commit, ni `git checkout/reset/stash/clean`, ni `pnpm install`.**
No he tocado `packages/**` ni `apps/**`: los únicos cambios de código que
detecto en mi zona son de A2/A3/A4, y todo lo que yo he modificado son
ficheros de `docs/`, `AGENTS.md` y `CHANGELOG.md`.

> **Ficheros que `git status` puede atribuir a "A1" y no son míos** (creados o
> editados por A5/A8 en la Ola 1c):
> `docs/research/{automatizacion-y-agentes-ejecucion,backoffice-empresa-personal,canales-comunicacion-y-social,compati
  bilidad-integraciones-mcp-skills,orquestacion-multiagente,plantillas-agentes-y-enjambres,producto-y-desarrollo-como-empresa}.md`,
> `docs/research/arquitectura-master-matrix.md` (contenido de A8; **las cifras
> y la evidencia sí las he recalculado yo**), `docs/research/{coucou,hermes-agent,openclaw}-deep-dive.md`,
> `docs/research/character-audit-and-coucou-inventory.md`,
> `docs/agent-ops/reports/verify-audit.jsonl` y
> `docs/agent-ops/reports/INDEX.md` (compartido).
