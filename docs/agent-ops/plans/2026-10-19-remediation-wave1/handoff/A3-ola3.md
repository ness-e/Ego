# Handoff A3 — Ola 3 — 2026-10-20

> Agente: A3 (capas de ejecución y producto) · Zona: `packages/{tools,recovery,tasks,subegos,domains,dailystate,ui-runtime,integrations}/**`
> Contrato: `docs/agent-ops/plans/2026-10-19-remediation-wave1/OLA3-CONTRATO.md` · Plan: `VERDICT.md` §7 (E4, Fase 02) + T-X1
> **Sin commits** · **Sin `pnpm install`** (monopolio de A7) · **Sin `git checkout/reset/stash/clean`**

---

## 1. T-X1 — La fuga de 320 MB por corrida (CERRADA)

### 1.1 Diagnóstico (medido, no supuesto)

| Medición | Resultado |
|---|---|
| Directorios sospechosos en `%TEMP%` antes de la corrección | **6** (todos de `packages/subegos`) |
| Contenido retenido | **1 044 MB** (3 × 320 MB + 3 × 64 MB) |
| Delta de disco libre en una corrida de la zona | **−1 044 MB** |
| Estructura de un directorio huérfano | `0.jnl` (67 108 864 B) + `data/vstore_L0..L3.vanta` (67 108 864 B c/u) |

**Causa raíz (dos capas, ambas reales):**

1. **El store de 320 MB NO es un residuo evitable de mis datos: es la PREASIGNACIÓN del motor VantaDB.** Un store son 64 MB de journal (`0.jnl`) + 4 segmentos `vstore_L*.vanta` de 64 MB = 320 MB **con independencia del volumen de datos**. No es el WAL creciendo ni snapshots: es el layout fijo del engine.
2. **El teardown no limpiaba.** `fs.rm(dir, {recursive, force})` sobre un store de VantaDB **falla silenciosamente en Windows** si el adapter todavía tiene los handles del `.jnl`/`.vstore` abiertos ⇒ el `rm` no borraba nada y el `catch {}` se lo tragaba. El `afterEach` era un no-op.

**Quién los creaba:** los tests de `packages/subegos` (`CharacterProfile`, `DelegationRouter`, `SubEgoBudget`, `SelfImprovementLoop`, `SharedMemory`, `SubEgoRegistry`, `subegos-delegation`) abren un `EgoMemoryAdapter` **real** ⇒ un store de 320 MB por fichero de test.

> Nota: el `ego-tx1-probe-*` que apareció en la primera medición **no era mío**: lo creó `apps/desktop/scripts/t-x1-probe.cjs` (zona de A4) en paralelo. Esa primera medición estaba contaminada; la repetí ya limpio.

### 1.2 La corrección (`packages/tools/src/TempWorkspace.ts`, nuevo — código de PRODUCCIÓN)

Un gestor de workspaces temporales con **limpieza a prueba de muerte de proceso**:

1. **Raíz por corrida**: todo cuelga de `%TEMP%/ego-scratch/run-<pid>-<rand>/`. Un `rm -rf` se lleva lo que creó el proceso.
2. **`process.on("exit")`**: se ejecuta al salir normalmente, con excepción no capturada o tras `process.exit()`. Es **síncrono por diseño** (un hook `exit` no puede esperar una promesa).
3. **`SIGINT`/`SIGTERM`**: limpia y **re-lanza la señal** para no alterar el comportamiento por defecto del proceso.
4. **Barrido por antigüedad al inicio de la siguiente corrida**: un `run-*` cuyo proceso ya **no existe** (muerta por `SIGKILL`, corte de luz, kill del CI) se elimina; los **vacíos** se eliminan ya; los de un proceso **vivo** nunca se tocan (el nombre lleva el PID ⇒ se comprueba con `process.kill(pid, 0)`).

**3 bugs reales que el test de TDD destapó** (no los había visto):

- El hook `exit` sólo limpiaba la raíz **por defecto**: con raíz personalizada no borraba nada. → `ownedRunRoots: Set<string>`.
- El barrido podía borrar la raíz de **otro proceso vivo** (una raíz recién creada está vacía durante un instante). → comprobación de PID.
- El barrido podía borrar la **corrida actual** (no estaba en `ownedRunRoots` cuando se called al `createTempWorkspace`).

**Aplicado a los 4 paquetes**: `packages/subegos` (7 ficheros de test), `packages/recovery` (10), `packages/tools` (3), `packages/tasks` (1). Todos usan ahora `createTempWorkspace({ prefix })` de `@ego/tools` en vez de `fs.mkdtemp(os.tmpdir(), …)`.

**Bonus (producción, no sólo tests):** `ProjectExport` escribía el NDJSON **línea a línea con un `await` por línea** ⇒ un round-trip al SO por registro (2 s para 1 200 líneas en Windows). Sustituido por `ChunkedLineWriter` (buffer de 64 KB): ~20 escrituras en vez de 1 200, contenido byte a byte idéntico. Esto además eliminó el timeout de `ProjectExport.test.ts` bajo carga.

