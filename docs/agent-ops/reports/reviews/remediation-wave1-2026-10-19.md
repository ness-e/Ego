# Informe de cierre — Ola 1 de remediación (2026-10-19)

| Campo | Valor |
|---|---|
| Fecha | 2026-10-19 (cierre documental 2026-10-20) |
| Tipo | Cierre de ola |
| Modo | Wave 1 · Bloques 0 + A + B + C + D |
| Veredicto | 🟡 **PARTIAL** — 66/79 hallazgos cerrados, 11 parciales, 2 abiertos |
| Estado | vigente |
| Origen | [`review-full-2026-10-19.md`](review-full-2026-10-19.md) · [`VERDICT.md`](../../plans/2026-10-19-remediation-wave1/VERDICT.md) |
| Trazabilidad | `docs/roadmap/Backlog.md` · filas `EGO-FIND-18..79` |

---

## 1. Qué se cerró (con evidencia) ##

### 1.1 Por bloques

| Bloque | Alcance | Estado | Evidencia |
|---|---|---|---|
| **0 — Baseline** | Cierre de la auditoría de 8 agentes: 62 hallazgos 🔴/🟠 derivados a `EGO-FIND-18..79`. | ✅ | `docs/roadmap/Backlog.md` §"Hallazgos de la revisión full 2026-10-19" |
| **A — Integridad P0** | Compactación muerta, crash del chat virtualizado, `<select>` nativos, targets 44 px. | ✅ | `EGO-FIND-20`, `21`, `55`, `56` ✅ + `57`, `58` ✅ |
| **B — Seguridad** | Canal dual + taint, secret proxy (D2), allowlist de terminal, env saneado, `PathValidator`, SSRF, fail-closed, MCP server, catálogo de tools. | 🟡 | 12 de 15 ✅; **abiertos**: `43`, `48`, `49`, `61` (parcial), `64` (parcial) |
| **C — Honestidad documental** | `roadmap.md` ↔ `Backlog.md`, 40 rutas rotas, ADRs, `AGENTS.md`, `stack-tecnico.md`. | ✅ | `EGO-FIND-75..78` ✅ + ADR-0018/0019 (OLA 1b) |
| **D — Motor de personaje** | Licencia MIT, sync SHA-256, geometría propia, docs canónicos, tests. | 🟡 | `EGO-FIND-24`, `25`, `67`, `68`, `70` ✅; `69` parcial |

### 1.2 Cierre documental de A1 (OLA 1 + OLA 1b)

| Ítem | Evidencia verificable |
|---|---|
| `roadmap.md` reconciliado con el Backlog | 13/13 fases con línea "Estado actual" · **0** checkboxes `- [ ]` contradictorios · `PLAN-EGO.md:15` apunta al Backlog como fuente de verdad |
| Columna `Archivo:línea` reparada | 45 sustituciones exactas + verificador permanente `docs/testing/check-docs-paths.mjs` → **0** rutas inexistentes en docs canónicos, **0** enlaces markdown rotos |
| Numeración ADR | **17 ADRs** (0001-0017), 0 colisiones, todos en `docs/index.md`, plantilla común con "Alternativas consideradas" |
| Decisiones sin ADR | Cubiertas: CodeMirror 6 (0013), `virtua` (0014), Radix Select (0015), Shiki Web Worker (0016), ContextCompaction (0017), motor de personaje (0018), canal dual + taint (0019) |
| `stack-tecnico.md` / `AGENTS.md` | "Monaco Editor" → CodeMirror 6 (0 `monaco` en el repo) · árbol de 6 → **18 paquetes** · "128 docs" → **286** · principio D3 documentado en §4 |
| `docs/index.md` | Índice maestro completo: 19 ADRs, 4 backlogs de review ausentes, 8 fichas de extracción, `VANTADB-FEEDBACK-Y-MEJORAS.md`, `design/DESIGN.md`, research hub, informes de revisión |
| Sitio VitePress | `pnpm docs:build` → **exit 0** (antes roto: `vite:vue` fallaba con `{{SECRET:…}}`) · sidebar de 9 grupos (~90 entradas) frente a 3 |
| Compacción y RRF reconciliados | `memoria-vantadb.md` §3 y §10, `namespaces.md`, `ciclo-memoria-unificado.md`, `stack-tecnico.md`, `modulos.md`, `definicion-soc.md`, `Backlog.md`, `research/README.md` |
| Excepción de tipado del avatar | `AGENTS.md` §4: 47 ficheros JS / 11 203 líneas, `checkJs` sin `strict`, con condición de cierre y 5 puertas (`typecheck`/`build`/`test`/`sync:check`/`geometry:check`) |

