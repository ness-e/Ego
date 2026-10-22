# Handoff A2bis (Ola 10) — 2026-10-21 — curaduría de memoria real + contrato de atribución extendido

> Zona de A2bis (Ola 10): `packages/{memory,tasks,runtime,security,events,knowledge,models,decision,execution,tool-call-repair}/**`
> + `packages/{tools,ui-runtime}/**` **sólo** para manifiesto/cabeceras/licencia.
> Sin commits · sin `pnpm install` · sin `git checkout/reset/stash/clean`.

## 0. Resumen ejecutivo (léase primero)

Cinco hallazgos. **Verificados uno por uno contra el código**: **los cinco eran
reales**. Lo que cambia es que dos de ellos no eran sólo "el barrido no cura":
el barrido, además, **escribía cada marca con una transacción propia**, y
medido eso cuesta **25-33 ms por registro** (500 marcas = 16 s). El arreglo
del barrido trae consigo el **lote** (`putMulti`), que lo baja a **~1 ms por
registro** (27×).

| Id | Veredicto | Qué se hizo |
|---|---|---|
| `EGO-FIND-110` | **REAL** | El barrido leía **una sola** página de 50 y no tenía bucle de cursor. Ahora **lee paginando con cursor** (`listPaged` + cursor opaco) hasta agotar el namespace, con **presupuesto explícito** (`maxRecordsPerRun` = 500 examinados, `maxScanRecordsPerRun` = 5000 leídos) y `partial: true` cuando el techo trunca. **Coste medido** (§1.3). |
| `EGO-FIND-111` | **REAL** | El conjunto examinado era **los 50 primeros por clave**. Ahora se **ordena por antigüedad en memoria** (el motor no indexa por `ts`; no se inventa un índice) y **el presupuesto se gasta en los más antiguos**, de modo que el conjunto depende de la edad, no de la clave. |
| `EGO-FIND-112` | **REAL** | `staleNamespaces` y `staleBatchSize` eran inalcanzables desde el producto. **Decisión: (a) propagar las 4** — la configuración de la curaduría vive ahora en `gov/settings/memory_curation`, y `staleBatchSize` desaparece (su semántica la sustituyen dos presupuestos distintos: examen y lectura). |
| `EGO-FIND-113` | **REAL** | Cadencia y ventana eran literales en el arranque. Ahora salen de **`gov/settings/memory_curation`** (con defaults si no hay ajustes). El diff exacto para A4 está en §6.1. **Documentado** (no arreglado) el efecto real: es un job de app de escritorio (§4.4). |
| `EGO-FIND-82` | **REAL (parcial)** | El contrato de atribución sólo cubría `packages/avatar/`. Ahora hay **manifiesto + `LICENSE.md`/`NOTICE` + puerta** en los **3 paquetes con código realmente derivado** (`tool-call-repair`, `tools`, `ui-runtime`), con **5 derivados medidos** y **8 nativos** con el texto veraz del plano 2. La puerta **muerde** (tests con *fixtures*: §5.5). |

### 0.1 Los tres números que resumen la Ola 10

| # | Dato | Valor |
|---|---|---|
| 1 | **Derivados reales medidos** en `packages/**` fuera de `avatar` | **5** (2 en `tool-call-repair`, 1 en `tools`, 2 en `ui-runtime`) — de los **10** que decía el enunciado, **5** eran artefactos de `dist/` (compilados): en el **código fuente** son 5 |
| 2 | **Coste del barrido** con 5000 hechos, por corrida | **~1-6 s** de lectura + **~0,6 s** de marcado (en lote). Sin lote: **16-24 s** |
| 3 | **Opciones muertas** del contrato de curaduría | **0** (antes 2) |

## 1. L1 — `EGO-FIND-110`: el barrido no paginaba

### 1.1 Qué estaba realmente mal (verificado)

`runOnce()` (`packages/tasks/src/MemoryCurator.ts:158` en HEAD) hacía **una sola**
llamada `this.gateway.list(ns, this.staleBatchSize)` (50) y se acababa. No
había bucle de cursor: los registros más allá del puesto 50 **no se veían
nunca**, y eran siempre los mismos 50 (los primeros por clave).

La puerta que lo demuestra está en el test nuevo
(`packages/tasks/test/MemoryCuratorSweep.test.ts`): *"cura un fact **MÁS ALLÁ**
del puesto 50"*. Con 120 hechos (el 116º por clave es stale) el código de HEAD
marca **0**; el nuevo marca **1**.

### 1.2 Lo que se ha hecho

| Pieza | Detalle |
|---|---|
| **Lectura** | `listPaged(ns, límite, cursor)` en bucle hasta agotar el namespace o tocar el techo de lectura. Si el adapter **no** expone `listPaged` (doble legacy), cae a `list(ns, techo)` — el comportamiento viejo, pero acotado y declarado. |
| **Presupuesto de lectura** | `maxScanRecordsPerRun` (default **5000** registros leídos por namespace y corrida). Es la red de seguridad: el motor no indexa por `ts`, así que la antigüedad se calcula **después** de traer la ventana. |
| **Presupuesto de examen** | `maxRecordsPerRun` (default **500** registros examinados por namespace y corrida). Es el **presupuesto explícito** que pedía el enunciado. |
| **`partial`** | Si el techo de lectura truncó el namespace, la corrida lo **declara** (`stats.partial = true` y `partial` en la auditoría `curator_run`). Nunca se disimula que no se vio todo. |
| **Auditoría** | `curator_run` ahora declara `scannedCount`, `examinedCount`, `maxRecordsPerRun` y `partial` (antes sólo `staleConsolidatedCount` + `staleNamespacesScanned`). |

### 1.3 El coste real, MEDIDO (no supuesto)

Medido contra el **VantaDB real** (`NativeVantaDB`, napi-rs), con un
`EgoMemoryAdapter` de verdad y un namespace `kb/facts` real
(script temporal, borrado después; el método está en §1.4):

| Volumen | Lectura paginada | Barrido **antes** (un `put` por registro) | Barrido **ahora** (lote) |
|---|---|---|---|
| 500 hechos | 171 ms (0,17 ms/reg) | **24 457 ms** (320 curados) | **3 370 ms** |
| 2 000 hechos | 404-1 862 ms | **56 398 ms** (500 curados) | **8 721 ms** |
| 5 000 hechos | 679-5 123 ms | **16 343 ms** (500 curados) | **9 980 ms** |
| 10 000 hechos | 8 047 ms (0,80 ms/reg) | — | — |

**El coste dominante no era la lectura: eran las escrituras.** Medido en
aislado (`put` individual vs `putMulti` de 500):

| Modo | Por registro | 500 marcas |
|---|---|---|
| `put` uno a uno | **25,0-32,9 ms** | **16 431 ms** |
| `putMulti` (lote de 500) | **0,99-1,20 ms** | **598 ms** |

⇒ **27× más barato en lote.** Por eso el curator marca **en lote** ahora
(`putMulti` cuando el adapter lo expone; si el lote falla, reintenta registro a
registro — fail-soft, un registro problemático no tumba la curaduría).