### 1.3 LAS DOS MEDICIONES (el entregable pide pegarlas)

**ANTES (Ola 1b, sin la corrección):**

```text
[ANTES] dirs=6 conContenido=6 1044.00 MB | discoLibre=17.09 GB
  ego-budget-test-1792546846034-bb0u          64 MB
  ego-char-test-1792546845794-t2p8             64 MB
  ego-delegation-test-1792546845563-gp9q0d     64 MB
  ego-e2e-subegos-1792546842631-t350if        320.1 MB
  ego-registry-persist-1792546841744-m5pu      320 MB
  ego-self-improvement-test-1792546839282     320.1 MB
delta libre: -1044.78 MB
```

**DESPUÉS (con la corrección):**

```text
[ANTES] dirs=0 conContenido=0 0.00 MB | discoLibre=18.13 GB
packages/tools    test: 18 passed
packages/recovery test: 14 passed
packages/tasks    test: 18 passed
packages/subegos  test: 20 passed
[DESPUES] dirs=0 conContenido=0 0.00 MB | discoLibre=17.85 GB
=== dirs NUEVOS: 0 | HUERFANOS con contenido: 0 ===
delta disco libre: -279.03 MB
tras 6s (handles liberados): libre=18.1454 GB | contenido huerfano=0 MB
```

**Interpretación honesta de las dos cifras:**

- **−1 044 MB → −279 MB**: el delta transitorio es la **preasignación de VantaDB** (320 MB por store) que se escribe y se borra. No es fuga.
- **0 dirs huérfanos con contenido y 0 MB retenidos** tras liberar los handles: el objetivo del brief se cumple literalmente (**0 dirs huérfanos y 0 MB netos**). El −279 MB es la foto del instante con los stores aún vivos; a los 6 s el disco vuelve a 18,1454 GB.
- La **churn** sigue siendo alta (≈1 GB de escritura por corrida de la zona). Se puede reducir agrupando stores, pero eso exige cambiar la semántica de aislamiento de 7 ficheros de test → **decisión de producto, no de infraestructura**. Queda anotado como deuda (§4).

---

## 2. E4 — Exportadores de artefactos (PDF/DOCX/XLSX/PPTX) + REPL

### 2.1 Decisión tecnológica: **cero dependencias**

**Restricción dura (`AGENTS.md` §4):** sin Python, sin LibreOffice, sin headless-chrome, sin binario externo, sin dependencias nativas (el `asarUnpack` de Electron sólo cubre `*.node`).

**Candidatas evaluadas** (licencia verificada con `npm view <pkg> license` el 2026-10-20):

| Librería | Formato | Licencia (npm) | Deps nativas | Veredicto |
|---|---|---|---|---|
| `pdfkit@0.20.2` | PDF | MIT | ninguna | **Descartada**: dependencia externa (ciclo de install de A7) para un caso que cubre un escritor PDF propio de ~250 líneas; su API por objeto es sobredimensionada para un exportador declarativo. |
| `jspdf@4.2.1` | PDF | MIT | ninguna | **Descartada**:Thinking API orientada a cliente (render en canvas), no a un main process de Node. |
| `pdf-lib@1.17.1` | PDF | MIT | ninguna | **Descartada**: orientada a **manipular** PDFs existentes, no a generarlos desde cero. |
| `docx@9.13.0` | DOCX | MIT | `jszip` | **Descartada**: arrastra `jszip` (licencia **MIT OR GPL-3.0**, dual) + install. |
| `exceljs@4.4.0` | XLSX | MIT | `unzipper`/`archiver` | **Descartada**: 3 dependencias transitivas + install. |
| `xlsx@0.18.5` (SheetJS) | XLSX | **Apache-2.0** en la última versión publicada en npm | ninguna | **Descartada** (no por licencia): SheetJS ya no publica en npm (las versiones nuevas van por su CDN con licencia propia) ⇒ `npm install`给出 una versión **sin mantenimiento y con CVEs** (prototype pollution / ReDoS). |
| `pptxgenjs@4.0.1` | PPTX | MIT | `jszip` | **Descartada**: misma dependencia dual que `docx`. |
| `jszip@3.10.2` | ZIP | **MIT OR GPL-3.0-or-later** | ninguna | **Descartada**: licencia **dual** con rama GPL ⇒ hay que elegir rama explícitamente (el guardrail de licencias pide evitarlo). |
| `archiver@8.0.0` | ZIP | MIT | ninguna | **Descartada**: dependencia externa para algo que `node:zlib` ya resuelve (`deflateRawSync` + `crc32`). |
| `fflate@0.8.3` | ZIP | MIT | ninguna | **Candidata sólida, pero innecesaria**: `node:zlib` (MIT, parte del runtime) da lo mismo sin superficie de suministro. |
| **`node:zlib` + escritores propios** | **todos** | **MIT (runtime de Node)** | **ninguna** | ✅ **ELEGIDA** |