### 1.3 Las 17 reasignaciones `R1..R17` de `VERDICT.md` §4.2

| # | Fichero | Cambio | Dueño | Estado al cierre |
|---|---|---|---|---|
| R1 | `apps/desktop/src/main.ts` | Instanciar `EgoMcpServer` (falta decidir transporte) | A4 | 🟡 **Abierto** — `McpServer.ts` existe y está testeado, **0 instanciaciones** en `src/` |
| R2 | `apps/desktop/src/main.ts` | Inyectar el `secretResolver` (keychain) en el `McpClient` | A4 | 🟡 **Abierto** — el `SecretProxy` existe (`packages/integrations/src/mcp/SecretProxy.ts`) pero el `McpClient` no lo recibe |
| R3 | `DomainCanvasView.tsx` | Eliminar las 10 ramas `domainId === "…"` | A4 | ✅ **Cerrado** (A4, Ola 1b) — verificado 2026-10-20: **0 ramas** `domainId === "…"` en `DomainCanvasView.tsx`; las vistas se resuelven por `componentKind` contra el registry dinámico |
| R4 | `packages/security/src/ToolPermissions.ts` | Delegar en el `NetPolicy` canónico | A2 (Ola 2 · E7) | ⏸️ Ola 2 |
| R5 | `packages/execution/src/ExecutionManager.ts` | Circuit breaker por tool + quota por Sub-Ego | A2 (Ola 2 · E1) | ⏸️ Ola 2 |
| R6 | `apps/desktop/renderer/**` | DOMPurify + CSP `img-src` | A7 + A4 (Ola 2 · E7) | 🟡 **Abierto** — CSP sin `img-src`, 0 imports de DOMPurify |
| **R7** | `docs/adr/` | **ADR del canal dual (CaMeL)** | **A1** | ✅ **CERRADO** — [ADR-0019](../../../adr/0019-canal-dual-taint-tracking.md) |
| **R8** | `docs/architecture/memoria-vantadb.md` | Corregir §2 (punto 10): Ego **sí** construye poda de tokens en TS | **A1** | ✅ **CERRADO** — §10 reescrito con los dos motores (TS propio + `contextAssemble()` nativo) y su estado real |
| **R9** | `docs/architecture/namespaces.md` + `AGENTS.md` | "búsqueda híbrida RRF" describe una capacidad inexistente en el Fast Path | **A1** | ✅ **CERRADO** — aviso en `namespaces.md` y `memoria-vantadb.md` §3; 7 docs más corregidas; `AGENTS.md` no afirmaba RRF |
| R10 | `docs/adr/0018-motor-de-personaje.md` | Crear el ADR con el texto de A6 | A1 | ✅ **CERRADO** — [ADR-0018](../../../adr/0018-motor-de-personaje.md) |
| **R11** | `docs/roadmap/Backlog.md` | Marcar `EGO-FIND-24/25/67/68/69/70` como resueltos | **A1** | ✅ **CERRADO** — 5 ✅ + `69` 🟡 (la consolidación física de `CharacterEngine` depende de A4) |
| **R12** | `AGENTS.md` | Excepción de tipado del motor de avatar | **A1** | ✅ **CERRADO** — §4 con motivo, alcance, puertas y condición de cierre |
| R13 | `.github/workflows/**` | `sync:check` y `geometry:check` en CI | A7 | ✅ Hecho por A6/A7 |
| R14 | `apps/desktop/**` | Archivar `CharacterCanvas.tsx` / `CharacterMiniBadge.tsx` (0 usos) | A4 | ✅ **Cerrado** (A4, Ola 1b) — ambos ficheros **borrados** del árbol |
| R15 | `apps/desktop/renderer/components/character/**` | Decidir si `CharacterStateMachine` se instancia o se retira | A4 + owner | ✅ **Cerrado** (A4, Ola 1b) — la FSM de 14 estados reescrita como `character/state/character-state.ts` (`CharacterState` + `CANONICAL_CHARACTER_STATES`) |
| R16 | según tabla | 5 bloques de solicitudes de A5 | según destino | ✅ 4/5 cerradas (A5-S1..S4 aplicadas por A1; A5-S5..S15 → A2/A3/A4/A6) |
| **R17** | `docs/research/README.md` | Indexar la matriz + marcar el maestro como no normativo | **A1** | ✅ **CERRADO** — inventario del hub + entrada de `arquitectura-master-matrix.md` |

