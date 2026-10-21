# Handoff A5-ola8-bis — Retirado el crédito a `khoj` del catálogo de extracción (`EGO-FIND-83`) — 2026-10-21

> **Resumen en una línea:** las 5 compuertas de `khoj` que afirmaban asimilación (`KHOJ-01..05`) quedan
> ahora como **`🚫 Descartada (con justificación)`** con el texto exacto de A2-bis — **lo que se descarta es la
> atribución al upstream, no la capacidad** — y **0** celdas de la ficha o del backlog afirman ya derivación de
> código desde `khoj`. El catálogo global pasa de `✅53 · 🚫72` a **`✅50 · 🚫75`** (289 tareas, 25 repos, 0 en el limbo).

**Zona tocada:** `docs/extractions/khoj.md` · `docs/review/backlog-khoj.md` · `docs/extractions/README.md` (§4.1) ·
`docs/review/README.md` · este handoff. **Nada más.** Sin commits, sin `git checkout/reset/stash/clean`, sin
`pnpm install`. No he movido ni borrado `docs/extractions/tools/*` (A7 está moviendo ejecutables) — ver §2.2.

---

## Índice

1. [Cambios aplicados (ficheros propios)](#1-cambios-aplicados-ficheros-propios) — 1.1 las 5 filas · 1.2 la tabla
   de catálogo · 1.3 el barrido de derivaciones · 1.4 los recuentos · 1.5 ficheros modificados
2. [Solicitudes fuera de zona (NO aplicadas)](#2-solicitudes-fuera-de-zona-no-aplicadas) — 2.1 A1 (texto exacto) ·
   2.2 A7 · 2.3 A2-bis · 2.4 A8
3. [Verificación](#3-verificación)
4. [Deuda / no resuelto](#4-deuda--no-resuelto)

---

## 1. Cambios aplicados (ficheros propios)

### 1.1 T1 — Las 5 filas de `khoj`: estado y texto (texto exacto de A2-bis)

Aplicado **literalmente** en `docs/extractions/khoj.md` §5 (columna *Evidencia / Fundamento*) y en
`docs/review/backlog-khoj.md` §2 (columna *Descripción & Patrón en Ego*):

| ID | Antes | Ahora |
|:--:|---|---|
| `KHOJ-01` | `✅ Completada` | `🚫 Descartada (con justificación)` — *El código es **implementación propia de Ego** (`packages/knowledge/src/ingest/AdaptiveChunker.ts`): SHA-256 + solapamiento de 32 tokens + ruta de encabezados. El upstream usa MD5, cuenta palabras y solapamiento 0. Se estudió como **referencia de diseño, sin traducción de código** (EGO-FIND-83: retirado todo el crédito a khoj, AGPL-3.0).* |
| `KHOJ-02` | `✅ Completada` | `🚫 Descartada (con justificación)` — ***Implementación propia de Ego** (`packages/knowledge/src/ingest/DocumentParser.ts`, `MarkdownExtractor.ts`). Alcance asimilado: Markdown, texto plano, JSON y CSV (PDF y DOCX de khoj **no** asimilados). Patrón estudiado como referencia de diseño, sin traducción de código.* |
| `KHOJ-03` | `✅ Completada` | `🚫 Descartada (con justificación)` — *El corte de umbral es una **calibración propia de Ego** (0.70 + normalización min-max por lote, etiqueta interna `H10`), no el `bi_encoder_confidence_threshold` del upstream. Implementación propia; patrón estudiado como referencia de diseño, sin traducción de código.* |
| `KHOJ-04` | `🚫 Descartada` | `🚫 Descartada (con justificación)` — *❌ Sin consumidor: `packages/knowledge/src/extractors/FactExtractor.ts:62`. La escritura de hechos en producción es `packages/domains/src/knowledge/KnowledgeDomain.ts:128,168` (`kb/facts`). El extractor es **implementación propia de Ego** (patrón estudiado, sin traducción de código).* |
| `KHOJ-05` | `🚫 Descartada` | `🚫 Descartada (con justificación)` — *❌ El soft-replace no es alcanzable: `consolidateMemories` (`packages/knowledge/src/FactLifecycle.ts:183`). **Actualización 2026-10-21 (A2-bis):** `DreamConsolidator` **ya está cableado** en producción (`packages/memory/EgoMemoryLifecycle.ts` → hook de inactividad de 5 min → dedup de `kb/facts` + purga de `quarantine/pending`, con evidencia en `gov/audit` acción `dream_consolidation`); el que sigue sin instanciar es `MemoryCurator` (se cablea con el diff de §6.3). El código es **implementación propia de Ego** (patrón estudiado, sin traducción de código).* |

**Decisión de redacción (declarada, por si A1/owner la revisa):** el texto de A2-bis va **verbatim y en primer
lugar** en la celda; **detrás** se conserva el detalle técnico de la Ola 2 (el grep, la cadena de caller, la nota de
`Corrección Ola 2`), etiquetado como *«Detalle técnico del upstream (Ola 2, se conserva)»* / *«Comprobaciones
ejecutadas (Ola 2)»*. Razón: ese detalle es **evidencia verificada** (qué hace el upstream, dónde vive el
código de Ego, qué se comprobó por grep) y **borrarlo sería una regresión de información**; el veredicto nuevo no lo
contradice, lo delimita. En las 3 filas que pasan de `✅` a `🚫` se añade además la frase que evita la lectura
contradictoria: *«lo que se descarta es la **atribución** al upstream, **no** la capacidad»*.

### 1.2 T1 (parte 2) — La tabla de catálogo deja de leerse como «código de Ego tomado de aquí»

En `docs/extractions/khoj.md` §4 (*Impacto en el Backlog de Ego y Trazabilidad*):

| Cambio | Detalle |
|---|---|
| Cabecera de la columna 2 | `Archivo / Función Khoj` → **`Archivo upstream (procedencia del clon)`** |
| Nota bajo la tabla | *«Qué registra la columna «Archivo upstream (procedencia del clon)»: el fichero del clon `repos-referencia/khoj/` **estudiado** para cada patrón. **No** es el origen del código de Ego: la implementación es **propia** (ver §5). Khoj es **AGPL-3.0** y la decisión del owner (`EGO-FIND-83`, 2026-10-20) es **retirar todo el crédito a khoj** ⇒ ninguna capacidad de Ego es una traducción de este repo.»* |
| Columna 4 (`Estado en Backlog Review`) | Las 5 filas `KHOJ-01..05` llevan ahora el estado: `🚫 Descartada (con justificación) — ver [\`docs/review/backlog-khoj.md\`](../review/backlog-khoj.md)` (antes: sólo el enlace) |

### 1.3 T1 (parte 3) — Barrido: **0** afirmaciones de derivación

Barrido sobre las dos fichas con el patrón `khoj` + `derivad|port|adapt|Extraíd|implement` y una lista negra de
afirmaciones concretas. Resultado: **0 afirmaciones residuales de derivación**.

Lo que se ha reescrito (todo en `docs/extractions/khoj.md` salvo donde se indica):

| # | Lugar | Antes | Ahora |
|--:|---|---|---|
| 1 | §2, 5 bullets de patrón | `- **Adaptación en Ego:** …` | `- **En Ego (implementación propia, sin traducción de código):** …` + «el upstream usa solapamiento 0, hash MD5 y longitud contada en palabras» (KHOJ-01), «el corte es una **calibración propia de Ego**» (KHOJ-03) |
| 2 | §2, 5 bullets futuros (`KHOJ-07..11`) | `- **Adaptación en Ego:** …` | `- **En Ego:** …` (el resto del texto ya describía el estado de Ego, no un porte) |
| 3 | §3, matriz de componente, filas `KHOJ-01..05` | `📥 **Extraer & Adaptar**` | `💡 **Referencia de diseño** (sin traducción de código)` + justificación con «implementación propia» |
| 4 | §3, matriz de componente, filas `KHOJ-07..11` | `📥 **Extraer & Adaptar**` | `🆕 **Estudiar como referencia** (sin traducción de código)` (todas `⏳ Futura`: no están implementadas) |
| 5 | §3, leyenda de la columna «Acción» | no existía | tabla con los 3 valores y su significado (la leyenda es lo que impide volver a leer «Extraer & Adaptar» como «portar código») |
| 6 | §3, justificaciones de las 5 filas | «Ego ya lo asimiló mejorando…», «Ego lo mejora con supersesión suave…» | «En Ego es **implementación propia**…», «el *soft-replace* … es **mejora propia**, no una traducción» |
| 7 | §5, criterio de cierre | «existe el **fichero adaptado**» | «existe el **fichero propio de Ego**» + nota de la Ola 8 que explica el cambio de veredicto |
| 8 | §5, título | `## 5. Estado real verificado (2026-10-20) — Ola 2 de remediación ##` | `## 5. Estado real verificado (2026-10-21) — Ola 8: \`EGO-FIND-83\` (retirado el crédito a khoj) ##` |
| 9 | `docs/review/backlog-khoj.md`, frontmatter `description` | «…extracción de patrones algorítmicos y **adaptación técnica** de Khoj hacia Ego» | «…**estudio** de patrones algorítmicos de Khoj como **referencia de diseño** para Ego (**sin traducción de código**)」 |
| 10 | `docs/review/backlog-khoj.md` §0, propósito + «Regla de Operación» | «Ego extrae únicamente la lógica algorítmica … **adaptándola** a TypeScript estricto» | «Ego **estudia** el patrón … como **referencia de diseño** y lo **implementa por su cuenta** … **No hay traducción de código**: `khoj` es AGPL-3.0 ⇒ **retirado todo el crédito a khoj**» |
| 11 | `docs/review/backlog-khoj.md` §0, criterio de `✅ Completada` | «existe el fichero **adaptado**» | «existe el fichero **propio de Ego**» |
| 12 | `docs/review/backlog-khoj.md` §0 | — | nuevo bloque **«Actualización Ola 8 (A5, 2026-10-21) — `EGO-FIND-83`»**: por qué `KHOJ-01..03` dejan de ser `✅ Completada` |
| 13 | `docs/review/backlog-khoj.md` §2, cabecera | `Archivo Khoj` · `Descripción & Adaptación en Ego` | `Archivo upstream (procedencia)` · `Descripción & Patrón en Ego` |
| 14 | `docs/review/backlog-khoj.md` §5, deuda | D1/D2 seguían abiertas | D1/D2 → **cerradas en Ola 8** (con el detalle de A2-bis: `DreamConsolidator` ya cableado, `MemoryCurator` pendiente) · D5 → README hecho / Backlog.md pendiente de A1 · **D6 nueva** → la matriz del maestro (A1) |

### 1.4 T1 (parte 4) — Los recuentos

| Documento | Antes | Ahora |
|---|---|---|
| `docs/extractions/khoj.md` §5 | `3 ✅ · 3 🚫 · 0 🆕 · 7 ⏳` | **`0 ✅ · 6 🚫 · 0 🆕 · 7 ⏳`** (13 tareas) |
| `docs/review/backlog-khoj.md` §1 | `\| 3 \| 3 \| 0 \| 7 \| **13** \|` | **`\| 0 \| 6 \| 0 \| 7 \| **13** \|`** |
| `docs/extractions/README.md` §4.1 | `\| khoj \| 13 \| 3 \| 3 \| 0 \| 7 \| 7.0 \|` | **`\| khoj \| 13 \| 0 \| 6 \| 0 \| 7 \| 7.0 \|`** |
| `docs/extractions/README.md` §4.1, `deepseek-harness` | `\| deepseek-harness \| 12 \| 1 \| 4 \| 3 \| 4 \| 6.5 \|` | **`\| deepseek-harness \| 12 \| 0 \| 5 \| 3 \| 4 \| 6.5 \|`** ← **arreglado aquí**: la fila estaba desfasada desde la Ola 5 (`DSEK-04` pasó de `✅` a `🚫`) y hacía que el `TOTAL` de la tabla no cuadrase con el `audit-extraction-gates.mjs` |
| `docs/extractions/README.md` §4.1, `TOTAL` | `**289** \| **54** \| **71** \| **130** \| **34**` | **`**289** \| **50** \| **75** \| **130** \| **34**`** |
| `docs/review/README.md` | `3 ✅ · 3 🚫 · 0 🆕 · 7 ⏳. chunking de 256 tokens…` | **`0 ✅ · 6 🚫 · 0 🆕 · 7 ⏳. patrones **estudiados** en khoj como referencia de diseño, **sin traducción de código** (`EGO-FIND-83`)…`** |
| `docs/review/README.md` (`deepseek-harness`) | `1 ✅ · 4 🚫 · 3 🆕 · 4 ⏳` | **`0 ✅ · 5 🚫 · 3 🆕 · 4 ⏳`** (mismo desfase de la Ola 5) |

**Comprobación de coherencia:** la suma de las 25 filas de `docs/extractions/README.md` §4.1 es ahora
`50/75/130/34` — **exactamente** lo que reporta `scripts/audit-extraction-gates.mjs`
(`✅50 · 🚫75 · 🆕130 · ⏳34 · en el limbo=0`). Antes no cuadraba (`54/71`).

### 1.5 Ficheros modificados (4)

- `docs/extractions/khoj.md` (ficha)
- `docs/review/backlog-khoj.md` (backlog)
- `docs/extractions/README.md` (§4.1 — recuentos)
- `docs/review/README.md` (recuento de `khoj` + `deepseek-harness`)

**No tocados:** `docs/roadmap/Backlog.md` (zona de A1) · `packages/**` (A6/A2-bis) · `scripts/**` (A7) ·
`docs/extractions/tools/*` (A7 los está moviendo) · las otras 24 fichas y sus backlogs.

---

## 2. Solicitudes fuera de zona (NO aplicadas)

### 2.1 Para A1 — `docs/roadmap/Backlog.md`: la matriz de compuertas (texto EXACTO)

**Por qué:** `scripts/verify-backlog-gates.mjs` compara la **última celda** de cada fila de compuerta del maestro
con el estado canónico del catálogo (`docs/review/backlog-*.md`, columna 7). Al pasar `KHOJ-01..03` a `🚫`, el
maestro tiene que reflejarlo. **Hay 4 filas** (no 3): `KHOJ-03` aparece **dos veces** en el maestro (una en la
matriz de la Fase 01, L221, y otra en la matriz de la Fase 06, L699).

**Estado actual de la puerta (esperado hasta que A1 aplique esto):**

```text
$ node scripts/verify-backlog-gates.mjs
filas de compuerta coherentes con el catálogo canónico: 542
DISCREPANCIAS (4):
  - KHOJ-03: Backlog=ok · catálogo=dis · celda=[✅ Completada]
  - KHOJ-01: Backlog=ok · catálogo=dis · celda=[✅ Completada]
  - KHOJ-02: Backlog=ok · catálogo=dis · celda=[✅ Completada]
  - KHOJ-03: Backlog=ok · catálogo=dis · celda=[✅ Completada]
exit 1
```

**Texto exacto a pegar (4 filas; en `docs/roadmap/Backlog.md`):** en cada una de estas 4 filas **sólo cambia la
última celda** (la del estado). **El resto de la fila no se toca** — incluida la celda con el enlace a la ficha.

```text
L221   KHOJ-03
  antes:  | ✅ Completada |
  después:| 🚫 Descartada (con justificación) — ver ../review/backlog-khoj.md §Catálogo Detallado |

L697   KHOJ-01
  antes:  | ✅ Completada |
  después:| 🚫 Descartada (con justificación) — ver ../review/backlog-khoj.md §Catálogo Detallado |

L698   KHOJ-02
  antes:  | ✅ Completada |
  después:| 🚫 Descartada (con justificación) — ver ../review/backlog-khoj.md §Catálogo Detallado |

L699   KHOJ-03
  antes:  | ✅ Completada |
  después:| 🚫 Descartada (con justificación) — ver ../review/backlog-khoj.md §Catálogo Detallado |
```

**Verificado por simulación (en memoria, sin tocar `Backlog.md`):** los 4 reemplazos encajan **byte a byte** en las
líneas 221/697/698/699 del maestro **tal y como está ahora mismo**, y al aplicarlos la puerta queda:

```text
filas de compuerta coherentes con el catálogo canónico: 546
reemplazos aplicados sobre el texto propuesto: 4/4
OK: con ese texto, `verify-backlog-gates.mjs` queda en VERDE (exit 0).
```

> ⚠️ **A1**: el número de línea puede moverse si sigues editando el maestro antes de pegar esto. El texto de cada
> fila es único, así que un buscador por `\`KHOJ-01\` | khoj |` basta.

#### 2.1.1 Y el lint del maestro: 3 correcciones exactas en `L1207`

`scripts/check-docs-lint.mjs` sale hoy en **exit 1** con **2 regresiones**, y **ninguna es de A5**: están en la fila
`EGO-FIND-82` (`docs/roadmap/Backlog.md`, **L1207**), que A1 editó con el texto de mi handoff anterior.

| Regla | Qué pasa | Corrección exacta |
|---|---|---|
| **MD056/table-column-count** | La fila tiene **12 celdas** en vez de **10**: el code span `` `\| Atribución \|` `` lleva 2 pipes **sin escapar** → parten la celda de descripción. | `` `\| Atribución \|` `` → `` `\\\| Atribución \\\|` `` |
| **MD038/no-space-in-code** (×13) | Code spans con espacios al principio o al final. | `` `Adapted from … — ` `` → `` `Adapted from … —` `` (el espacio, fuera) · `` ` · ` `` → `` `·` `` |
| **MD033/no-inline-html** | *(ya resuelto por A1)* el code span con `<upstream>`/`<LICENCIA>`/`<ruta>` se parseaba como HTML. | — |

**Verificado por simulación** (copia temporal de `Backlog.md` + markdownlint 0.15.0, **sin tocar** el maestro):
con esas 3 correcciones **MD038 y MD056 desaparecen** y sólo quedan los 2 `MD033` de L1148, que ya están en la
línea base.

> Además, la descripción de esa fila dice *"test propio de **8 casos**"*: la suite la amplió A7 y ahora son **14**
> (14 pass). Un número, si A1 quiere ajustarlo.

**Correcciones adicionales del maestro que contradicen la ficha (opcionales, no bloquean el gate).** No las he
aplicado por ser zona de A1, pero el maestro afirma cosas que la Ola 2 ya demostró **falsas** sobre `khoj`:

| Línea | Afirmación actual | Verdad (verificada en la Ola 2 y en `repos-referencia/khoj@ae229ca`) |
|--:|---|---|
| L697 | «Chunking de 256 **tokens** con **solapamiento** y digest **SHA-256**» | Khoj trocea en 256 **palabras**, con `chunk_overlap=0` y hash **MD5** (`text_to_entries.py:36-37`). SHA-256 y solapamiento 32 son **mejoras propias de Ego**. |
| L698 | «Metadatos jerárquicos (\`heading_path\`) en VantaDB» | En Khoj **no existe** el campo `heading_path`: la jerarquía se inyecta como prefijo de texto. En Ego es `headingPath`, un array estructurado. |
| L699 | «Filtrado por corte dinámico de umbral de similitud (\`ScoreThresholdFilter\`)» | `ScoreThresholdFilter.ts` es un fichero **de Ego**, no de Khoj. En Khoj el corte es la config `bi_encoder_confidence_threshold` (sin valor por defecto: `math.inf`). En Ego es una calibración fija 0.70 + min-max. |
| L221 | «📥 Corte **dinámico de confianza** en búsqueda híbrida» | El corte de Ego **no** es dinámico: es 0.70 + normalización min-max por lote. |

### 2.2 Para A7 — `scripts/**`: la puerta ya está movida; queda el generador

**Estado real ahora mismo** (lo he localizado antes de ejecutar nada):

| Ejecutable | Ubicación | Estado |
|---|---|---|
| `verify-extraction-provenance.mjs` (puerta) | **`scripts/verify-extraction-provenance.mjs`** | ✅ movido por A7 · `ROOT = join(HERE, "..")` correcto · **exit 0** (25/25) |
| `verify-extraction-provenance.test.mjs` | **`scripts/verify-extraction-provenance.test.mjs`** | ✅ movido por A7 · **14 tests, 14 pass, 0 fail** (A7 ha ampliado la suite) |
| `normalize-attribution.mjs` (generador) | **`docs/extractions/tools/normalize-attribution.mjs`** | ⚠️ **sigue en `docs/`** — es la petición **A5-S46** de mi handoff anterior, aún sin aplicar |

| # | Cambio pedido | Detalle |
|--:|---|---|
| **A5-S49** | Mover `docs/extractions/tools/normalize-attribution.mjs` → `scripts/normalize-attribution.mjs` | Es el único ejecutable que queda en `docs/` (un `docs/` no debe contener ejecutables que **mutan** las fichas). Al moverlo hay que cambiar `ROOT = join(HERE, "..", "..", "..")` → `join(HERE, "..")` (3 niveles → 1). **NO lo he movido yo** por tu instrucción. |
| **A5-S50** | Decidir si la puerta entra en CI | Sigue pendiente: **en CI no existen los clones de `repos-referencia/`**, así que la puerta tal cual fallaría con 25 × `upstream-inexistente`. Opciones: (a) no ejecutarla en CI (documentado), (b) un flag `--sin-clones` que valide sólo forma + coherencia ficha↔backlog, (c) clonar los 25 repos (pesado). **Decisión de A7.** |
| **A5-S51** | `scripts/sync-extraction-indexes.mjs` (`CATALOG`) | Sus recuentos siguen desfasados: ahora el catálogo es **✅50 · 🚫75 · 🆕130 · ⏳34** (antes ✅53 · 🚫72). Petición heredada de la Ola 5 (A5-S3) + el cambio de esta ola. |

> Nota: **no he tocado ninguna ruta de import** de los ejecutables de A7, ni he movido ni borrado
> `docs/extractions/tools/*`, tal y como pediste.

### 2.3 Para A2-bis — confirmación (no hay ninguna petición pendiente)

A2-bis ya retiró las referencias `KHOJ-xx` del código (0 en `packages/**`) ✅. Esta ola cierra la **otra mitad**:
el catálogo. No hay ninguna petición abierta para A2-bis más allá de `MemoryCurator` (que ya está en su propio diff
§6.3 y cuya evidencia he incorporado en el texto de `KHOJ-05`).

### 2.4 Para A8 (informativo)

- `docs/extractions/khoj.md` §4 y §5 han cambiado de estructura (columna renombrada, leyenda nueva, 5 filas con
  veredicto nuevo).
- `docs/extractions/README.md` §4.1 y `docs/review/README.md` tienen recuentos nuevos (`khoj` 0/6/0/7 y TOTAL
  50/75/130/34).
- Si la matriz de 22 secciones del VERDICT §7 cita `khoj: 3 ✅ · 3 🚫` o el `TOTAL` 54/71, hay que refrescarlo.

---

## 3. Verificación

| # | Comando | Exit | Resumen |
|--:|---|:--:|---|
| 1 | `node scripts/audit-extraction-gates.mjs` | **0** | `khoj KHOJ 13 0/6/0/7 · 0/6/0/7 · 0/6/0/7 OK` · `25 repos · 289 tareas` · `✅50 · 🚫75 · 🆕130 · ⏳34 · en el limbo=0` · `No canónicos: 0` |
| 2 | `node scripts/verify-backlog-gates.mjs` | **1** ⚠️ | `542` coherentes + **4 discrepancias** (`KHOJ-01`, `KHOJ-02`, `KHOJ-03` ×2) — **exactamente** las 4 filas del maestro que A1 debe cambiar (§2.1). Verificado por simulación: con ese texto la puerta queda **exit 0 / 546 coherentes**. |
| 3 | `node docs/testing/check-docs-paths.mjs` | **0** | `0 enlaces rotos, 0 rutas inexistentes en docs canónicos` |
| 4 | `node scripts/check-docs-lint.mjs` | **1** ⚠️ | Las **3** regresiones son **todas** de `docs/roadmap/Backlog.md` (MD033/MD038/MD056), del cambio concurrente de **A1** — **0 regresiones en `docs/extractions/**` y `docs/review/**`** (verificado con markdownlint directo sobre mis 4 ficheros) |
| 5 | `node scripts/verify-extraction-provenance.mjs` (ruta nueva de A7) | **0** | `OK: 25 fichas con procedencia verificada (upstream, licencia, commit, ruta de origen e IDs)` |
| 6 | `node --test scripts/verify-extraction-provenance.test.mjs` (ruta nueva de A7) | **0** | `tests 14 · pass 14 · fail 0` |
| 7 | `node docs/extractions/tools/normalize-attribution.mjs --check` | **0** | `cambios: 0` → el generador sigue **idempotente** tras mis cambios (las 25 fichas no se han movido de forma) |

Además, comprobado a mano:

- **0** afirmaciones residuales de derivación en las 2 fichas de khoj (barrido con lista negra explícita).
- **0** filas de catálogo en las 25 fichas y 25 backlogs afirman derivación de código.
- `git status --porcelain -- docs/extractions docs/review` → 27 modificados (25 fichas de la Ola 8 + `README.md` +
  `review/README.md` + `backlog-khoj.md` + `khoj.md`) + `docs/extractions/tools/` nuevo. **Ningún cambio fuera de
  mi zona.**

---

## 4. Deuda / no resuelto

| # | Deuda | Dueño | Nota |
|--:|---|---|---|
| 1 | **La matriz de compuertas del maestro** (`KHOJ-01`, `KHOJ-02`, `KHOJ-03` ×2) sigue con `✅ Completada` ⇒ `verify-backlog-gates.mjs` en **exit 1** con 4 discrepancias | **A1** | Texto exacto y línea en §2.1; verificado por simulación (queda exit 0 al aplicarlo). **No lo he editado por ser zona de A1.** |
| 2 | `docs/roadmap/Backlog.md` tiene **3 regresiones de markdownlint** (MD033/MD038/MD056) introducidas por el cambio concurrente de A1 (L1148, L1207) | **A1** | `check-docs-lint.mjs` sale en exit 1 por eso. No es una regresión mía (0 en `docs/extractions/**` y `docs/review/**`). |
| 3 | Descripciones del maestro que contradicen la ficha (L221/L697/L698/L699: «256 tokens», «SHA-256», «`heading_path`», «`ScoreThresholdFilter`» como fichero de khoj) | **A1** | Tabla en §2.2. No bloquean el gate, pero son afirmaciones falsas sobre `khoj` en un documento canónico. |
| 4 | El generador `normalize-attribution.mjs` sigue en `docs/extractions/tools/` | **A7** | A5-S49 (§2.2). |
| 5 | La puerta no puede correr en CI sin los clones de `repos-referencia/` | **A7** | A5-S50 (§2.2). |
| 6 | `CATALOG` de `scripts/sync-extraction-indexes.mjs` con los recuentos anteriores | **A7** | A5-S51 (§2.2) — ahora `✅50 · 🚫75 · 🆕130 · ⏳34`. |
| 7 | `khoj` **sigue en el catálogo** (25 repos · 289 tareas) | **A1** | `EGO-FIND-83` dice «retirar todo el crédito», no «borrar el repo». Mi puerta impide que una fila afirme derivación de khoj, pero **no** lo borra del catálogo: eso es una decisión de A1 (y de `scripts/sync-extraction-indexes.mjs`, A7). |
| 8 | `MemoryCurator` sigue sin instanciar | **A2-bis** | Ya recogido en el texto de `KHOJ-05` y en la deuda D2 del backlog (con el puntero al diff §6.3 de A2-bis). |
