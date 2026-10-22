# Cierre de la remediación — Olas 9 y 10 (2026-10-21)

**Alcance:** cierre de las olas 9 y 10 de la remediación iniciada por la auditoría de 8 agentes, y la
**publicación** de todo el trabajo acumulado.
**Informe fuente:** [`review-full-2026-10-19.md`](./review-full-2026-10-19.md) ·
**Plan y veredicto:** [`../../plans/2026-10-19-remediation-wave1/VERDICT.md`](../../plans/2026-10-19-remediation-wave1/VERDICT.md)

---

## 1. Las decisiones del owner (2026-10-21)

Se tomaron **5** decisiones con el question tool, y **3** ya estaban resueltas:

| # | Decisión | Veredicto | Dónde está |
|---|---|---|---|
| A | Canal de obtención del token MCP (`EGO-FIND-81`) | **Keychain + CLI local** | `ego mcp token` (`--out` a fichero 0600, `--json`) · [ADR-0021](../../../adr/0021-mcp-server-transporte-y-token.md) |
| B | Cifrado at-rest (`VDB-REQ-08`) | **Documentar el riesgo y esperar al upstream** | `docs/architecture/memoria-vantadb.md` §14 (la afirmación heredada "AES-256-GCM" era **falsa** → corregida) |
| C | Registro de tools: global vs. vista filtrada | **Vista filtrada por Sub-Ego** | [ADR-0027](../../../adr/0027-vista-filtrada-del-registro-de-tools.md) |
| D | Hueco de detección de inyección de prompt | **Reconstruir el detector** (determinista) | [ADR-0026](../../../adr/0026-contenido-no-confiable-se-degrada.md) |
| E | Publicación de los commits | **Publicar ahora** | `origin/master` = `6eb65b2`, 0 commits sin publicar |

Además, ya estaban decididos: **D4** (sustituir los puertos verbatim de Mochi por geometría propia) → ejecutada en la Ola 9;
**licencia del motor canvas** → se mantiene la frase literal *"licencia no declarada en el origen"*.

## 2. Lo que se cerró

### 2.1 Atribución de licencia — de la atribución falsa al modelo de 3 planos

La primera versión de la Ola 8 aplicó la cabecera `Adapted from …` al **catálogo** (25 fichas + 39 celdas),
afirmando una derivación de código que **no existe**. El riesgo no era cosmético: `khoj` es **AGPL-3.0** y
`EGO-FIND-83` ya había resuelto que el código atribuido a khoj era **propio**.

La clasificación con evidencia dura (residuo de *shingles* de 48 caracteres contra el clon + prueba de literales)
dio **88 ficheros del motor: 58 derivados + 31 nativos**. De ahí el modelo de **3 planos** ([ADR-0025](../../../adr/0025-dos-planos-de-atribucion.md)):

| Plano | Qué es | Qué lleva |
|---|---|---|
| 1 · Código derivado | un port literal | `Adapted from <upstream> (<LICENCIA>), <ruta>` + `LICENSE.md` |
| 2 · Patrón asimilado | código **propio** que implementa una idea | texto veraz, **sin** `Adapted from` |
| 3 · Catálogo | la ficha y el backlog | **procedencia** del upstream como datos, nunca como derivación |

- **Crédito a khoj retirado por completo**: 17 → **0** referencias en el código; las **5** filas del catálogo a
  `🚫 Descartada` (se descarta la atribución, no la capacidad).
- El contrato (manifiesto → cabeceras + `LICENSE.md`/`NOTICE` + puerta que **muerde**) está en **4** paquetes.
- **D4 ejecutado**: 6 ficheros que eran ports literales (hasta **95,1 %** de residuo) son hoy geometría propia
  (**0,0 %**), con la puerta `no-verbatim:check` que impide revertirlo en silencio.

### 2.2 D4 — geometría propia, medida