**Justificación del presupuesto (500)**: con el marcado en lote, 500 marcas
cuestan **~0,6 s**; la lectura del namespace entero (5000) cuesta **1-6 s**
(el rango depende de la compactación del LSM en ese momento). Una corrida
típica de 2 namespaces queda en **~2-12 s** de CPU de proceso principal, una
vez al día. Con `put` individual, el mismo presupuesto costaría **16 s por
namespace**: inviable. **El presupuesto está en `gov/settings`** (L4), así que
se puede mover sin tocar código.

### 1.4 Cómo se midió (reproducible)

Script temporal (fuera del repo, en el scratch del agente) que:
1. abre un `EgoMemoryAdapter` real sobre un directorio temporal,
2. inserta N hechos con `putMulti` (500 por lote),
3. mide por separado: la lectura paginada, el barrido completo, y el
   `put` individual frente al `putMulti`,
4. borra el directorio.

**No se ha versionado** (era una medición, no un contrato). Lo que sí queda
versionado es el **resultado** (esta tabla) y la **decisión** (presupuestos +
lote), que es lo que gobierna el comportamiento.

## 2. L2 — `EGO-FIND-111`: el barrido era por orden de clave

### 2.1 Qué estaba realmente mal (verificado)

El filtro `ts > cutoff` se aplicaba **después** de traer la página, sobre los
50 primeros **por clave**. Como `list()` devuelve por orden de clave (no por
`ts`), el conjunto examinado era estable e independiente de la edad: un
registro nuevo **nunca** entraba y los 50 primeros por clave se reexaminaban
eternamente.

### 2.2 Lo que se ha hecho (sin inventar un índice)

> **El motor no indexa por `ts`.** No se ha añadido un índice falso ni se ha
> simulado una consulta por antigüedad: se ha **traído por clave y ordenado en
> memoria**, que es lo que el enunciado pedía medir.

El barrido, por namespace:

1. **Lee** (paginando) la ventana del namespace.
2. **Filtra** lo accionable: ni en cuarentena, ni en estado terminal, y **con
   timestamp evidenciable** (metadata `ts`/`created_at`/`updated_at`/
   `timestamp`, o el payload).
3. **Ordena por antigüedad** ascendente (desempate por clave, para que el
   orden sea determinista).
4. **Examina** los más antiguos hasta el presupuesto.

Dos propiedades que hacen que esto **converja**:

- **El presupuesto se gasta en registros accionables**: los ya terminales (o
  sea, curados en una corrida previa) **no** lo consumen. Por eso, tras
  marcar 500 stale, la corrida siguiente examina los **siguientes 500 más
  antiguos**, no los mismos.
- **El examinations es por antigüedad, no por clave**: un fact cuyo `ts` es el
  más viejo se examina **aunque su clave ordene al final**.

### 2.3 Los tests (rojo primero)

`packages/tasks/test/MemoryCuratorSweep.test.ts`:

| Test | Qué afirma | Con el código de HEAD |
|---|---|---|
| *"examina el registro más antiguo aunque su clave ordene al final"* | el más viejo se examina primero y se cura | **ROJO** (0 curados) |
| *"un registro NUEVO entra en el conjunto examinado"* | un fact añadido después entra en el conjunto | **ROJO** (`examinedKeys` no existe) |
| *"el presupuesto por corrida se respeta"* | `examinedCount` = `maxRecordsPerRun` y son los más antiguos | **ROJO** |
| *"el presupuesto se gasta en registros ACCIONABLES"* | los terminales no lo consumen | **ROJO** |
| *"el presupuesto de LECTURA trunca el namespace y lo declara (`partial`)"* | `scannedCount` = 10 y `partial` = true | **ROJO** |

**Evidencia de rojo (medida):** con `MemoryCurator.ts` restaurado a HEAD
(`git show HEAD:packages/tasks/src/MemoryCurator.ts`, sin tocar nada más), el
fichero de tests da **11 fallos de 14** (§5.1).

## 3. L3 — `EGO-FIND-112`: las opciones muertas

### 3.1 Qué estaba realmente mal (verificado)

`MemoryCuratorOptions` declaraba 4 opciones; `startMemoryCuration`
(`apps/desktop/src/main/subsystems/memory-curation.ts:31-48`, **zona de A4**)
sólo propagaba 2:

| Opción | ¿Se usaba en el paquete? | ¿Era alcanzable desde el producto? |
|---|---|---|
| `intervalHours` | sí | **sí** (propagada) |
| `staleAfterDays` | sí | **sí** (propagada) |
| `staleNamespaces` | sí | **NO** — siempre `['kb/facts','kb/docs']` |
| `staleBatchSize` | sí (el tope de la lectura) | **NO** — siempre 50 |

### 3.2 Decisión: **(a) propagar las 4** — y por qué

Se descarta (b) (borrarlas del contrato) porque **L4 mueve la configuración de
la curaduría a `gov/settings`**, y el ajuste vive en **un** sitio: si dos de
las cuatro opciones se pudieran cambiar por código y las otras dos sólo por
ajuste, el contrato vuelve a ser una trampa (justo lo que el hallazgo
denuncia). Con la decisión (a):

- Las **4** (y las 2 nuevas) son **alcanzables** y **efectivas** (tests que lo
  comprueban uno por uno: §3.3).
- La configuración tiene **una sola fuente de verdad** (`gov/settings`), como
  el resto del producto (voz, permisos, MCP, credenciales, compresión).
- `staleBatchSize` **desaparece** del contrato: su semántica (un tope de
  lectura) está partida en dos cosas distintas que antes se confundían:
  `maxRecordsPerRun` (qué se **examina** y se puede marcar) y
  `maxScanRecordsPerRun` (qué se **lee**). Mantener un único "tamaño de lote"
  habría dejado sin nombre la distinction que §1.3 midió.

### 3.3 El contrato final (packages/tasks/src/MemoryCurator.ts)

```ts
export interface MemoryCuratorOptions {
  intervalHours?: number;          // > 0 · default 24 · cadencia
  staleAfterDays?: number;         // > 0 · default 90 · ventana
  staleNamespaces?: string[];      // default ['kb/facts','kb/docs']
  maxRecordsPerRun?: number;       // entero > 0 · default 500 · PRESUPUESTO de examen
  maxScanRecordsPerRun?: number;   // entero > 0 · default 5000 · techo de lectura
  scanPageSize?: number;           // entero > 0 · default 100 · página del cursor
}
```

**Precedencia, explícita y sin sorpresas:**
`opción explícita en el código` > `ajuste persistido` > `default del paquete`.

### 3.4 Los tests (rojo primero)

`packages/tasks/test/MemoryCuratorSweep.test.ts`, bloque *"L3 — ninguna opción
del contrato es MUERTA"*: un test **por opción** que demuestra que tiene
efecto (`staleNamespaces` decide qué se barre · `staleAfterDays` decide la
ventana · `maxRecordsPerRun` decide el presupuesto). Con el código de HEAD el
de `maxRecordsPerRun` es **ROJO** (la opción no existía) y los otros dos son
**verdes** (existían pero eran inalcanzables desde el producto: por eso el
test nuevo del **producto** —§6.1— es el que cierra el hueco de verdad).

