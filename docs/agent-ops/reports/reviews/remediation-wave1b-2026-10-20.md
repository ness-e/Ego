# Informe de cierre — Ola 1b y 1c (2026-10-20) #

| Campo | Valor |
|---|---|
| Fecha | 2026-10-20 |
| Tipo | Cierre de ola (continuación) |
| Modo | Wave 1b · reasignaciones `R7`–`R12` y `R17` + Ola 1c (trazabilidad de IDs de VantaDB) |
| Veredicto | 🟡 **PARTIAL** — 66/79 hallazgos cerrados, 11 parciales, 2 abiertos; **gate de trazabilidad VantaDB en verde** |
| Estado | vigente |
| Predecesor | [`remediation-wave1-2026-10-19.md`](remediation-wave1-2026-10-19.md) |
| Handoffs | [`A1-ola1b.md`](../../plans/2026-10-19-remediation-wave1/handoff/A1-ola1b.md) · `A2-ola1b.md` · `A2-ola1c.md` · `A6-ola1b.md` · `A7-ola1b.md` |

---

## 1. Qué se cerró en la Ola 1b (A1) ##

| Reasignación | Entregable | Estado |
|---|---|---|
| `R7` | [ADR-0019](../../../adr/0019-canal-dual-taint-tracking.md) — canal dual (P-LLM/Q-LLM) con taint tracking, con símbolos verificados por grep | ✅ |
| `R8` | `docs/architecture/memoria-vantadb.md` §10 reescrito: Ego **sí** construye poda de tokens en TS (`ContextCompaction.ts`) | ✅ |
| `R9` | `docs/architecture/namespaces.md` + 7 documentos más: fast path **BM25 léxico** vs path cognitivo (RRF real = upstream `VDB-REQ-10`) | ✅ |
| `R10` | [ADR-0018](../../../adr/0018-motor-de-personaje.md) — `@ego/avatar` como motor vigente, `CharacterEngine` como legado, tres copias mantenidas (D5) | ✅ |
| `R11` | `docs/roadmap/Backlog.md`: `EGO-FIND-24/25/67/68/70` → ✅, `EGO-FIND-69` → 🟡 | ✅ |
| `R12` | `AGENTS.md` §4: excepción de tipado del motor de avatar (JS plano + `checkJs`), con motivo, alcance, 5 puertas y condición de cierre | ✅ |
| `R17` | `docs/research/README.md`: inventario del hub, entrada de la matriz de contraste, documento maestro marcado **no normativo** | ✅ |
| `R16` (parcial) | 4 de las 5 solicitudes de A5 aplicadas al maestro (`A5-S1`..`A5-S4`) | 🟡 |

**Extras no pedidos explícitamente, pero necesarios para que la ola cerrara:**

- `docs/design/DESIGN.md` (nuevo): paletas **OKLCH** de las 4 paletas, contrato
  de contraste WCAG 2.2 verificable por test y la tabla de primitives.
- `docs/adr/README.md` (nuevo): índice de las 20 decisiones con estado y nivel.
- `docs/agent-ops/README.md` + `docs/agent-ops/tasks/README.md` (nuevos):
  navigation de 165 documentos de worklog que estaban huérfanos.
- **Regla `EGO-VUE-INTERPOLATION`** en `docs/.vitepress/config.mts`: el sitio
  compila cada `.md` como plantilla Vue, así que un `{{` literal rompía el
  build. El escape del `{{` de apertura en el HTML final eliminó la clase de
  fallo (occurrió 3 veces en la ola) y permitió **republicar** el research
  externo en el sitio.

---

## 2. Ola 1c — la trazabilidad de IDs de VantaDB ##

El guardrail de `AGENTS.md` §4 (*"Prohibición de Workarounds Silenciosos"*) estaba
escrito pero **nada lo verificaba**. A7 creó la puerta
`scripts/verify-vantadb-ids.mjs`; A2 renumeró sus 16 referencias y dejó el
texto de las 3 entradas nuevas para A1.

| Métrica | Antes de la Ola 1c | Después |
|---|---|---|
| Errores (E1/E2/E3) | **24** | **0** |
| IDs registrados | 19 | **23** |
| Referencias vigiladas | 62 | 62 |
| Avisos W1 (anclaje temático) | 7 | **0** |

**Lo que hizo A1 (zona de registro):**

- Registró `VDB-REQ-10` (canal denso + RRF real), `VDB-REQ-11` (grafo/IQL no
  expuesto) y `VDB-REQ-12` (sustrato de grafo sin sembrar), con fila de
  índice y sección de detalle, replicando el texto de A2.
- Añadió las filas de índice de `VDB-INC-04` y `VDB-BUG-06` (E3: tenían
  detalle pero no fila).
- Normalizó `VDB-BUG-02` y `VDB-INC-03` para que su descripción sea
  temáticamente coherente con las referencias del código (0 avisos W1).
- Registró `VDB-REQ-13`, que nace de la condición del ADR-0020: el
  `contextAssemble()` nativo debe preservar el system prompt y los pares
  `tool_call`/`tool_result`.

**Avisos que quedan (no bloquean, todos preexistentes):**

| Código | Nº | Qué son |
|---|---|---|
| `W2` | 2 | `VDB-REQ-08` / `VDB-REQ-09` de severidad Alta que el código nunca cita: peticiones puramente upstream. |
| `W3` | 11 | Entradas legacy cuyo campo `Componente` no incluye `archivo:línea`. |
| `W4` | 1 | 15 entradas legacy sin campo `**Estado:**`. |
| `W5` | 10 | 10 entradas legacy sin `**Impacto en Ego:**`. |