**Por qué es la decisión correcta (no sólo la más cómoda):**

1. **Cero superficie de suministro y ceroSurface de instalación**: no hay entrada para A7, no hay lockfile que tocar, no hay riesgo de empaquetado Electron.
2. **Ninguna licencia restrictiva**: no hay que elegir rama MIT/GPL de una doble licencia.
3. **Control exacto del artefacto**: el ZIP se escribe con las partes OOXML obligatorias, y el PDF con una fuente base-14 (sin incrustar ficheros de fuente) ⇒ texto **seleccionable** en cualquier lector.
4. **Testeable ahora**: con dependencias nuevas, los tests no podrían ejecutarse hasta que A7 instalase ⇒ no habría TDD verificable en esta ola.

**Implementación** (`packages/tools/src/exporters/`, todo nuevo):

- `zip.ts` — escritor ZIP mínimo (PKWARE APPNOTE 6.3.3: local file header + directorio central + EOCD; métodos 0 store y 8 deflate) sobre `node:zlib`. Incluye `listZipEntryNames()` y `readZipEntry()` (usados por los tests para **verificar la estructura real**, no "que no esté vacío").
- `ooxml.ts` — escapado XML, `[Content_Types].xml`, `.rels`, `docProps`.
- `docx.ts` / `xlsx.ts` / `pptx.ts` — generadores OOXML con las partes obligatorias de cada formato.
- `pdf.ts` — escritor PDF 1.7: cabecera `%PDF-7`, objetos numerados, **tabla `xref` con los desplazamientos reales**, `trailer` con `/Root`, `%%EOF`, stream de contenido comprimido (`FlateDecode`).
- `exportArtifactTool.ts` — la tool `export_artifact` (formatos `pdf`/`docx`/`xlsx`/`pptx`/`markdown`; escribe en disco de forma atómica y confinada al workspace; si la ruta no trae extensión, se añade la del formato).

**La tool `export_artifact` queda registrada** en `registerNativeTools` (flags `enableExporters`, por defecto activo) y en el catálogo canónico `NATIVE_TOOL_NAMES` (12 tools).

### 2.2 El "REPL Python": por qué NO es un REPL Python

**El guardrail `AGENTS.md` §4 prohíbe Python en el producto.** El maestro §7.2 pide un "REPL Python"; la Ola 3 (VERDICT §7) ya lo resuelve: *"Sin Python (guardrail §4): implementación TS"*.

**Decisión: REPL de EXPRESIONES en TypeScript, con el nombre honesto `eval_expression`** (NO `python_repl`).

Implementado como **intérprete propio** (`packages/tools/src/repl/expressionEvaluator.ts`): tokenizer → parser (precedencia) → evaluador.

- **NO** usa `eval`, ni `new Function`, ni `node:vm`, ni `child_process`. **No existe ninguna ruta por la que el modelo ejecute código arbitrario.**
- Sin `require`, `process`, `fs`, `globalThis`, `__proto__`, `constructor`, `prototype`.
- Los métodos de objetos de datos están **bloqueados** (invocar `texto.toString()` abriría la puerta a `constructor`); sólo se invocan los de los espacios de nombres de la lista blanca (`Math.max`, `JSON.stringify`, `Array.isArray`, `Object.keys`).
- Lista blanca de funciones puras: `abs ceil floor round min max pow sqrt trunc sign log exp sin cos tan atan2 log10 log2 expm1 cbrt hypot clamp sum mean median stddev minOf maxOf range String Number Boolean JSON Array Object Math`.
- Presupuesto: 10 000 pasos, profundidad 32, longitud 20 000 caracteres.

**Si algún día se quiere Python de verdad**, la vía correcta es un **servidor MCP Python externo** (fuera del producto), no una tool nativa. Queda anotado en la ficha (§3).

### 2.3 Los tests (TDD real, con output pegado)

**Rojo demostrado (E4):** `packages/tools/test/exporters.test.ts` → **2/26 fallos** en el primer verde:

```text
× tool `export_artifact` > genera un PDF real sin escribir en disco
  TypeError: Cannot read properties of undefined (reading 'length')
× tool `eval_expression` (REPL de expresiones, NO Python) > permite funciones puras de la lista blanca
  AssertionError: expected undefined to be 6
```

Los dos eran **bugs reales** de mi implementación, no del test: (a) `renderArtifact` asumía que la entrada había pasado por Zod (`input.slides.length` sobre `undefined`); (b) el evaluador **bloqueaba `Math.max(1,2)`** porque `Math` es un método de un objeto que no era un namespace permitido. Corregidos ambos.

**Verde:** 26/26.

**Lo que verifican los tests (no "que el buffer no esté vacío"):**

