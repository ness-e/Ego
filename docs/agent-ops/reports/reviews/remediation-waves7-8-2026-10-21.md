# Cierre de la remediación — Olas 7 y 8 (2026-10-21)

**Alcance:** cierre de las olas 7 y 8 de la remediación iniciada por la auditoría de 8 agentes.
**Estado:** ✅ **24/25 checks en verde** (el único rojo es `pnpm test` del `@ego/renderer`, **flake de concurrencia** verificado en aislamiento) ·
**25 ADRs** · **95+ puertas** en `scripts/` + CI.
**Informes fuente:** [`review-full-2026-10-19.md`](./review-full-2026-10-19.md) ·
**Plan y veredicto:** [`../../plans/2026-10-19-remediation-wave1/VERDICT.md`](../../plans/2026-10-19-remediation-wave1/VERDICT.md)

---

## 1. Ola 7 — contabilidad honesta

El trabajo de las olas 3-6 estaba **hecho pero no registrado**: tres filas del Backlog seguían marcando como pendientes
tareas que los agentes ya habían resuelto. El valor de la ola fue **distinguir "no hecho" de "hecho y sin documentar"**.

| Fila | Antes | Realidad verificada | Resultado |
|---|---|---|---|
| `EGO-FIND-49` | 🆕 Pendiente | `McpClient.ts:341` ya impedía que un MCP **pisara** una tool nativa, y `McpManager.ts:297-302` lo emitía al EventBus | ✅ |
| `EGO-FIND-29` | 🟡 Parcial | Las **5 APIs** cognitivas ya estaban cableadas por el puente HybridRuntime + [ADR-0023](../../../adr/0023-path-cognitivo-nativo.md) | ✅ (upstream `VDB-REQ-16a` explícito) |
| `EGO-FIND-89` | 🟡 Parcial | El circuito de presupuesto estaba cerrado de extremo a extremo **con el router real** (degradación + parada tipada + tope MÍNIMO) | ✅ |
| `DIST-09` | 🆕 Pendiente | `vantadb-node@0.9.0` publicado; los 2 manifiestos lo apuntan; **0** rutas `file:` | ✅ |
| `CHAR-03` | 🆕 Pendiente | El motor canónico existe y [ADR-0018](../../../adr/0018-motor-de-personaje.md) está publicado | ✅ |

### Dos bugs reales que salieron al verificar

1. **`canvas-interaction.test.ts` sin presupuesto explícito** → un E2E de 6 pasos con reapertura en frío (coste real ~2 s) **desbordaba
   el timeout de 5 s** bajo la carga de la suite completa. Pasa aislado en 2,44 s. No era flake: era un umbral mal puesto.
2. **`EGO-FIND-104` (workstream paralelo):** el flag `muted` del audio del avatar **ocultaba la tarjeta de aprobación HITL** →
   silenciar el sonido hacía desaparecer una petición de aprobación. Es un bug de producto, no de test.

---

## 2. Ola 8 — atribución de licencia: el error y su corrección

### El error

La primera versión de la Ola 8 aplicó la cabecera `Adapted from <upstream> (<LICENCIA>), <ruta>` al **catálogo**: 25 filas de ficha
y 39 celdas de backlog. Eso afirmaba una **derivación de código que no existe** — `COUC-03` (`ApprovalEngine`) es implementación
propia de Ego que asimila un patrón, no un port de `IslandTypes.swift`.

El riesgo no era cosmético: `khoj` es **AGPL-3.0**, y `EGO-FIND-83` ya había resuelto que el código atribuido a khoj era propio.
Un crédito de derivación a un repo AGPL sobre código propio es una mentira con consecuencias de licencia.

La evidencia dura la dio la clasificación de `packages/avatar/**`: **86 ficheros, 63 derivados + 23 nativos**, medidos con
residuo de *shingles* de 48 caracteres contra el clon y prueba de literales (no lectura de comentarios).

### La corrección: tres planos

Queda registrado en **[ADR-0025](../../../adr/0025-dos-planos-de-atribucion.md)** y en `docs/extractions/README.md` §4.3-§4.4:

| Plano | Qué es | Qué lleva |
|---|---|---|
| 1 · Código derivado | un port literal | `Adapted from <upstream> (<LICENCIA>), <ruta>` + `LICENSE.md` en el paquete |
| 2 · Patrón asimilado | código **propio** que implementa una idea | texto veraz: *"implementación propia; patrón asimilado, sin traducción de código"* |
| 3 · Catálogo | la ficha y el backlog | **procedencia** del upstream (upstream, licencia, commit, ruta) como *datos*, nunca como derivación |

### Lo que quedó

| Métrica | Antes | Después |
|---|---|---|
| Cabeceras canónicas en `packages/**` | 6 (y muchas falsas) | **64** reales, **0** falsas |
| `packages/avatar/**` clasificado | sin clasificar | **86 ficheros**: 63 derivados + 23 nativos, con manifiesto |
| Ficheros del resto de `packages/**` | sin clasificar | **27** → D=5 · P=22 · N=3 · **6 afirmaciones falsas corregidas** |
| `LICENSE.md` de paquete | 2 | **5** (`avatar`, `tool-call-repair`, `tools`, `ui-runtime`) |
| Referencias `KHOJ-xx` en el código | 17 | **0** |
| Filas del catálogo de khoj que afirmaban asimilación | 5 | **5** a `🚫 Descartada` (se descarta la atribución, no la capacidad) |
| Puertas | 0 | **2** (`verify-extraction-provenance`, `verify-attribution`) + **2 pasos bloqueantes en CI** |
| Modo degradado en CI | — | `--sin-clones`: verifica estructura sin los clones, y **declara el modo** en la salida |
| ADRs | 24 | **25** |