> Los W3/W4/W5 son **forma histórica** de las 15 entradas anteriores a la
> puerta. El propio script lo dice: *"A1 puede promover W5 a error cuando
> normalice la forma de las 19 entradas"*. Normalizar las 15 es un trabajo
> verificable por separado (cada `Impacto en Ego` debe ser una afirmación
> comprobable, no un relleno) → **deuda abierta, no bloqueante**.

---

## 3. Estado de los 79 hallazgos del Backlog ##

**66 ✅ Completada · 11 🟡 Parcial · 2 🆕 Pendiente.**

| ID | Estado | Qué falta |
|---|---|---|
| `EGO-FIND-43` | 🆕 | Ejecución paralela de tool calls: **bloqueada por diseño** (Anthropic exige que cada `tool_result` siga en orden a su `tool_use`). Ola 2 · E1. |
| `EGO-FIND-49` | 🆕 | `McpManager.ts:120` sigue con `overrideExisting: true`: un servidor MCP puede pisar tools nativas. |
| `22`, `23`, `29`, `46`, `54`, `61`, `63`, `64`, `69`, `71`, `74` | 🟡 | Cada fila dice explícitamente qué falta. |

**Cerradas además por A4 en paralelo (verificadas en el árbol de trabajo):**
`R3` (0 ramas `domainId === "…"` en `DomainCanvasView.tsx`), `R14`
(`CharacterCanvas.tsx` y `CharacterMiniBadge.tsx` borrados) y `R15` (la FSM de 14
estados reescrita como `character/state/character-state.ts`).

---

## 4. La decisión del ADR-0020 ##

`docs/adr/0020-compactacion-motor-ts-vs-nativo.md` decide el motor de
compactación de contexto:

- **Canónico: `ContextCompaction` (TypeScript)** — 742 líneas, 21 tests, y lo
  único que preserva system prompt, pares `tool_call`/`tool_result`, resumen
  LLM inyectable y archivado en `kb/history_archive`.
- **El `contextAssemble()` nativo es "vía disponible", no sustituto.** Se activa
  solo cuando supere la **puerta de invariantes**; si no las preserva, queda
  como petición upstream `VDB-REQ-13` y el motor TS sigue siendo el único
  canónico.

> **Corrección de nombre (la misma clase de error que la Ola 1c vino a
> arreglar):** el método nativo de compactación de historial se llama
> **`contextAssemble()`**, no `compact()`. El binding sí tiene `compactLayout()`
> (vector store) y `compactWal()` (WAL), que son otra cosa. Confundirlos
> rompería la trazabilidad justo cuando se quiere arreglarla.

---

## 5. Verificación ##

| Puerta | Comando | Exit | Resultado |
|---|---|---|---|
| **Trazabilidad de IDs de VantaDB** | `node scripts/verify-vantadb-ids.mjs` | **0** | 23 IDs · 62 referencias · 836 ficheros · **0 errores** · 24 avisos (0 W1) |
| **Integridad referencial de `docs/`** | `node docs/testing/check-docs-paths.mjs` | **0** | 0 enlaces rotos · 0 rutas inexistentes en docs canónicos |
| **Build del sitio** | `pnpm docs:build` | **0** | compilado (con la regla `EGO-VUE-INTERPOLATION`) |
| **Typecheck del avatar** | `pnpm --filter @ego/avatar typecheck` | **0** | `tsc -p tsconfig.json`, 0 errores |
| **Gate de docs (markdownlint con línea base)** | `node scripts/check-docs-lint.mjs` | 1 | 36 regresiones, **0 de A1** (todas de A5/A6/A7) |

---

## 6. Conclusión ##

La Ola 1b/1c cierra el **bloque de honestidad documental** y, sobre todo, **convierte
en mecánica un guardrail que estaba solo en prosa**: el identificador de cada
workaround de VantaDB está ahora registrado, y una puerta lo comprueba en cada
commit. Es el cambio con más retorno de la ola: la trazabilidad ya no depende de
que alguien recuerde hacerlo.

La brecha más urgente sigue siendo **E7** (DOMPurify + CSP `img-src`): es la
última pata de §11 del documento maestro y la única que el gate de seguridad no
puede sustituir.

---

## 7. Referencias ##

- [`review-full-2026-10-19.md`](review-full-2026-10-19.md) — informe fuente.
- [`remediation-wave1-2026-10-19.md`](remediation-wave1-2026-10-19.md) — cierre de la Ola 1.
- [`VERDICT.md`](../../plans/2026-10-19-remediation-wave1/VERDICT.md)
  — veredicto y plan de la Ola 2.
- [`../../../roadmap/Backlog.md`](../../../roadmap/Backlog.md) — las 79 filas con estado y evidencia.
- [`../../../VANTADB-FEEDBACK-Y-MEJORAS.md`](../../../VANTADB-FEEDBACK-Y-MEJORAS.md) — registro canónico (23 IDs).
- [`ADR-0020`](../../../adr/0020-compactacion-motor-ts-vs-nativo.md)
  — la decisión de compactación.
- [`arquitectura-master-matrix.md`](../../../research/arquitectura-master-matrix.md)
  — contraste con el documento maestro, recalculado.