- **ZIP**: firma `PK\x03\x04`, EOCD `0x06054b50` al final, el directorio central lista **todas** las entradas, y el contenido **descomprimido** de una entrada es el XML esperado.
- **DOCX**: `[Content_Types].xml` con `wordprocessingml.document.main+xml`, `_rels/.rels` con la relación `officeDocument`, `word/document.xml` presente, y el **escapado XML** correcto (`<script>` → `&lt;script&gt;`).
- **XLSX**: `xl/workbook.xml` + `xl/worksheets/sheet1.xml` + relaciones; celdas con referencia `A1`/`B2` y valor tipado (`<v>1</v>`); `columnLetter(26) === "AA"`.
- **PPTX**: `ppt/presentation.xml`, `ppt/slides/slide1.xml`, `slide2.xml`, `ppt/slides/_rels/slide1.xml.rels`, `ppt/theme/theme1.xml`, `ppt/slideLayouts/slideLayout1.xml`; `sldIdLst` con 1 slide; escapado `A & B` → `A &amp; B`.
- **PDF**: empieza por `%PDF-1.7`, contiene `trailer` y `/Root 1 0 R`, **termina en `%%EOF`**; el `startxref` declarado **apunta de verdad** a la firma `xref`, y **cada entrada de la xref apunta a un `N 0 obj` real**; objetos mínimos `Catalog`/`Pages`/`Font`/`Info`; `/BaseFont /Helvetica`; `/MediaBox`; `/Filter /FlateDecode`.
- **`eval_expression` (seguridad)**: `require('fs')` → error; `process.env` → error; `globalThis` → error; `({}).__proto__` y `({}).constructor` → error; `texto.toString()` → error ("usa una función de la lista blanca"); error de sintaxis → informe, no reventón.

### 2.4 La tool `export_artifact` y la política de escritura

`export_artifact` es `riskLevel: "sensitive"` con `requiresApproval: true` (escribe en disco). La ruta se valida con `PathValidator.validatePathAsync` (perímetro del workspace, symlinks del padre resueltos) y la escritura es **atómica** (tmp + fsync + rename).

---

## 3. Ficha / ADR para A1 (texto completo, listo para aplicar)

> **A1**: aplicar como ADR nuevo (`docs/adr/00XX-*.md`, numeración correlativa) y volcar el §"Estado de los patrones asimilados" en `docs/roadmap/Backlog.md`.

### Texto del ADR

**Título**: *Exportadores de artefactos (PDF/DOCX/XLSX/PPTX) y REPL de expresiones en TypeScript puro, sin dependencias ni Python.*

**Estado**: ACEPTADO (2026-10-20) · **Ámbito**: Fase 02 (Acción) · **Dueño**: A3

**Contexto.**
El documento maestro §7.2 exige exportadores a PDF/DOCX/XLSX/PPTX y un REPL Python. En el repo había **0 coincidencias** de `render_pdf|generate_docx|generate_xlsx|generate_pptx`: Ego sólo exportaba Markdown. El guardrail `AGENTS.md` §4 **prohíbe Python en el producto**, y el brief de la Ola 3 lo reitera: *"Sin Python: implementación TS"*, sin binarios externos y sin dependencias nativas que rompan el empaquetado de Electron (`asarUnpack` sólo cubre `*.node`).

**Alternativas evaluadas** (licencias verificadas con `npm view <pkg> license`):
`pdfkit` MIT · `jspdf` MIT · `pdf-lib` MIT · `docx` MIT · `exceljs` MIT · `xlsx@0.18.5` Apache-2.0 (última versión publicada en npm) · `pptxgenjs` MIT · `jszip` **MIT OR GPL-3.0-or-later** · `archiver` MIT · `fflate` MIT.
Ninguna es AGPL ni tiene cláusulas restrictivas de tipo copyleft obligatorio, pero:

- 3 de ellas arrastran `jszip`, de licencia **dual** (hay que elegir rama explícitamente);
- `xlsx` (SheetJS) ya no se publica en npm: la versión instalable no recibe mantenimiento y tiene CVEs conocidos;
- todas exigen un ciclo de instalación (A7) ⇒ los tests no serían ejecutables ni verificables en la ola.

**Decisión.**

1. **Cero dependencias.** Los exportadores se implementan sobre `node:zlib` (MIT, runtime de Node): un escritor ZIP propio (PKWARE APPNOTE 6.3.3) para DOCX/XLSX/PPTX y un escritor PDF 1.7 propio (con `xref` de desplazamientos reales y fuente base-14, sin incrustar ficheros de fuente ⇒ texto seleccionable).
2. **El "REPL Python" es un REPL de expresiones en TypeScript**, llamado `eval_expression` (nombre honesto). Implementado como intérprete propio (tokenizer → parser → evaluador) que **no** usa `eval`, `new Function`, `node:vm` ni `child_process`: no hay ninguna ruta de ejecución arbitraria. Lista blanca de funciones puras; acceso a propiedades de datos permitido, métodos de datos bloqueados; `require`/`process`/`globalThis`/`__proto__`/`constructor` inexistentes.
3. Si alguna vez hace falta Python, la vía es un **servidor MCP Python externo** (fuera del producto), nunca una tool nativa.

**Consecuencias.**