**Resultado: 7 de 17 cerradas por A1 (`R7`–`R12`, `R17`) + `R16` parcialmente.**

---

## 2. Lo que queda abierto (14 hallazgos) ##

### 2.1 Abiertos (2) — requieren decisión o trabajo de código

| ID | Qué falta | Responsable |
|---|---|---|
| `EGO-FIND-43` | Ejecución paralela de tool calls. **Bloqueada por diseño**: Anthropic exige que cada bloque `tool_result` siga **en orden** a su `tool_use`; un `Promise.allSettled` ingenuo rompe la API. | Ola 2 · E1 |
| `EGO-FIND-49` | `McpManager.ts:120` sigue con `overrideExisting: true`: un servidor MCP puede pisar tools nativas sin auditoría. | Ola 2 |

### 2.2 Parciales (11) — falta una parte concreta

| ID | Cerrado | Falta |
|---|---|---|
| `EGO-FIND-22` | `DelegationRuntime` cablea la delegación (6 tools) | `DreamConsolidator`/`MemoryCurator` sin instanciar en `main.ts` (`R18`) |
| `EGO-FIND-23` | Runtime en electron 41.10.7 | `apps/desktop/package.json` sigue en `^33.2.0` y el salto se hizo con `pnpm.overrides`, **prohibido por la decisión D1** |
| `EGO-FIND-29` | `graphragSearch` con callsite | `contextAssemble`/`memoryRecall`/`memoryConsolidate`/`memoryReinforce` con **0 callsites** → Ola 2 · E2 |
| `EGO-FIND-46` | `McpServer.ts` implementado y testeado | **No instanciado** en `main.ts` (`R1`) |
| `EGO-FIND-54` | `main.ts` 5 401 → **2 857** líneas | Sigue siendo un god file con 79 handlers → Ola 2 · E6 |
| `EGO-FIND-61` | CSP con `buildCsp()` aplicada | **Sin `img-src`** y **sin DOMPurify** (`R6`) |
| `EGO-FIND-63` | Detector preciso (4 ficheros / 20 asserts) | 3 tests de la zona de A4 siguen afirmando sobre texto de fuente |
| `EGO-FIND-64` | `prepare-vantadb-tarball.mjs` + diff exacto | Los dos manifiestos **siguen** en `file:../../../VantaDB/vantadb-node` → el build de CI aún no es reproducible |
| `EGO-FIND-69` | Los 3 docs canónicos + ADR-0018 + `R14`/`R15` aplicados por A4 | Destino del último fichero legacy (`core/CharacterEngine.ts`, que sobrevive por sus tipos y `hexToRGB`) |
| `EGO-FIND-71` | Harness OKLCH real (6 tests) | Los **6 `it.fails`** de contraste siguen vivos → Ola 2 |
| `EGO-FIND-74` | `correlation.mjs` + sink rotado + exportador | `correlationId` con **0 callsites** → no cableado al EventBus |

### 2.3 Las reasignaciones que A1 **no** cerró