| Fichero | Residuo antes | Ahora |
|---|---|---|
| `render/ara-head.js` | **95,1 %** | 0 % — cúpula propia (exponente 3,4, corona plana) |
| `studio/sound.js` | 64,5 % | 0 % — catálogo de gestos + renderizador genérico |
| `studio/render/accessories.js` | 66,4 % | 0 % — catálogo + 8 piezas genéricas |
| `runtime/poses.js` | 38 % | 0 % — tabla derivada de intenciones |
| `render/body.js` | 10,2 % | 0 % — pipeline propio |
| `core/timeline.js` | 3,4 % | 0 % — runner propio |

La geometría propia está **medida** como al menos tan buena (Hausdorff 10,97 px; área 4,43 % distinta) y hay un
*property test* que **falla** si se restaura la silueta.

### 2.3 El detector de inyección de prompt

`packages/security/src/PromptInjectionDetector.ts`: **determinista**, sin LLM ni red, **5 familias** de vector,
normalización previa (NFKC + ceros anchos + homoglifos) y salida `{verdict, signals, normalized, truncated}` con
evidencia acotada. El `TrustBoundary` lo aplica con **política configurable** (`suspicious` ⇒ siempre canal sin
privilegios + marca + registro; `block` opt-in) y **fail-open explícito**.

**Tasa de falsos positivos medida sobre el corpus real: 0,060 %** (1 de 1 664 ficheros); bruta 0,240 %. Bajó desde
1,908 % ajustando **6 reglas contra la medición**, no subiendo umbrales a ciegas.

### 2.4 La vista filtrada del registro de tools

El registro global sigue siendo la **única fuente de verdad**; cada Sub-Ego consulta una **proyección** por dueño
(`subEgoToolsView`), recalculada en cada consulta → el *arrival tardío* se ve **sin reconstruir nada**. `ownerSubEgoId`
es de primera clase; el ámbito del MCP es un **tipo** (`{scope:"app"}` | `{scope:"sub-ego"}`), **persistido**, no un
parámetro que se pueda olvidar. `expand_tools` **falla cerrado** y la ejecución usa un error **tipado**
(`ToolNotVisibleToSubEgoError`, categoría `TOOL_NOT_VISIBLE` ≠ `TOOL_NOT_FOUND`).

### 2.5 Los 8 hallazgos visuales del renderer

CTA deshabilitado **distinguible sin depender de la opacidad** · **1** superficie de modelo + **1** de Sub-Ego (antes
3 y 2) · *empty states* con guía (componente nuevo) · paletas canónicas **visibles e intercambiables** · **un** idioma
de CTA primario · **un** anillo de foco · se quita `transition-[width]` (un panel redimensionable tiene que refluir) ·
la escala de motion **ya existía**: el defecto eran los defaults sueltos de Tailwind → 26 sustituciones a tokens.

### 2.6 La curaduría de memoria, que no curaba

`runOnce()` hacía **una sola** `list(ns, 50)` sin cursor: los registros más allá del puesto 50 **nunca se curaban**, y
siempre los mismos 50. Ahora **pagina con cursor opaco** hasta agotar el namespace, con **presupuesto explícito**
(500 examinados / 5 000 leídos) y `partial: true` al truncar. El motor **no indexa por `ts`** ⇒ se trae por clave y se
ordena en memoria (**medido, no inventado**), y el presupuesto se gasta en los **más antiguos** ⇒ la curaduría converge.

**Coste medido contra VantaDB real**: lectura 0,17-1,0 ms/reg; el coste dominante eran las **escrituras**
(25-33 ms/reg con `put` individual vs **0,99-1,20 ms/reg con `putMulti`: 27×**) ⇒ el curator marca **en lote**.

### 2.7 Las puertas que no estaban en ningún pipeline

De **22 ejecutables verificadores**, **5 no estaban cableados en CI**. Se cablearon (4 pasos nuevos **bloqueantes**) y
se añadió la puerta que cierra el **patrón de raíz**: `scripts/verify-ci-gates.mjs` enumera las 22 puertas, clasifica
cada una (`directo` · `delegador` · `vía npm` · `exenta` · **SIN CABLEAR**) y **falla** si aparece una puerta sin
cablear y sin exención con motivo.