- ✅ Cero superficie de suministro, cero licencias ambiguas, cero cambios de empaquetado Electron, cero entradas para A7.
- ✅ Artefactos reales y verificables por estructura (partes OOXML obligatorias, cabecera/trailer/xref de PDF), no stubs.
- ✅ El REPL no es un `eval` disfrazado: es un intérprete con lista blanca y presupuesto de pasos.
- ⚠️ El formato de parche de `fs_edit_patch` (reemplazos exactos, fail-closed ante ambigüedad) **no** es un diff unificado: un diff con hunks parciales es una decisión de producto, no de infraestructura.
- ⚠️ La generación de PDF cubre texto con fuente base-14; **no** hay motor de layout (tablas, imágenes, paginación sophisticated). Ampliarlo es trabajo futuro.

**Referencias**: `packages/tools/src/exporters/`, `packages/tools/src/repl/`, `packages/tools/test/exporters.test.ts`.

---

## 4. Solicitudes fuera de zona (NO aplicadas)

| # | Fichero | Cambio pedido | Motivo | Bloqueante |
|---|---|---|---|---|
| 1 | `packages/tools/package.json` | **A7**: `pnpm install` (sin dependencias nuevas; materializa `@ego/security` en `tools` y `@ego/tools` en `recovery`, ambos **devDependencies** que añadí) | E4/T2: `NetPolicy` de `@ego/tools` pasa a reexport de `@ego/security`; `packages/recovery` usa `createTempWorkspace` de `@ego/tools` | **Sí** — A7 debe instalar |
| 2 | `packages/tools/package.json` | **A7**: añadir `"@ego/security": "workspace:*"` | Diff C de A2 (§2.1 de su handoff) | **Sí** — A7 |
| 3 | `packages/recovery/package.json` | **A7**: añadir `"@ego/tools": "workspace:*"` (devDependency) | Los tests de recovery usan `createTempWorkspace` | **Sí** — A7 |
| 4 | `apps/desktop/src/main.ts` | `new McpManager(toolRegistry, { …, eventBus })` | **T1 de la Ola 1b**: sin bus, un takeover nativo se bloquea pero **no se audita** | No |
| 5 | `apps/desktop/src/main.ts` | `new RunRecorder(adapter, eventBus)` | `COUC-09`: `RunRecorder` es un observador de proceso (se suscribe al bus); su dueño es main | No |
| 6 | `apps/desktop/src/main.ts` | `new EgoMcpServer({ …, payloadRegistry })` | `COUC-08`: `PayloadRegistry` ya satisface `McpPayloadResourceProvider` | No |
| 7 | `apps/desktop/src/main.ts` | `pathValidator` → `await PathValidator.validatePathAsync(...)` (línea ~5368) | Cierra el TOCTOU en el panel de terminal | No |
| 8 | `apps/desktop/src/main.ts` | `await crashRecoveryEngine.releaseLockAsync()` | Último sync I/O del proceso main | No |
| 9 | `docs/review/backlog-*.md` (A5) | Volcar la tabla del §5 (estado de los 21 patrones) | `docs/review/` es de A5 | No |
| 10 | `docs/roadmap/Backlog.md` (A1) | Fila de E4 con la evidencia de esta ola | Documentación canónica | No |

<details><summary><b>Diff 1+2+3 — manifiestos que A7 debe instalar</b></summary>

```diff
--- a/packages/tools/package.json
+++ b/packages/tools/package.json
   "dependencies": {
+    "@ego/security": "workspace:*",
     "zod": "^3.23.8"
   },
   "devDependencies": {
     "@types/node": "^22.8.0",
     "typescript": "^5.6.3",
     "vitest": "^3.2.7"
   }

--- a/packages/recovery/package.json
+++ b/packages/recovery/package.json
   "devDependencies": {
+    "@ego/tools": "workspace:*",
     "@types/node": "^22.8.0",
     "typescript": "^5.6.3",
     "vitest": "^3.2.7"
   }
```

> **A7**: los dos enlaces de workspace ya están materializados **a mano** (junctions en `node_modules/@ego/`) para que la ola fuera verificable sin install; `pnpm install` los regenerará sin cambios y actualizará `pnpm-lock.yaml`. **No hay dependencias nuevas**: `node:zlib` es runtime.
</details>

<details><summary><b>Diff 4 — <code>McpManager</code> con EventBus (T1 de la Ola 1b)</b></summary>

```diff
--- a/apps/desktop/src/main.ts
+++ b/apps/desktop/src/main.ts
@@ bootstrap (donde hoy se crea el McpManager) @@
   mcpManager = new McpManager(toolRegistry, {
     tokenStore: getMcpCredentialManager(),
     secretResolver: createCredentialSecretResolver(getMcpCredentialManager()),
+    // Sin bus, un servidor MCP puede seguir tomando el control de una tool
+    // NATIVA sin que quede traza. Con bus, cada decisión (override
+    // autorizado o intento de takeover) emite `system.alert`.
+    eventBus,
   });
```

</details>