A1 no puede cerrar `R1`, `R2`, `R4`, `R5`, `R6`, `R13` ni el resto de `R14`/`R15`
(código, CI o decisión del owner). `R3` y la parte ejecutable de `R14`/`R15` las
aplicó **A4 en paralelo durante la Ola 1b** (verificado en el árbol de trabajo).
Detalle exacto en
[`handoff/A1-ola1b.md`](../../plans/2026-10-19-remediation-wave1/handoff/A1-ola1b.md)
§"Solicitudes fuera de zona".

---

## 3. Verificación del cierre ##

| Puerta | Comando | Exit | Resultado |
|---|---|---|---|
| Integridad referencial | `node docs/testing/check-docs-paths.mjs` | **0** | 286 docs · 0 enlaces rotos · 0 rutas inexistentes en docs canónicos |
| Lint de docs (con línea base) | `node scripts/check-docs-lint.mjs` | 1 | 12 regresiones: **0 de A1**; 8 de A6/A7 (`handoff/A6-ola1b.md`, `handoff/A7-ola1b.md`, `character-audit-and-coucou-inventory.md`) |
| Build del sitio | `pnpm docs:build` | **0** | sitio VitePress compilado (antes fallaba con `vite:vue`) |
| Typecheck del avatar | `pnpm --filter @ego/avatar typecheck` | **0** | `tsc -p tsconfig.json`, 0 errores (ya no es un no-op) |
| Build del avatar | `pnpm --filter @ego/avatar build` | **0** | 50 ficheros en `dist/` + manifiesto SHA-256 |
| Puerta de sync del avatar | `pnpm --filter @ego/avatar sync:check` | **0** | SIN DRIFT entre el paquete y la copia vendorizada |
| Geometría del avatar | `pnpm --filter @ego/avatar geometry:check` | **0** | 168/168 combinaciones con traza idéntica a la golden |
| Suite global | `pnpm test` | **0** | verde (verificado por el orquestador) |
| Lint + typecheck global | `pnpm lint` | **0** | verde (verificado por el orquestador) |

---

## 4. Conclusión ##

La Ola 1 cierra el **núcleo duro**: 4 de los 5 defectos del Plan P0 (compactación
muerta, crash del chat, selects nativos, 44 px) están resueltos y verificados por
test; el bloque de seguridad está **sustancialmente cerrado** en su parte difícil
(taint + canal dual, secret proxy, allowlist de terminal, `PathValidator`, SSRF,
fail-closed) pero deja abiertos DOMPurify/CSP y el egress firewall; el bloque de
honestidad documental está cerrado.

**El riesgo residual mayor de la ola es la regresión estructural de `main.ts`:** pasó
de 5 401 a 2 857 líneas mientras cableaba la ola, pero **sigue siendo un god file**
con 79 handlers IPC. Cerrar cuatro defectos no reduce la deuda estructural: la
descomposición (`E6`) debe ser la primera tarea estructural de la Ola 2, no la última.

**La brecha más urgente de la Ola 2 es `E7`** (DOMPurify + CSP `img-src`): es la
única pieza del documento maestro que es simultáneamente requisito de seguridad
frontend, no descartada por ninguna decisión, de esfuerzo bajo, y la que cierra
la última pata de §11 — la sección con más peso documental sin cumplir.

---

## 5. Referencias ##

- [`review-full-2026-10-19.md`](review-full-2026-10-19.md) — informe fuente (8 auditores).
- [`../../plans/2026-10-19-remediation-wave1/VERDICT.md`](../../plans/2026-10-19-remediation-wave1/VERDICT.md) — veredicto y plan de la Ola 2.
- [`../../plans/2026-10-19-remediation-wave1/handoff/`](../../plans/2026-10-19-remediation-wave1/handoff/) — handoffs de A1..A8.
- [`../../../roadmap/Backlog.md`](../../../roadmap/Backlog.md) — filas `EGO-FIND-18..79` con estado y evidencia.
- [`../../../research/arquitectura-master-matrix.md`](../../../research/arquitectura-master-matrix.md) — contraste con el documento maestro.
- [`../../../adr/0018-motor-de-personaje.md`](../../../adr/0018-motor-de-personaje.md) · [`../../../adr/0019-canal-dual-taint-tracking.md`](../../../adr/0019-canal-dual-taint-tracking.md) — las dos decisiones de la Ola 1b.