La atribución es ahora **reproducible**: un generador idempotente (`--check` → 0 cambios) produce las cabeceras desde el
manifiesto, y `LICENSE.md`/`NOTICE` se **generan** desde el mismo manifiesto → no pueden divergir.

### Lo que se reparó de paso

- **5 filas de la matriz de compuertas** del Backlog con el **code span sin cerrar**: el span se comía los `|` de las celdas y
  rompía la tabla (MD038 ×13 + MD056). Se repararon con el texto íntegro de las fichas, no absorbiéndolas en el baseline.
- **4 celdas de khoj** en la matriz, alineadas al catálogo, con las descripciones corregidas a la verdad (khoj cuenta **palabras**
  con solapamiento 0 y usa MD5; `heading_path` no existe; `ScoreThresholdFilter` es fichero de Ego; el corte es 0.70 + min-max).
- **La licencia del motor canvas**, que afirmaba `(MIT)` sobre un fichero cuyo `LICENSE.md` dice *"según archivo de origen"*:
  el owner decidió el 2026-10-21 registrar la frase literal *"licencia no declarada en el origen"*.

---

## 3. El trabajo que quedó cableado de verdad

### `DreamConsolidator` (`EGO-FIND-22`)

Estaba implementado y testeado, pero **nadie lo llamaba**: la consolidación de hechos no ocurría nunca en el producto, así que
el trabajo de la Ola 1 (dedup por normalización, paginación por cursor) estaba **muerto en la práctica**.

- Motor movido de `packages/tasks/` a `packages/memory/` (dirección de dependencias `tasks → memory`; API público conservado).
- Cableado en el **hook de inactividad de 5 min que ya estaba en producción**: `EgoMemoryLifecycle.ts:164` → `:363` → `:454`.
- **Evidencia observable:** entrada inmutable `gov/audit` con acción `dream_consolidation` + estado del registro en `kb/facts`
  (`is_latest:false` / `superseded_by`) + purga de `quarantine/pending` expirados.
- `MemoryCurator` sigue **sin instanciar**: el diff exacto está en `handoff/A2bis-ola8.md` §5.4 → la fila queda 🟡.

### `D4` — sustituir los puertos verbatim de Mochi por geometría propia

A6 demostró que la sustitución **nunca se hizo** en `studio/render/accessories.js` (era 366/366 idéntico al clon) y que quedan
**5 ficheros** con código verbatim (×2 copias: el paquete y la vendorizada). El owner aprobó **ejecutarla el 2026-10-21**.
Mientras tanto están **correctamente atribuidos** como derivados, así que la deuda es de diseño, no legal.

---

## 4. Contabilidad al cierre

| Ámbito | Estado |
|---|---|
| Hallazgos de la auditoría (`EGO-FIND`) | **106** · **93 ✅** · 3 🟡 · 10 🆕 |
| Tareas canónicas del roadmap (12 fases + 03.1) | **149 de 151** · las 2 pendientes son **bloqueo del owner** (`DIST-04`, `DIST-06`) |
| Catálogo de extracción (25 repos) | **289** tareas · **0 en el limbo** · ✅50 · 🚫75 · 🆕130 · ⏳34 |
| Puertas | 25 verificadas en verde |
| ADRs | 25 |

### Las 13 filas que siguen abiertas

| Id | Estado | Qué falta |
|---|---|---|
| `EGO-FIND-22` | 🟡 | `MemoryCurator` con 0 instanciaciones (diff en el handoff de A2-bis) |
| `EGO-FIND-63` | 🟡 | 6 ficheros / 14 asserts que inspeccionan texto de fuente |
| `EGO-FIND-94` | 🟡 | la parte de Ego está cerrada; queda **upstream** (`VDB-REQ-16a`) |
| `EGO-FIND-81` | 🆕 | canal de obtención del token MCP → **decisión del owner** |
| `EGO-FIND-87` | 🆕 | `VDB-REQ-14` (320 MB de pre-reserva por store) → **upstream** |
| `EGO-FIND-96..103` | 🆕 | 8 hallazgos de la auditoría visual/UX del **workstream paralelo** |

### Las decisiones del owner

**Resueltas el 2026-10-21:**

- *Alcance de la atribución del catálogo* → **las 25 fichas** (y el código derivado, no solo el catálogo).
- *Licencia del motor canvas* → **literal "no declarada en el origen"**.
- *D4 (puertos verbatim de Mochi)* → **ejecutar ahora**.

**Siguen pendientes:**

| # | Decisión | Por qué no se cierra desde el repo |
|---|---|---|
| 1 | **Canal de obtención del token MCP** (`EGO-FIND-81`) | Un cliente MCP externo no puede autenticarse sin él |
| 2 | **Cifrado at-rest** (`VDB-REQ-08`) | 0 soporte en el binding 0.9.0; afecta al 100 % del estado persistente |
| 3 | **Certificados de firma** (`DIST-04`) | Material que solo el owner puede conseguir |
| 4 | **Prueba en VM limpia** (`DIST-06`) | Infraestructura externa |
| 5 | **Registro global vs. vista filtrada por Sub-Ego** | Producto. Se recomienda la **vista filtrada** por `subEgoId` |
| 6 | **Replacement del detector de inyección de prompt** | Al retirar `UntrustedContentSanitizer`, el `TrustBoundary` cubre canal dual y taint, pero la **detección** quedó sin módulo |

### Las peticiones a upstream de VantaDB

`VDB-REQ-14` (pre-reserva de 320 MB por store, no parametrizable) · `VDB-REQ-16a` (el wrapper `vantadb@0.9.0` no re-expone las APIs
cognitivas; mitigada en Ego por el puente HybridRuntime).