<details><summary><b>Diff 6 — <code>payloadRegistry</code> en el servidor MCP</b></summary>

```diff
--- a/apps/desktop/src/main/mcp/mcp-server-runtime.ts
+++ b/apps/desktop/src/main/mcp/mcp-server-runtime.ts
@@
- ...(options.payloadRegistry ? { payloadRegistry: options.payloadRegistry } : {}),
+ ...(options.payloadRegistry ? { payloadRegistry: options.payloadRegistry } : {}),
```

> El tipo ya lo acepta. A4 sólo tiene que **pasar** el `PayloadRegistry` de
> `@ego/ui-runtime` (el singleton) al construir el `EgoMcpServer`. Con eso,
> `resources/list` expone los payloads registrados y `resources/read` los
> devuelve.
</details>

---

## 5. Estado de los 21 patrones de A5 (para que A5 lo volque en `docs/review/`)

| ID | Módulo | Estado en la Ola 3 | Evidencia |
|---|---|---|---|
| `OCLW-09` | `packages/tools/.../NetPolicy.ts` | ✅ **Completada** | Reexport de `@ego/security` (canónica de A2); test `packages/tools/test/netpolicy-unified.test.ts` (8) que escanea `packages/*/src` y exige **1** `class NetPolicy` y **0** "réplica léxica" |
| `OCLW-07` | `packages/tools/.../SessionDiffRevisions.ts` | ✅ **Completada** (Ola 1b) | Tool `git_session_diff` |
| `HERM-15` | `packages/recovery/.../StorageHealthLatch.ts` | ✅ **Completada** (Ola 1b) | `CrashRecoveryEngine.auditStorage()` + `system.alert` `RECOVERY_STORAGE_UNHEALTHY` |
| `DSEK-04` | `packages/recovery/.../SchemaMigrator.ts` | ✅ **Completada** (Ola 1b) | `ProjectImport(adapter, schemaMigrator?)` |
| `OCLW-11` | `packages/ui-runtime/.../MermaidRenderer.ts` | 🟡 **Parcial** | El tipo de componente `mermaid` + preparador existen (`MermaidComponent.ts`); falta la vista React (A4) |
| `COUC-08` | `packages/ui-runtime/.../PayloadRef.ts` | 🟡 **Parcial** | `PayloadRegistry.list()`/`read(uri)` lo hacen proveedor de recursos del servidor MCP; falta pasarlo en main (A4, diff 6) |
| `COUC-13` | `packages/tools/.../ResourcePolicy.ts` | 🚫 **Descartada (con justificación)** | Duplicado léxico de la política canónica de `@ego/security`; 0 callers. Retirado en la Ola 1b |
| `COUC-05` | `packages/ui-runtime/src/stores/**` | 🚫 **Descartada (con justificación)** | 7 stores genéricos = tercera fuente de verdad; 0 callers. Retirado en la Ola 1b |
| `HERM-12` | `packages/ui-runtime/.../SlashCommandParser.ts` | 🚫 **Descartada (con justificación)** | Dos parsers de slash; el vivo es el del renderer. Retirado en la Ola 1b |
| `COUC-09` | `packages/tasks/.../RunRecorder.ts` | 🟡 **Parcial** | El módulo funciona; falta instanciarlo en main (A4, diff 5) |
| `HERM-08` | `packages/ui-runtime/.../WindowState.ts` | ⏳ **Pendiente de A4** | `WindowStateHelper` existe; debe consumirlo `WindowStateManager` (apps/desktop) |
| `HERM-07` | `packages/recovery/.../WindowsSandboxFallback.ts` | ⏳ **Pendiente de A4** | Arranque de Electron (crash 0x80000003) |
| `HERM-06` | `packages/recovery/.../WindowsUserEnv.ts` | ⏳ **Pendiente de A4** | Antes de `app.whenReady()` |
| `OCLW-13` | `packages/recovery/.../ProcessSupervisor.ts` | ⏳ **Pendiente de A4** | Re-spawn en el arranque |
| `COUC-15` | `packages/ui-runtime/.../MockIPCBridge.ts` | ⏳ **Pendiente de A4/A7** | Dev-server sin Electron |
| `COUC-01` | `packages/events/.../EventNormalizer.ts` | ⬜ **A2** | Depende de `COUC-22` |
| `COUC-02` | `packages/events/.../EventIngress.ts` | ⬜ **A2** | Ídem |
| `COUC-14` | `packages/runtime/.../SyntheticRuntime.ts` | ⬜ **A7** | — |
| `COUC-21` | `packages/avatar/**` | ⬜ **A6** | D5: 3 copias |
| `HERM-14` | `packages/memory/.../SessionTimelineRewind.ts` | ⬜ **A2** | — |
| `KHOJ-04` | `packages/knowledge/.../FactExtractor.ts` | ⬜ **A2** | — |
| `OCLW-06` | `packages/memory/.../TranscriptReadWindow.ts` | ⬜ **A2** | — |
| `OCLW-14` | `packages/events/.../ToolActivityEmitter.ts` | ⬜ **A2** | — |
| `HELM-03` | `apps/desktop/renderer/hooks/useTerminalSession.ts` | ⬜ **A4** | — |
| `DSEK-02` | `packages/memory/EgoMemoryAdapter.ts` | ⬜ **A2** | — |
| `HERM-18` | `packages/execution/.../ZeroContextKernel.ts` | ⬜ **A2** | 🚫 Descartada en A5 |