## 3. Bugs reales encontrados por el camino

| # | Bug | Detalle |
|---|---|---|
| 1 | El hook rechazaba commits grandes | `lint-staged` no excluía la copia vendorizada del renderer ⇒ oxlint recibía rutas ignoradas y salía con *"No files found to lint"*; y con ~97 ficheros, `cmd.exe` rechazaba la línea de comandos (8191 chars). Resuelto con `.lintstagedrc.mjs` + lint **por lotes** |
| 2 | Apagar y volver a encender un servidor MCP **fallaba siempre** | El `exit` del subproceso viejo rechazaba el handshake del nuevo (mapa `pendingRequests` compartido) |
| 3 | La puerta de verbatim **no medía nada** | El presupuesto vivía en un campo *opcional* ausente del manifiesto ⇒ 0 ficheros medidos ⇒ la puerta pasaba sin mirar nada. Ahora: si no mide ⇒ **falla** |
| 4 | La puerta de atribución **podía aprobarse a sí misma** | `--fix` mutaba el repo ⇒ ahora escribe una **propuesta**; aplicarla exige `--fix --apply` |
| 5 | El `index.d.ts` del motor no compilaba contra sí mismo | El barrel usaba `EyeBobCfg` sin declararlo y `EgoAvatar` estaba duplicado ⇒ de 88 a **170** exportaciones, generadas |
| 6 | El perfil de personaje persistía pero no alimentaba el render | El renderer no lo pasaba al motor |
| 7 | `coucou-mochi` seguía vivo en el renderer | El valor por defecto de `baseForm` ofrecía un preset que D4 había eliminado del motor |
| 8 | La escala de motion no estaba canonizada | Los defaults de Tailwind en producción, no tokens |

## 4. Contabilidad al cierre

| Ámbito | Estado |
|---|---|
| Hallazgos de la auditoría (`EGO-FIND`) | **123** · **115 ✅** · 5 🟡 · 3 🆕 |
| Tareas canónicas (12 fases + 03.1) | **149 de 151** (las 2 pendientes son **bloqueo del owner**: `DIST-04`, `DIST-06`) |
| Catálogo de extracción (25 repos) | **289** tareas · **0 en el limbo** |
| ADRs | **27** |
| Puertas | **27** verificadas, **26 pasos** en el job `verify` |
### Las 8 que quedan abiertas

| Id | Estado | Qué falta exactamente |
|---|---|---|
| `EGO-FIND-63` | 🟡 | 1 fichero (3 asserts) en la zona de A7 · el inventario de la zona de A4 bajó de 11 a **0** |
| `EGO-FIND-82` | 🟡 | Las **3** puertas nuevas de paquete (`tool-call-repair`, `tools`, `ui-runtime`) no están cableadas en CI |
| `EGO-FIND-87` | 🆕 | `VDB-REQ-14` (**upstream**): 320,03 MB de pre-reserva por store |
| `EGO-FIND-94` | 🟡 | La parte de Ego está cerrada; queda **upstream** (`VDB-REQ-16a`) |
| `EGO-FIND-108` | 🆕 | El detector de tests tautológicos exige `readFileSync` **en la misma línea** ⇒ no ve las lecturas en un helper |
| `EGO-FIND-116` | 🟡 | El renderer ya pasa `base-form`/`traits`/`outfit`; falta que **el motor los observe** |
| `EGO-FIND-119` | 🟡 | Falta el **canal main→canvas** de la atención |
| `EGO-FIND-122` | 🆕 | El smoke test del **bundle real**: que no resuelva Node/Rust/Python, que los `.node` carguen desde `asarUnpack` y que no falten DLLs |

## 5. Publicación

**Publicada** (`origin/master` = `6eb65b2`). Hasta esta ola, `master` estaba **99 commits** por delante del remoto
(`330abdb`), sin publicar desde el inicio de la remediación: el trabajo no tenía red de seguridad hasta que el owner
decidió publicarlo.