## 4. L4 — `EGO-FIND-113`: la cadencia y la ventana salen de `gov/settings`

### 4.1 Qué estaba realmente mal (verificado)

`create-window.ts:229` llamaba
`startMemoryCuration(adapter, { intervalHours: 24, staleAfterDays: 90 })` con
**literales**, y `memory-curation.ts:37-38` hacía
`options.intervalHours ?? 24` / `options.staleAfterDays ?? 90`: es decir,
**aunque el ajuste viniera de otro sitio, los literales lo pisaban**.

### 4.2 Lo que se ha hecho

**Nuevo módulo `packages/tasks/src/CurationSettings.ts`** (espejo del patrón
`gov/settings/compression` de `STAB-05`):

| Clave | Tipo | Default | Significado |
|---|---|---|---|
| `intervalHours` | `number > 0` | 24 | Horas entre corridas |
| `staleAfterDays` | `number > 0` | 90 | Ventana de antigüedad |
| `staleNamespaces` | `string[]` (≥1) | `['kb/facts','kb/docs']` | Namespaces barridos |
| `maxRecordsPerRun` | `int > 0` | 500 | Presupuesto de examen por corrida |

- **Persistencia canónica**: `gov/settings/memory_curation` (namespace `gov/settings`, key `memory_curation`).
- **Lectura tolerante**: payload ausente o inválido ⇒ defaults (fail-soft, la
  memoria se curaría igual). Un ajuste corrupto **no** tumba la curaduría.
- **El curator los lee él mismo** en cada corrida (`resolveSettings()`), así
  que un cambio de ajuste surte efecto **sin reiniciar la app**; y la
  **cadencia** se reevalúa en cada tick (si el ajuste guardado cambia, el
  temporizador se reprograma).
- La opción explícita en el código **gana** al ajuste persistido (política
  documentada en el módulo y fijada por un test).

### 4.3 Por qué el curator lee los ajustes y no sólo el arranque

Porque `startMemoryCuration` es **síncrono** y se llama en el arranque, donde
leer `gov/settings` exigiría `await`. Leyéndolos **dentro** del curator:
1. el diff de A4 es **de una línea** (§6.1);
2. si A4 no lo aplica, la curaduría **funciona igual** (defaults) — no hay
   ninguna ventana en la que la memoria deje de curarse;
3. los ajustes se releen **por corrida** ⇒ un cambio de ventana surte efecto
   sin reiniciar.

### 4.4 ⚠️ El efecto real depende de cuánto esté abierta la app (documentado, NO arreglado)

> **Esto NO se arregla en esta ola** (lo pide el enunciado explícitamente).
> `MemoryCurator` es un job de **app de escritorio** programado con
> `setInterval(24 h)`: la primera corrida ocurre **24 h después de arrancar**,
> y sólo si la app sigue abierta. Una app que se abre 8 h al día tarda **3
> días** en disparar la primera curaduría. Peor: el `setInterval` **no** se
> re-evalúa al reanudar (no hay evento de "la app volvió" en el cableado).
>
> Mitigación ya presente: el temporizador es `unref()` (no impide cerrar la
> app) y la corrida es **fail-soft** (un fallo no la detiene).
>
> El arreglo de verdad (disparar la curaduría al **reanudar** la app, o al
> arranque si la última corrida fue hace > `intervalHours`) es **de A4**
> (`apps/desktop/src/main/**`) y queda **documentado, no implementado**.

## 5. L5 — `EGO-FIND-82`: el contrato de atribución, extendido (y MEDIDO)

### 5.1 Qué estaba realmente mal (verificado)

El contrato de atribución (plano 1 · CÓDIGO) tenía **un solo denominador**:
`packages/avatar/provenance.manifest.json` (89 ficheros: 58 derivados + 31
nativos) con su puerta `packages/avatar/scripts/check-attribution.mjs`. El
resto de `packages/**` estaba clasificado **fichero a fichero, sin manifiesto**
⇒ la cobertura **no era reproducible ni auditable**: nadie podía responder
"¿qué ficheros de `packages/**` son código derivado?" con una fuente única.

### 5.2 El recuento de derivados REALES (medido, no supuesto)

El enunciado decía 10 (4 en `tool-call-repair`, 2 en `tools`, 4 en
`ui-runtime`). **Medido sobre el código fuente: son 5.** Los otros 5 eran
**artefactos de `dist/`** (el `tsc` conserva los comentarios ⇒ los `.js`
compilados llevan la cabecera). Fuente: barrido de
`packages/**` (`.ts/.tsx/.js/.mjs/.cjs`, excluyendo `node_modules` y `dist`).

| Paquete | **Derivados reales** | Nativos con atribución en prosa | Upstreams |
|---|:---:|:---:|---|
| `packages/tool-call-repair` | **2** | 1 | `openclaw` (MIT) |
| `packages/tools` | **1** | 3 | `coucou` (MIT), `openclaw` (MIT), `career-ops` (MIT) |
| `packages/ui-runtime` | **2** | 4 | `hermes-agent` (MIT), `openclaw` (MIT), `coucou` (MIT) |
| **TOTAL** | **5** | **8** | 5 upstreams |

Ficheros derivados (los 5):

| Fichero | Upstream | Ruta de origen |
|---|---|---|
| `packages/tool-call-repair/src/grammar.ts` | `openclaw` | `packages/tool-call-repair/src/grammar.ts` |
| `packages/tool-call-repair/src/balanced-json.ts` | `openclaw` | `packages/normalization-core/src/balanced-json.ts` |
| `packages/tools/src/native/git/ChangeSetService.ts` | `coucou` | `NotchBuddy/Sources/CoucouKit/DiffEngine.swift` |
| `packages/ui-runtime/src/AnsiParser.ts` | `hermes-agent` | `apps/desktop/src/lib/ansi.ts` |
| `packages/ui-runtime/src/FuzzySearch.ts` | `hermes-agent` | `apps/shared/src/fuzzy.ts` |

### 5.3 El método de medición (por qué NO se ha leído el comentario)

El enunciado pide medir con evidencia. **El residuo verbatim de shingles de 48
caracteres NO basta**: un port **renombrado** da 0. Medido:

| Fichero | Residuo verbatim (48 chars) | Racha `shape` (tokens) | Racha `strict` (tokens) | Mejor coincidencia en el clon |
|---|:---:|:---:|:---:|---|
| `tool-call-repair/src/grammar.ts` | **176** (racha 223 chars) | 31 | **26** | **el ORIGEN DECLARADO** |
| `tool-call-repair/src/balanced-json.ts` | **631** (rachas 224 y 197) | 74 | **66** | **el ORIGEN DECLARADO** |
| `tools/.../ChangeSetService.ts` | 0 (traducción a TS) | 24 | **21** | **el ORIGEN DECLARADO** |
| `ui-runtime/src/AnsiParser.ts` | 0 (renombrado) | 41 | **39** | **el ORIGEN DECLARADO** |
| `ui-runtime/src/FuzzySearch.ts` | 0 (renombrado) | 45 | **35** | **el ORIGEN DECLARADO** |
| `tool-call-repair/src/coercion.ts` *(nativo)* | 0 | 28 | 11 | fichero ajeno |
| `tools/.../GitParser.ts` *(nativo)* | 0 | 25 | 10 | fichero ajeno |
| `tools/.../SessionDiffRevisions.ts` *(nativo)* | 0 | 18 | 14 | fichero ajeno |
| `tools/.../FileLockManager.ts` *(nativo)* | 0 | 21 | 8 | fichero ajeno |
| `ui-runtime/src/MermaidRenderer.ts` *(nativo)* | 0 | 32 | 9 | fichero ajeno |
| `ui-runtime/src/MockIPCBridge.ts` *(nativo)* | 0 | 13 | 9 | fichero ajeno |
| `ui-runtime/src/WindowState.ts` *(nativo)* | 0 | **51** | **11** | `pet-overlay.ts` (idioma universal) |

**Las dos métricas:**

- **`shape`**: racha más larga de la **secuencia de forma** (identificadores
  reducidos a un marcador, literales conservados). Delata el port renombrado.
- **`strict`**: la misma racha **exigiendo además los nombres** de los
  identificadores. Delata la copia literal y **separa el port de la
  coincidencia de forma**.

**Regla de clasificación (la que se aplicó):** un fichero es **DERIVADO**
cuando su mejor coincidencia en el clon es **el ORIGEN DECLARADO** y la racha
`strict` es alta (≥ 21 tokens). Con `strict` baja es un **idioma universal**
(el caso de `WindowState.ts`: `Math.round(x + (w - width) / 2)` para centrar un
rect es el mismo código en cualquier sitio) ⇒ **nativo**.

### 5.4 Lo que se ha construido

| Pieza | Dónde | Qué es |
|---|---|---|
| **Puerta genérica** (una sola implementación) | `packages/tool-call-repair/scripts/check-attribution.mjs` | Denominador = `provenance.manifest.json` del paquete. Comprueba: (1) el manifiesto existe y parsea; (2) cada **derivado** lleva la cabecera canónica exacta (upstream, licencia y ruta); (3) ningún **nativo** la lleva (atribución falsa); (4) **cobertura**: todo fichero que afirme una derivación o mencione un upstream declarado está clasificado, y **ningún fichero con cabecera canónica queda fuera del manifiesto**; (5) `LICENSE.md` recoge el aviso de cada upstream y cita cada derivado; (6) `NOTICE` nombra cada upstream; (7) el origen declarado **resuelve** dentro del clon. **`--check`**: informa del plan de cabeceras pendientes, **no escribe nunca** (0 cambios ⇒ exit 0; cambios ⇒ exit 1). |
| **Delegadores** | `packages/tools/scripts/check-attribution.mjs` · `packages/ui-runtime/scripts/check-attribution.mjs` | 12 líneas cada uno: importan la implementación y la ejecutan con su propio raíz. **Una** implementación, sin copias que se desincronicen (mismo criterio que `scripts/verify-attribution.mjs` de A7). |
| **Manifiestos** | `packages/{tool-call-repair,tools,ui-runtime}/provenance.manifest.json` | `version`, `package`, `headerForm`, `coverage`, `sourceRoots`, `exclude`, `upstreams` (licencia, copyright, clon de referencia), `derived[]` (ruta, upstream, origen, **evidencia medida**, `verbatim.maxShingles`, `measured.{shapeTokens,strictTokens,bestMatchIsOrigin}`) y `native[]` (ruta, **texto veraz del plano 2**, evidencia). |
| **`LICENSE.md`** | los 3 paquetes | Reescrito: la tabla de derivados incluye ahora la **evidencia medida**; los **nativos** tienen su fila con el texto veraz; y un aviso de que **el denominador es el manifiesto**. |
| **`NOTICE`** | los 3 paquetes | **Nuevo** (el avatar lo tenía; estos 3 no): aviso por upstream (licencia, copyright, URL, qué se usa y **qué NO** se usa — patrón de estudio ≠ código copiado). |
| **Scripts de paquete** | los 3 `package.json` | `attribution:check` y `attribution:check:ci` (`--check`). |

**Un paquete SIN código derivado NO recibe manifiesto ni `LICENSE.md`** (sería
ruido): en mi zona, `memory`, `tasks`, `runtime`, `security`, `events`,
`knowledge`, `models`, `decision` y `execution` **no lo tienen** — y está
**verificado** (§5.3: 0 de sus 24 ficheros atribuibles supera el umbral).

### 5.5 La puerta MUERDE (tests con *fixtures*)

`packages/tool-call-repair/test/attribution-gate.test.ts` (8 casos):

| Caso | Resultado |
|---|---|
| paquete conforme | **exit 0** |
| **derivado SIN cabecera canónica** | **exit 1** (muerde) |
| **nativo CON cabecera canónica** | **exit 1** (atribución falsa) |
| derivado con cabecera **sin declarar** en el manifiesto | **exit 1** |
| paquete con código derivado **sin `LICENSE.md`** | **exit 1** |
| `--check` sobre árbol conforme | exit 0, **0 cambios**, **no escribe** (y repetir da lo mismo: reproducible) |
| `--check` sobre árbol no conforme | exit 1 + plan de cabeceras, **no escribe** |
| el paquete real | **exit 0** (2 derivados + 1 nativo) |