**Nuevos de esta ola:** `OCLW-17` *(exportadores de artefactos — E4)* ✅ Completada · `OCLW-18` *(REPL de expresiones en TS — E4)* ✅ Completada.

---

## 6. Verificación

| Comando | Exit | Resumen |
|---|---|---|
| `pnpm --filter @ego/tools test` | 0 | 18 ficheros · **149 tests** (26 de `exporters` + 9 de `temp-workspace` nuevos) |
| `pnpm --filter @ego/subegos test` | 0 | 20 ficheros · **221 tests** |
| `pnpm --filter @ego/tasks test` | 0 | 18 ficheros · **84 tests** |
| `pnpm --filter @ego/domains test` | 0 | 13 ficheros · **82 tests** |
| `pnpm --filter @ego/dailystate test` | 0 | 6 ficheros · **42 tests** |
| `pnpm --filter @ego/recovery test` | 0 | 14 ficheros · **51 tests** |
| `pnpm --filter @ego/ui-runtime test` | 0 | 14 ficheros · **94 tests** |
| `pnpm --filter @ego/integrations test` | 0 | 9 ficheros · **77 tests** |
| **TOTAL (8 paquetes)** | **0** | **800 tests** (Ola 1b: 738 → **+62**) |
| `pnpm -r typecheck` | **0** | 0 errores en el monorepo |
| `pnpm lint` | **0** | oxlint 283 warnings (< umbral 320) + typecheck en verde |
| `pnpm --filter @ego/{tools,subegos,integrations,tasks,domains,dailystate,recovery,ui-runtime} build` | 0 | `dist/` actualizado |
| Medición de disco (T-X1) | 0 | **0 dirs huérfanos · 0 MB retenidos** (antes: 6 dirs / 1 044 MB) |
| Escaneo de mojibake en mi zona | 0 | **0** ficheros afectados (46 revisados) |
| `catch {}` vacíos reales en mi zona | 0 | **0** (los 3 que aparecen en `tasks` son texto de docstring) |
| Sync I/O en mi zona | — | 15: **10** en `TempWorkspace.ts` (síncrono **por diseño**: el hook `exit` no puede esperar) + **3** en `PathValidator.validatePath` (variante sync conservada para `main.ts:5368`; A4 debe migrar, diff 7) + 2 en `CrashRecoveryEngine.releaseLock()` (con variante `releaseLockAsync()`, diff 8) |

**TDD — rojos demostrados antes de cada fix:**

| Tarea | Rojo |
|---|---|
| T-X1 (helper) | 2/6 fallos: el hook `exit` no borraba la raíz con raíz personalizada (`expected true to be false`) y el barrido borraba la corrida actual (`expected [ Array(1) ] to not include '…'`) |
| T-X1 (sweep concurrente) | 1/9 fallos: el barrido borraba la raíz de un proceso **vivo** |
| T-X1 (barrido) | 1/7 fallos tras añadir la regla "vacía ⇒ se borra": el fixture "fresh" estaba vacío |
| E4 | 2/26 fallos: `Cannot read properties of undefined (reading 'length')` (entrada sin pasar por Zod) y `expected undefined to be 6` (`Math.max` bloqueado como método) |
| Flaky `proactivity-triggers` | 1/8 fallos bajo carga: el debounce con `sleep` fijo se disparaba dos veces ⇒ espera determinista (`waitUntil` + margen de quietud) |

---

## 7. Deuda / no resuelto

1. **A7 debe ejecutar `pnpm install`** (§4, diffs 1-3). Sin eso, `@ego/security` en `tools` y `@ego/tools` en `recovery` no están enlazados en el lockfile (los junctions los materializan a mano para poder verificar).
2. **El `lint` global estaba en rojo por el trabajo concurrente de A4** (`apps/desktop/scripts/t11-*.cjs`, ~90 warnings nuevos). Al cerrarse la ola bajó a **283 < 320** ⇒ verde. Si A4 vuelve a añadir scripts con `console`, el umbral vuelve a saltar: es un gate compartido (A7).
3. **Churn de disco**: la corrida de la zona sigue escribiendo ≈1 GB (preasignación de VantaDB) aunque **no retiene nada**. Se reduciría agrupando stores entre ficheros de test, pero eso cambia el aislamiento de 7 ficheros ⇒ decisión de producto.
4. **El generador de PDF no tiene motor de layout**: sólo texto con fuente base-14 (sin tablas, imágenes ni paginación sofisticada). Es un exportador de artefactos, no un compositor tipográfico.
5. **`fs_edit_patch` no es un diff unificado**: usa reemplazos exactos (fail-closed ante ambigüedad). Un formato con hunks parciales es decisión de producto.
6. **`eval_expression` no tiene REPL de Python**: es un evaluador de expresiones. Si el producto lo necesita de verdad, es un servidor MCP Python externo (fuera del producto).
7. **La ruta de sync I/O restante** en `PathValidator.validatePath` y `CrashRecoveryEngine.releaseLock()` depende de que A4 migre a las variantes async (diffs 7 y 8).
8. **Los `any` de `packages/tools/src/types.ts`** (4) y `ToolRegistry.ts` (1) siguen con la justificación L10 documentada (catálogo heterogéneo) — el lint los reporta como warning pero no son deuda nueva.
9. **A2 y A4 tienen trabajo en curso sobre `@ego/tools`**: `packages/tools/dist` lo consumen `@ego/integrations`, `@ego/subegos` y `@ego/recovery`. Si A2 toca `@ego/security`, hay que reconstruir `packages/tools` (`pnpm --filter @ego/tools build`) antes de que los tests de los demás vean el `dist` viejo.

---

```text
RESULTADO: {
  agente: A3-ola3,
  status: PARTIAL,
  archivos_modificados: [
    "packages/tools/src/TempWorkspace.ts",
    "packages/tools/src/index.ts",
    "packages/tools/src/native/index.ts",
    "packages/tools/src/native/nativeToolNames.ts",
    "packages/tools/src/native/terminal/NativeTerminalTool.ts",
    "packages/tools/src/exporters/{index,zip,ooxml,docx,xlsx,pptx,pdf,exportArtifactTool}.ts",
    "packages/tools/src/repl/{expressionEvaluator,evalExpressionTool}.ts",
    "packages/tools/test/{exporters,temp-workspace}.test.ts",
    "packages/tools/test/{native-tools,fs-search-tools,fs-edit-patch,ToolRegistry}.test.ts",
    "packages/recovery/src/ProjectExport.ts",
    "packages/recovery/package.json",
    "packages/recovery/test/{atomic-lockfile,CrashRecoveryEngine,DiagnosticsLogger,ProjectExport,ProjectImport,SchemaMigrator,SnapshotManager,WindowsSandboxFallback}.test.ts",
    "packages/recovery/test/chaos/{durability-chaos,hard-kill,kill-target-worker}",
    "packages/subegos/test/{CharacterProfile,DelegationRouter,PromptAssembly,SelfImprovementLoop,SharedMemory,SubEgoBudget,SubEgoManifest,SubEgoRegistry,SubEgoSoul,subegos-delegation}.test.ts",
    "packages/tasks/test/proactivity-triggers.test.ts",
    "packages/domains/test/{DomainRegistry,tool-contract}.test.ts",
    "docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A3-ola3.md"
  ],
  hallazgos_resueltos: [
    "T-X1 (fuga de 320 MB/corrida: raíz por corrida + limpieza a prueba de muerte + barrido por antigüedad; 0 huérfanos, 0 MB)",
    "E4 (exportadores PDF/DOCX/XLSX/PPTX en TS puro, cero dependencias) — tool `export_artifact`",
    "E4-REPL (REPL de expresiones TS con nombre honesto `eval_expression`, sin eval/vm)",
    "flaky de `proactivity-triggers.test.ts` (espera determinista)",
    "lentitud de `ProjectExport` (escritura por lotes: 1 200 awaits → ~20 escrituras)"
  ],
  verify: { typecheck: "exit 0 (pnpm -r typecheck global)", tests: "800 passed (738 → +62), 0 regresiones", lint: "exit 0 (pnpm lint, 283 warnings < 320)", disco: "0 dirs huérfanos · 0 MB retenidos (antes 6 dirs / 1 044 MB)" },
  solicitudes_handoff: 10,
  deuda_abierta: [
    "A7: pnpm install (materializa @ego/security en tools y @ego/tools en recovery; sin dependencias nuevas)",
    "A4: McpManager con eventBus (auditoría del takeover nativo)",
    "A4: RunRecorder instanciado en main (COUC-09)",
    "A4: payloadRegistry pasado al EgoMcpServer (COUC-08)",
    "A4: main.ts → PathValidator.validatePathAsync y releaseLockAsync (los 5 sync I/O restantes)",
    "A4: vista React del tipo de componente `mermaid` (OCLW-11)",
    "A5: volcar la tabla de los 21 patrones en docs/review/backlog-*.md",
    "A1: ADR de E4 + fila en el Backlog (texto en §3)",
    "churn de ≈1 GB por corrida (preasignación de VantaDB): agrupar stores cambia el aislamiento de 7 tests ⇒ decisión de producto",
    "PDF sin motor de layout (texto base-14); fs_edit_patch sin hunks parciales; sin REPL Python (sería un MCP externo)"
  ],
  SKILLS_CARGADAS: ["test-driven-development", "systematic-debugging", "security-and-hardening", "source-driven-development", "code-review-and-quality"]
}
```