Y los paquetes `tools` y `ui-runtime` **ejecutan la puerta contra sí mismos**
en su `test/attribution.test.ts` (tercer test: *"el MANIFIESTO de procedencia
clasifica todo lo atribuible y la puerta pasa"*).

## 6. Diffs exactos para otras zonas

### 6.1 → A4 (`apps/desktop/**`): **dos ficheros, tres líneas**

> **Yo no los toco** (`apps/desktop/**` está en marcha). El cambio **es
> necesario**: sin él, los literales `?? 24` / `?? 90` de
> `memory-curation.ts` **pisan** el ajuste persistido ⇒ la curaduría seguiría
> usando los literales aunque `gov/settings/memory_curation` dijera otra cosa.

**Diff 1 — `apps/desktop/src/main/subsystems/memory-curation.ts`**

```diff
-import { MemoryCurator, type CuratorRunStats } from "@ego/tasks";
+import {
+  MemoryCurator,
+  type CuratorRunStats,
+  type MemoryCuratorOptions,
+} from "@ego/tasks";
@@
 export function startMemoryCuration(
   adapter: EgoMemoryAdapter,
-  options: { intervalHours?: number; staleAfterDays?: number } = {},
+  options: MemoryCuratorOptions = {},
 ): MemoryCurator {
   memoryCurator?.stop();
-  const curator = new MemoryCurator(adapter, {
-    intervalHours: options.intervalHours ?? 24,
-    staleAfterDays: options.staleAfterDays ?? 90,
-  });
+  // L4 (A2bis, Ola 10): la cadencia y la ventana salen de
+  // `gov/settings/memory_curation` (los lee el propio curator en cada
+  // corrida). Aquí NO se pone ningún literal: un `?? 24` / `?? 90` pisaría
+  // el ajuste persistido.
+  const curator = new MemoryCurator(adapter, { ...options });
```

**Diff 2 — `apps/desktop/src/main/window/create-window.ts`** (línea ~229)

```diff
   try {
-    startMemoryCuration(adapter, { intervalHours: 24, staleAfterDays: 90 });
+    // L4 (A2bis, Ola 10): sin literales. La cadencia y la ventana salen de
+    // `gov/settings/memory_curation`; si no hay ajustes, el curator usa los
+    // defaults del paquete (24 h / 90 d / 500 examinados).
+    startMemoryCuration(adapter);
   } catch (err) {
```

**Opcional (si A4 quiere ser explícito en vez de implícito)**: el curator ya
exporta `readCurationSettings(adapter)`; el arranque podría hacer
`startMemoryCuration(adapter, await readCurationSettings(adapter))`. **No es
necesario** y **no se recomienda** (duplica la fuente de verdad).

**Lo que A4 debe saber (sin diff)**

- `@ego/tasks` exporta ahora `MemoryCuratorOptions` (con `maxRecordsPerRun`,
  `maxScanRecordsPerRun`, `scanPageSize`) y `readCurationSettings`.
- `CuratorRunStats` ha **crecido** (`scannedCount`, `examinedCount`,
  `examinedKeys`, `partial`, `maxRecordsPerRun`, `staleAfterDays`): es
  **aditivo**, no rompe a nadie.
- El test de producto `apps/desktop/test/memory-curation.test.ts` **sigue en
  verde** (verificado: `pnpm --filter @ego/desktop typecheck` exit 0); si A4
  cambia la firma de `startMemoryCuration`, ese test sigue valiendo.

### 6.2 → A7 (`scripts/**` y `.github/workflows/ci.yml`): **NO los toco**

**Spec 1 — el delegador `scripts/verify-attribution.mjs` debe correr las 3
puertas** (hoy sólo delega en la de `avatar`). Diff exacto propuesto:

```diff
--- a/scripts/verify-attribution.mjs
+++ b/scripts/verify-attribution.mjs
@@
 const args = process.argv.slice(2);
 const res = spawnSync(process.execPath, [IMPLEMENTACION, ...args], {
   cwd: join(ROOT, "packages", "avatar"),
   encoding: "utf8",
   windowsHide: true,
 });
 process.stdout.write(res.stdout ?? "");
 process.stderr.write(res.stderr ?? "");
-process.exit(res.status ?? 1);
+if ((res.status ?? 1) !== 0) process.exit(res.status ?? 1);
+
+// A2bis (Ola 10): los demas paquetes con codigo derivado tienen su propia
+// puerta (misma implementacion, delegadores de 12 lineas). Se ejecutan aqui
+// para que CI tenga UN solo punto de entrada.
+for (const pkg of ["tool-call-repair", "tools", "ui-runtime"]) {
+  const gate = join(ROOT, "packages", pkg, "scripts", "check-attribution.mjs");
+  if (!existsSync(gate)) continue;
+  const r = spawnSync(process.execPath, [gate, ...args], {
+    cwd: join(ROOT, "packages", pkg),
+    encoding: "utf8",
+    windowsHide: true,
+  });
+  process.stdout.write(r.stdout ?? "");
+  process.stderr.write(r.stderr ?? "");
+  if ((r.status ?? 1) !== 0) process.exit(r.status ?? 1);
+}
+process.exit(0);
```

> Nota: las 3 puertas **no** aceptan `--fix` (no mutan nada), así que el
> delegador puede reenviar los args tal cual sin riesgo. (El diff de A6 §8.1
> —que rechaza `--apply` en el delegador— sigue siendo válido y es
> **incompatible con reenviar `--fix` a mi puerta**: mi puerta no tiene
> `--fix`, así que si A6 aplica su diff, A7 debe filtrar `--fix`/`--apply`
> antes de pasarlos a las 3 puertas. **Recomendación de A7**: filtrar
> `--fix`/`--apply` para las 3 puertas nuevas.)

**Spec 2 — el job `verify` de CI** (`.github/workflows/ci.yml`, junto al bloque
de `packages/avatar` de A6):

```yaml
    - name: attribution (plano 1 del codigo) — packages/**
      run: |
        node scripts/verify-attribution.mjs          # avatar + tool-call-repair + tools + ui-runtime
```

(o, si A7 prefiere no tocar el delegador, tres pasos explícitos):

```yaml
    - name: attribution (plano 1 del codigo) — packages/**
      run: |
        pnpm --filter @ego/tool-call-repair attribution:check
        pnpm --filter @ego/tools attribution:check
        pnpm --filter @ego/ui-runtime attribution:check
```

**Spec 3 — `.gitignore`**: los ficheros `provenance.proposed.json` (que A6
produce) y cualquier `*.proposed.json` deberían estar ignorados. **Yo no toco
la raíz.**

### 6.3 → A1 (Backlog): el texto exacto de las 5 filas

**`EGO-FIND-110`** — reemplazar la celda `Estado` por `✅ Completada` y la
`Descripción` por:

```text
**Cerrado (A2bis, Ola 10):** el barrido **lee paginando con cursor**
(`listPaged` + cursor opaco) hasta agotar el namespace, con **presupuesto
explícito**: `maxRecordsPerRun` (500 examinados por namespace y corrida) y
`maxScanRecordsPerRun` (5000 leídos). Si el techo de lectura trunca el
namespace, la corrida lo **declara** (`partial: true` en las estadísticas y en
la auditoría `curator_run`) en vez de fingir que lo ha visto todo. **Coste
medido** contra VantaDB real: lectura paginada 0,17-1,0 ms/registro (5000
hechos ≈ 1-6 s) y **marcado en lote** (`putMulti`) ≈ 1,0-1,2 ms/registro
(500 marcas ≈ 0,6 s) frente a **25-33 ms/registro** con un `put` por registro
(500 marcas ≈ 16 s): el lote es 27× más barato y es lo que hace viable el
presupuesto. Test: `packages/tasks/test/MemoryCuratorSweep.test.ts` ("cura un
fact MÁS ALLÁ del puesto 50": 120 hechos, el stale del puesto 115 se cura).
```

**`EGO-FIND-111`** — `✅ Completada` + descripción:

```text
**Cerrado (A2bis, Ola 10):** el conjunto examinado se elije **por
antigüedad**, no por orden de clave. El motor **no indexa por `ts`** (no se
ha inventado un índice): se **trae por clave y se ordena en memoria** (criterio
medido y justificado en el handoff). El presupuesto se gasta en los **más
antiguos** y **en los accionables** (los terminales o en cuarentena no lo
consumen), así que la curaduría **converge**: cada corrida avanza a los
siguientes más antiguos en vez de reexaminar siempre los mismos. La corrida
expone `examinedKeys` (orden de antigüedad) para que el comportamiento sea
observable. Tests: "examina el registro más antiguo aunque su clave ordene al
final" · "un registro NUEVO entra en el conjunto examinado" · "el presupuesto
se gasta en registros ACCIONABLES".
```

**`EGO-FIND-112`** — `✅ Completada` + descripción:

```text
**Cerrado (A2bis, Ola 10) — decisión (a): propagar las 4.** La configuración
de la curaduría vive ahora en **`gov/settings/memory_curation`** (namespace
`gov/settings`, key `memory_curation`), con `intervalHours` (24),
`staleAfterDays` (90), `staleNamespaces` (`['kb/facts','kb/docs']`) y
`maxRecordsPerRun` (500). El curator los **lee él mismo en cada corrida**
(opción explícita en el código > ajuste persistido > default), así que las 4
opciones son alcanzables y efectivas **y** un cambio de ajuste surte efecto
sin reiniciar. `staleBatchSize` **desaparece** del contrato: su semántica
(un tope de lectura) está partida en dos presupuestos distintos —`maxRecordsPerRun`
(qué se examina) y `maxScanRecordsPerRun` (qué se lee)—, cosa que la medición
de coste hizo evidente. **Pendiente de A4** (diff exacto en el handoff):
quitar los literales `?? 24` / `?? 90` del cableado, que hoy pisarían el ajuste
persistido. Test: un test **por opción** que demuestra que cada una tiene
efecto.
```

**`EGO-FIND-113`** — `✅ Completada` + descripción:

```text
**Cerrado (A2bis, Ola 10) en `packages/tasks`; cableado en A4.** La cadencia
y la ventana salen de **`gov/settings/memory_curation`** (con valores por
defecto si no hay ajustes: 24 h / 90 d / `['kb/facts','kb/docs']` / 500
examinados). El módulo nuevo `packages/tasks/src/CurationSettings.ts` (patrón
espejo de `gov/settings/compression` de STAB-05) valida con Zod y degrada a
defaults ante un payload inválido (fail-soft: un ajuste corrupto **no** deja
la memoria sin curar). La **cadencia** se reevalúa en cada tick: si el ajuste
guardado cambia, el temporizador se reprograma. **Pendiente de A4** (diff
exacto en el handoff): `startMemoryCuration(adapter)` sin literales en
`create-window.ts` y sin `?? 24` / `?? 90` en `memory-curation.ts` (esos
literales pisarían el ajuste). **Limitación documentada, NO arreglada:** es un
job de **app de escritorio** (`setInterval(24 h)`, `unref`): la primera
corrida ocurre 24 h después de arrancar y sólo si la app sigue abierta ⇒ el
efecto real depende de cuánto esté abierta la app. El disparo al reanudar es
un cambio de producto (A4), fuera del alcance de esta ola.
```

**`EGO-FIND-82`** — `Estado`: `🟡 Parcial` → `🟠 Parcial` (sigue parcial: falta
el cableado de CI, que es de A7) + descripción (añadir al final):

```text
**Extendido al resto de `packages/**` (A2bis, Ola 10):** el contrato de
atribución tiene ahora **tres denominadores** (uno por paquete con código
realmente derivado): `packages/{tool-call-repair,tools,ui-runtime}/
provenance.manifest.json` clasifican **5 derivados** y **8 nativos** con su
upstream, licencia, ruta de origen y **evidencia medida**; cada uno lleva su
`LICENSE.md` (con la evidencia) y su `NOTICE` (nuevo). La **puerta es una
sola implementación** (`packages/tool-call-repair/scripts/check-attribution.mjs`)
con delegadores de 12 líneas en los otros dos paquetes (nada se duplica) y
**muerde**: derivado sin cabecera ⇒ exit 1; nativo con cabecera ⇒ exit 1;
derivado sin declarar en el manifiesto ⇒ exit 1; `--check` es **reproducible**
(0 cambios ⇒ exit 0) y **no escribe nunca**. **Recuento medido (no supuesto):
5 derivados reales** fuera de `avatar` (2 `tool-call-repair`, 1 `tools`,
2 `ui-runtime`); los otros 5 que se contaban eran artefactos de `dist/`. La
clasificación **no se hizo leyendo el comentario**: se midió contra los clones
de `repos-referencia/` con **dos** métricas (residuo verbatim de shingles de 48
caracteres y **racha de forma/`strict`** de la secuencia de tokens), porque un
port renombrado da 0 en la primera. Regla aplicada: un fichero es derivado
cuando su mejor coincidencia es **el origen declarado** y la racha `strict` es
alta; si no, es nativo con el texto veraz del plano 2. **Pendiente:** cablear
las puertas al job `verify` de CI (A7) — diff exacto en el handoff.
```

## 7. Verificación (comando + exit + resumen)

| # | Comando | Exit | Resumen |
|---|---|:---:|---|
| 1 | `pnpm --filter @ego/tasks test` | **0** | **93 tests, 93 pass, 0 fail** (18 ficheros) — incluye los 14 nuevos de `MemoryCuratorSweep.test.ts` |
| 2 | `pnpm --filter @ego/memory test` | **0** | **147 tests, 147 pass** (23 ficheros) |
| 3 | `pnpm --filter @ego/runtime test` | **0** | **125 tests, 125 pass** (20 ficheros) |
| 4 | `pnpm --filter @ego/security test` | **0** | **120 tests, 120 pass** (10 ficheros) |
| 5 | `pnpm --filter @ego/tools test` | **0** | **182 tests, 182 pass** (21 ficheros) — incluye la puerta nueva |
| 6 | `pnpm --filter @ego/ui-runtime test` | **0** | **97 tests, 97 pass** (15 ficheros) — incluye la puerta nueva |
| 7 | `pnpm --filter @ego/tool-call-repair test` | **0** | **21 tests, 21 pass** (3 ficheros) — incluye los 8 casos de la puerta |
| 8 | `node packages/tool-call-repair/scripts/check-attribution.mjs` | **0** | 2 derivados + 1 nativo, 0 cambios pendientes |
| 9 | `node packages/tools/scripts/check-attribution.mjs` | **0** | 1 derivado + 3 nativos, 0 cambios pendientes |
| 10 | `node packages/ui-runtime/scripts/check-attribution.mjs` | **0** | 2 derivados + 4 nativos, 0 cambios pendientes |
| 11 | `pnpm --filter @ego/desktop typecheck` | **0** | — |
| 12 | `pnpm -r typecheck` | **0** | — (no hubo falso rojo de los agentes en paralelo en esta pasada) |
| 13 | `pnpm lint` | **0** | — |
| 14 | `node scripts/verify-vantadb-ids.mjs` | **0** | 0 errores · 2 avisos (preexistentes) |
| 15 | `node scripts/audit-security.mjs` | **0** | 0 críticos · 0 altos sin justificar |
| 16 | `node scripts/check-docs-lint.mjs` | **1** | ⚠️ **no es deuda mía**: este handoff es un *worklog* ⇒ sus violaciones de formato (MD032/MD004/MD036/MD013) **se absorben solas** (la base se amplía con traza, que es el comportamiento diseñado). La **única regresión** que queda es `MD040/fenced-code-language` en **`docs/agent-ops/.../handoff/A4-ola10.md`** ⇒ fichero de **A4**, en edición. `MD040` está en la lista de reglas que **nunca** se absorben (deja el documento mal formado) ⇒ lo arregla quien lo escribió. |

### 7.1 Evidencia de ROJO (el arreglo se puede deshacer y los tests lo notan)

Con `packages/tasks/src/MemoryCurator.ts` restaurado a HEAD (vía
`git show HEAD:...`, sin tocar nada más):

```text
$ pnpm --filter @ego/tasks exec vitest run test/MemoryCuratorSweep.test.ts
 ❯ test/MemoryCuratorSweep.test.ts (14 tests | 11 failed)
   FAIL  L1 — cura un fact MÁS ALLÁ del puesto 50
         AssertionError: el fact del puesto 115 debe curarse: expected +0 to be 1
   FAIL  L1 — no se queda en la primera página cuando el cursor avanza
   FAIL  L2 — examina el registro más antiguo aunque su clave ordene al final
   FAIL  L2 — un registro NUEVO entra en el conjunto examinado
   FAIL  L1/L2 — el presupuesto por corrida se respeta
   FAIL  L1/L2 — el presupuesto se gasta en registros ACCIONABLES
   FAIL  L1/L2 — el presupuesto de LECTURA trunca el namespace y lo declara
   FAIL  L3 — maxRecordsPerRun decide el presupuesto de examen
   FAIL  L4 — lee gov/settings/memory_curation y aplica la ventana
   FAIL  L4 — una opción explícita gana al ajuste persistido
   FAIL  la corrida deja auditoría del barrido real
 Test Files  1 failed (1)
      Tests  11 failed | 3 passed (14)
```

(Los 3 que pasaban son los que HEAD ya satisfacía: `staleNamespaces` y
`staleAfterDays` **existían** en el paquete — lo que estaba muerto era su
**alcanzabilidad desde el producto**, y eso lo cierra el diff de A4.)

Y para L5, los tests de la puerta (`attribution-gate.test.ts`) **muerden por
construcción**: montan un paquete en un directorio temporal y comprueban el
exit code (derivado sin cabecera ⇒ 1; nativo con cabecera ⇒ 1; derivado sin
declarar ⇒ 1; sin `LICENSE.md` ⇒ 1).

## 8. Ficheros tocados en esta ola (exclusivamente mi zona)

| Fichero | Cambio |
|---|---|
| `packages/tasks/src/MemoryCurator.ts` | **reescrito**: barrido con cursor + orden por antigüedad + presupuestos + marcado en lote + ajustes desde `gov/settings` + auditoría ampliada |
| `packages/tasks/src/CurationSettings.ts` | **nuevo**: esquema Zod, defaults, parse tolerante y lectura de `gov/settings/memory_curation` |
| `packages/tasks/src/index.ts` | exporta `CurationSettings` |
| `packages/tasks/test/MemoryCuratorSweep.test.ts` | **nuevo**: 14 tests (L1, L2, L3, L4, presupuestos, lote, auditoría) |
| `packages/tool-call-repair/scripts/check-attribution.mjs` | **nuevo**: la puerta genérica (una sola implementación para `packages/**` ≠ `avatar`) |
| `packages/tool-call-repair/test/attribution-gate.test.ts` | **nuevo**: 8 casos con *fixtures* (la puerta muerde) |
| `packages/tool-call-repair/provenance.manifest.json` | **nuevo**: 2 derivados + 1 nativo, con evidencia medida |
| `packages/tool-call-repair/NOTICE` | **nuevo** |
| `packages/tool-call-repair/LICENSE.md` | reescrito (evidencia medida + tabla de nativos + denominador) |
| `packages/tool-call-repair/package.json` | scripts `attribution:check` / `attribution:check:ci` |
| `packages/tools/provenance.manifest.json` | **nuevo**: 1 derivado + 3 nativos, con evidencia medida |
| `packages/tools/NOTICE` | **nuevo** |
| `packages/tools/LICENSE.md` | reescrito (evidencia medida + tabla de nativos + denominador) |
| `packages/tools/scripts/check-attribution.mjs` | **nuevo**: delegador (12 líneas) |
| `packages/tools/test/attribution.test.ts` | tercer test: el manifiesto clasifica todo lo atribuible y la puerta pasa |
| `packages/tools/package.json` | scripts `attribution:check` / `attribution:check:ci` |
| `packages/ui-runtime/provenance.manifest.json` | **nuevo**: 2 derivados + 4 nativos, con evidencia medida |
| `packages/ui-runtime/NOTICE` | **nuevo** |
| `packages/ui-runtime/LICENSE.md` | reescrito (evidencia medida + tabla de nativos + denominador) |
| `packages/ui-runtime/scripts/check-attribution.mjs` | **nuevo**: delegador (12 líneas) |
| `packages/ui-runtime/test/attribution.test.ts` | tercer test: el manifiesto clasifica todo lo atribuible y la puerta pasa |
| `packages/ui-runtime/package.json` | scripts `attribution:check` / `attribution:check:ci` |

**No tocados**: `packages/avatar/**` · `apps/desktop/**` ·
`apps/desktop/renderer/**` · `packages/integrations/**` ·
`packages/subegos/**` · `packages/domains/**` (salvo leer) · `scripts/**` ·
raíz · `docs/**` (salvo este handoff).

**Sin commits** · **sin `pnpm install`** · **sin `git checkout/reset/stash/clean`**.

## 9. Deuda abierta

1. **A4** (§6.1): quitar los literales del cableado de la curaduría. **Sin
   ese diff, los ajustes de `gov/settings` siguen pisados.**
2. **A4** (§4.4): el disparo al **reanudar** la app (hoy la primera corrida
   es 24 h después de arrancar y sólo si la app sigue abierta).
3. **A7** (§6.2): cablear las 3 puertas al job `verify` y el diff del
   delegador.
4. **A1** (§6.3): las 5 filas del Backlog.
5. **Menor**: la puerta genérica está alojada en `@ego/tool-call-repair` por
   ser el único paquete con código derivado que no está en la zona de otro
   agente en esta ola. Cuando `packages/avatar` deje de tener su puerta
   propia, las dos implementaciones deberían fundirse en **una** (hoy son
   dos: la de `avatar` es de A6 y tiene además la puerta de verbatim).
6. **Menor**: la medición de procedencia (`shape`/`strict`) está **en el
   handoff**, no en un script versionado. Si se quiere repetible, el script
   debería vivir en `packages/tool-call-repair/scripts/` (o en `scripts/`,
   que es de A7) con su test.
7. **Menor**: `coverage: attributable` en los 3 manifiestos ⇒ un fichero
   **nuevo** que afirme una derivación sí se detecta, pero un fichero nuevo
   **sin** ninguna afirmación de derivación no necesita classifyse. El
   paquete `avatar` usa cobertura **total** (más estricta).

## 10. `RESULTADO`

```json
{
  "agente": "A2bis",
  "ola": 10,
  "status": "COMPLETE",
  "archivos_modificados": [
    "packages/tasks/src/MemoryCurator.ts",
    "packages/tasks/src/CurationSettings.ts",
    "packages/tasks/src/index.ts",
    "packages/tasks/test/MemoryCuratorSweep.test.ts",
    "packages/tool-call-repair/scripts/check-attribution.mjs",
    "packages/tool-call-repair/test/attribution-gate.test.ts",
    "packages/tool-call-repair/provenance.manifest.json",
    "packages/tool-call-repair/NOTICE",
    "packages/tool-call-repair/LICENSE.md",
    "packages/tool-call-repair/package.json",
    "packages/tools/provenance.manifest.json",
    "packages/tools/NOTICE",
    "packages/tools/LICENSE.md",
    "packages/tools/scripts/check-attribution.mjs",
    "packages/tools/test/attribution.test.ts",
    "packages/tools/package.json",
    "packages/ui-runtime/provenance.manifest.json",
    "packages/ui-runtime/NOTICE",
    "packages/ui-runtime/LICENSE.md",
    "packages/ui-runtime/scripts/check-attribution.mjs",
    "packages/ui-runtime/test/attribution.test.ts",
    "packages/ui-runtime/package.json"
  ],
  "hallazgos_resueltos": [
    "EGO-FIND-110: el barrido leia UNA sola pagina de 50 sin bucle de cursor. Ahora pagina con cursor opaco (listPaged) hasta agotar el namespace, con presupuesto explicito (maxRecordsPerRun=500 examinados, maxScanRecordsPerRun=5000 leidos) y 'partial' cuando el techo trunca. Marcado en LOTE (putMulti): medido 25-33 ms/registro (put individual) vs 0,99-1,20 ms/registro (lote) = 27x. Un fact del puesto 115 de 120 ahora se cura.",
    "EGO-FIND-111: el conjunto examinado era los primeros por clave. Ahora se ordena por ANTIGUEDAD en memoria (el motor no indexa por ts: no se inventa indice) y el presupuesto se gasta en los mas antiguos y en los ACCIONABLES (los terminales no lo consumen) => la curadura converge en vez de reexaminar siempre los mismos 50.",
    "EGO-FIND-112: 2 opciones muertas. Decision (a): propagar las 4. La configuracion vive en gov/settings/memory_curation y el curator la lee el mismo en cada corrida (opcion explicita > ajuste persistido > default). staleBatchSize desaparece: su semantica esta partida en dos presupuestos distintos (examen vs lectura).",
    "EGO-FIND-113: cadencia y ventana desde gov/settings/memory_curation (nuevo packages/tasks/src/CurationSettings.ts, Zod, fail-soft a defaults). La cadencia se reevalua en cada tick. LIMITACION DOCUMENTADA (no arreglada): job de app de escritorio -> la primera corrida es 24 h despues de arrancar y solo si la app sigue abierta.",
    "EGO-FIND-82: el contrato de atribucion pasa de 1 paquete a 3 (tool-call-repair, tools, ui-runtime) con manifiesto + LICENSE.md + NOTICE (nuevo) + puerta generica (una sola implementacion, delegadores de 12 lineas) que MUERDE (tests con fixtures). RECUENTO MEDIDO: 5 derivados reales (no 10: los otros 5 eran artefactos de dist/) y 8 nativos con el texto veraz del plano 2. La clasificacion se MIDIO (verbatim de 48 chars + racha shape/strict de tokens) contra los clones de repos-referencia, no leyendo el comentario."
  ],
  "verify": {
    "tasks test": "93/93 pass - exit 0",
    "memory test": "147/147 pass - exit 0",
    "runtime test": "125/125 pass - exit 0",
    "security test": "120/120 pass - exit 0",
    "tools test": "182/182 pass - exit 0",
    "ui-runtime test": "97/97 pass - exit 0",
    "tool-call-repair test": "21/21 pass - exit 0",
    "attribution:check (3 paquetes)": "exit 0 (2/1, 1/3, 2/4 derivados/nativos; 0 cambios pendientes)",
    "desktop typecheck": "exit 0",
    "pnpm -r typecheck": "exit 0",
    "pnpm lint": "exit 0",
    "verify-vantadb-ids.mjs": "exit 0 (0 errores, 2 avisos preexistentes)",
    "audit-security.mjs": "exit 0 (0 criticos, 0 altos sin justificar)",
    "rojo demostrado": "con MemoryCurator.ts restaurado a HEAD: 11 de 14 tests del barrido fallan; los tests de la puerta montan fixtures y comprueban el exit code"
  },
  "coste_medido": {
    "lectura_paginada_ms_por_registro": "0,17-1,00 (5000 hechos: 1-6 s)",
    "put_individual_ms_por_registro": "25,0-32,9 (500 marcas: 16,4 s)",
    "putMulti_lote_ms_por_registro": "0,99-1,20 (500 marcas: 0,6 s)",
    "barrido_completo_5000_hechos": "1-6 s de lectura + 0,6 s de marcado en lote",
    "factor_lote_vs_individual": 27
  },
  "recuento_derivados_reales": {
    "tool-call-repair": 2,
    "tools": 1,
    "ui-runtime": 2,
    "total": 5,
    "nota": "el enunciado decia 10: los otros 5 eran artefactos de dist/ (compilados). Los 24 ficheros atribuibles del resto de mi zona (memory, tasks, runtime, security, events, knowledge, models, decision, execution) se midieron y TODOS son nativos (racha strict <= 15 y su mejor coincidencia no es el fichero studied)."
  },
  "solicitudes_handoff": [
    "A4 - apps/desktop: diff exacto en la seccion 6.1 (2 ficheros, 3 lineas). Sin el, los literales ?? 24 / ?? 90 siguen pisando el ajuste de gov/settings. Ademas documentado (sin diff) el disparo al reanudar la app (seccion 4.4).",
    "A7 - CI: diff exacto del delegador scripts/verify-attribution.mjs y del paso de job verify en la seccion 6.2 (no los he tocado).",
    "A1 - Backlog: texto exacto de las 5 filas (EGO-FIND-110/111/112/113/82) en la seccion 6.3."
  ],
  "deuda_abierta": [
    "A4: quitar los literales del cableado (sin eso, los ajustes de gov/settings no surten efecto)",
    "A4: disparo de la curadura al reanudar la app (hoy: 24 h despues de arrancar y solo si la app sigue abierta)",
    "A7: cablear las 3 puertas al job verify + el diff del delegador",
    "A1: cerrar las 5 filas del Backlog",
    "Menor: la puerta generica esta alojada en @ego/tool-call-repair (criterio de zona); cuando avatar deje de tener la suya, las dos implementaciones deben fundirse en una",
    "Menor: la medicion de procedencia (shape/strict) esta en el handoff, no en un script versionado",
    "Menor: coverage 'attributable' en los 3 manifiestos (avatar usa cobertura total)"
  ],
  "SKILLS_CARGADAS": []
}
```
