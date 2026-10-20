# Handoff A7 — Ola 1c (2026-10-20) #

> **Agente:** A7 (calidad / CI-CD / seguridad de dependencias / deuda técnica).
> **Onda:** 1c — huecos de gobernanza de A7: (T1) gate mecánico de trazabilidad
> de los IDs de VantaDB · (T2) su conexión a CI · (T3) cierre de los pendientes
> de la Ola 1b · (T4) índice de scripts.
> **Fichero canónico del registro:** `docs/VANTADB-FEEDBACK-Y-MEJORAS.md`
> (zona de A1 — A7 sólo lo LEE).

## 1. Cambios aplicados (ficheros propios) ##

### T1 — Gate mecánico de trazabilidad de IDs de VantaDB (CRÍTICO) ###

`scripts/verify-vantadb-ids.mjs` (nuevo). Es el gate que convierte en
verificable el guardrail de `AGENTS.md` §4 ("Prohibición de Workarounds
Silenciosos"), que hasta ahora sólo estaba escrito.

### Qué verifica ###

| Código | Tipo | Qué detecta |
|---|---|---|
| `E1` | ERROR | Referencia en el código a un ID **no registrado** |
| `E2` | ERROR | `Workaround (upstream): VDB-XXX-NN` con ID **no registrado**: violación literal de AGENTS.md §4 |
| `E3` | ERROR | Registro incoherente: ID con fila de índice pero sin sección de detalle, o al revés |
| `E4` | ERROR | El mismo ID con descripciones **incompatibles** (índice vs detalle): el ID se reutiliza para dos temas |
| `W1` | AVISO | Referencia **sin anclaje temático**: el comentario no comparte ningún término significativo con la entrada del registro |
| `W2` | AVISO | ID registrado de severidad Alta/Crítica **nunca citado** en el código: puede ser petición puramente upstream |
| `W3` | AVISO | La evidencia de la entrada no incluye `archivo:línea` |
| `W4` | AVISO | Entradas sin campo `**Estado:**` explícito (agregado, no una por entrada) |
| `W5` | AVISO | Entradas sin alguna de las secciones mínimas (agregado por entrada) |
| `I1` | INFO | IDs de la taxonomía del **upstream** (p.ej. `VDB-FIND-249`): no son IDs de este registro |

### Interfaz CLI ###

```text
node scripts/verify-vantadb-ids.mjs             # legible, exit 0/1
node scripts/verify-vantadb-ids.mjs --json      # JSON por stdout
node scripts/verify-vantadb-ids.mjs --strict    # los avisos también bloquean
node scripts/verify-vantadb-ids.mjs --root <dir>  # audita otro árbol (fixtures)
```

En CI (`GITHUB_ACTIONS=true`) emite además anotaciones `::warning::` con
`file=` y `line=` de cada problema: aparecen en la pestaña *Annotations* del
run, no sólo en el log.

### TDD — ROJO (estado real) → VERDE (fixture corregido) ###

```text
=========== ROJO: repo real ===========
$ node scripts/verify-vantadb-ids.mjs
[verify-vantadb-ids] registro: docs/VANTADB-FEEDBACK-Y-MEJORAS.md · 19 IDs registrados
[verify-vantadb-ids] código: 835 ficheros · 62 referencias a IDs
  ERROR   E2 packages/knowledge/src/GraphRagEngine.ts:54 VDB-REQ-11 — Workaround sin ID
         registrado: "VDB-REQ-11" no existe en el registro canónico (AGENTS.md §4)
         └─ * Workaround upstream: `VDB-REQ-11` — el binding napi-rs 0.8.0 no expone el
  ERROR   E1 packages/knowledge/src/ProjectMemoryGraph.ts:102 VDB-REQ-12 — Referencia a
         un ID no registrado: "VDB-REQ-12" no existe en el registro canónico
  ...
[verify-vantadb-ids] 24 error(es) · 38 aviso(s) · 0 informativo(s)
[verify-vantadb-ids] gate FALLIDO: hay referencias a IDs de VantaDB que no cuadran
  con el registro canónico (AGENTS.md §4).
EXIT=1

=========== VERDE: fixture con las referencias corregidas ===========
$ node scripts/verify-vantadb-ids.mjs --root <fixture>
[verify-vantadb-ids] registro: docs/VANTADB-FEEDBACK-Y-MEJORAS.md · 22 IDs registrados
[verify-vantadb-ids] código: 834 ficheros · 62 referencias a IDs
[verify-vantadb-ids] 0 error(es) · 45 aviso(s) · 0 informativo(s)
[verify-vantadb-ids] gate OK: todas las referencias a IDs de VantaDB cuadran.
EXIT=0
```

El fixture (registro con las filas de índice que faltan + los tres IDs
renumerados) se generó **fuera del repo**, en `%TEMP%/vdb-fixture`, sin tocar
`packages/**` ni `apps/**`.

### T2 — El gate en CI ###

`.github/workflows/ci.yml` — step nuevo en el job `verify`, después de
typecheck/lint/test:

```yaml
      - name: Trazabilidad de IDs de VantaDB (AGENTS.md §4)
        id: vdb-ids
        continue-on-error: true
        run: |
          node scripts/verify-vantadb-ids.mjs
          echo "::notice title=IDs VantaDB::no bloquea mientras A1/A2 corrigen el registro"
          echo "::notice::el detalle por fichero:línea está en el log del step"
```

**Por qué NO bloqueante:** hoy el gate está en rojo por referencias que
**A1/A2 están corrigiendo en paralelo** (§2.1). Un step bloqueante dejaría el
pipeline rojo por trabajo ajeno. Con `continue-on-error: true` el estado es
**visible** (log + anotaciones del run) sin bloquear el merge. **No hay bypass
oculto**: el exit code real del script sigue siendo 1.

**TODO(A1/A2):** cuando el gate salga en verde, quitar `continue-on-error` y
convertirlo en bloqueante. Está documentado en el propio step y en
`scripts/README.md`.

### T3 — Cierre de los pendientes de la Ola 1b ###

| Punto | Antes | Ahora | Verificado |
|---|---|---|---|
| Ratchet de lint | `--max-warnings 320` | **`--max-warnings 310`** | `pnpm lint` exit 0 (299 warnings reales) |
| Baseline de markdownlint | 11 364 violaciones / 272 ficheros | **11 489 violaciones / 273 ficheros** | `pnpm docs:lint` exit 0 |
| Overrides vivos | 9 | 9 (justificación medida abajo) | `pnpm audit --json` → **0 críticos / 0 altos** |
| `pnpm test` fail-fast | `pnpm -r ... run test` | **`pnpm -r --no-bail ... run test`** | exit 0 salvo el flake ajeno (§4) |

### Overrides: justificación medida de cada uno ###

Todas medidas con `pnpm audit --json`, no supuestas:

| Override | Tipo | Justificación medida |
|---|---|---|
| `electron: ^41.10.7` | temporal | Dep **directa** de `apps/desktop` (zona A4) cuyo manifiesto sigue en `^33.2.0`. `electron@33.4.11` (EOL) arrastra 12 advisories HIGH. Se borra cuando A4 suba el manifiesto. |
| `electron-builder: ^26.15.3` | temporal | Dep **directa** de `apps/desktop` (zona A4) → `^25.1.8`. Sin el override: `app-builder-lib@25.1.8` HIGH. |
| `app-builder-lib: 26.15.3` | temporal | Transitiva de `electron-builder`. Sin el override entran `app-builder-lib@25.1.8` (HIGH) y su cadena `→ electron-builder-squirrel-windows@25.1.8 → @electron/rebuild@3.6.1 → node-gyp@9.4.1 → tar@6.2.1` (9 HIGH + **1 CRITICAL**). Es el override que **cierra la cadena crítica**. |
| `builder-util-runtime: ^9.7.0` | temporal | Transitiva de `app-builder-lib`. Sin el override: `builder-util-runtime@9.2.10` HIGH (fuga de credenciales en redirects de electron-updater). |
| `vitest: ^3.2.7` | temporal | Dep **directa** en 20 paquetes (zonas A2/A3/A4) → `^2.1.2`. `vitest@2.1.9` tiene un advisory CRITICAL (UI: ejecución arbitraria). |
| `@vitest/coverage-v8: ^3.2.7` | temporal | Dep **directa** de `apps/desktop/renderer` (zona A4) → `^2.1.2`. |
| `tinypool: ^2.2.0` | **permanente** | Transitiva de `vitest@3.2.7` (que declara `tinypool: ^1.1.1`). **Ningún paquete del workspace la declara**: no se puede resolver subiendo un manifiesto. Sin el override vuelve `tinypool@1.1.1` con **2 advisories CRITICAL** (prototype pollution → RCE; fix ≥ 2.1.2). Lockfile verificado: `vitest@3.2.7 → tinypool: 2.2.0`. |
| `tar: ^7.5.22` | **permanente** | Transitiva de `node-gyp@12` (que declara `tar: ^7.5.4`). Sin el override, la cadena `electron-builder → app-builder-lib@25.1.8 → @electron/rebuild@3.6.1 → node-gyp@9.4.1` reintroduce `tar@6.2.1` (9 HIGH + 1 CRITICAL; fix ≥ 7.5.19). Lockfile verificado: `tar@7.5.22`. |
| `vitepress>vite: ^6.4.4` | **permanente** | `vitepress@1.6.4` declara `vite: ^5.4.14` → resolvería `5.4.21`, vulnerable (1 HIGH: bypass de `server.fs.deny` + 2 moderate). **Ningún paquete declara `vite` como dependencia directa de vitepress** (es transitiva): hace falta el override. Se **acota** con el selector `vitepress>vite` para no forzar el vite del renderer ni el de vitest. Lockfile verificado: `vitepress@1.6.4 → vite: 6.4.4`. |

### Decisión sobre `--no-bail` (APROBADA) ###

El script `test` raíz ahora usa `pnpm -r --no-bail ... run test`.

*Por qué:* un gate que se detiene en el primer paquete fallido **no
diagnostica**. Medido en esta ola: con fail-fast hubo que reejecutar la suite
**4 veces** para descubrir cada fallo por separado (`integrations` → `execution`
→ `tools` → `apps/desktop`); con `--no-bail` la **única** ejecución muestra el
panorama completo (19 paquetes ejecutados, 1 fallo total). El coste de tiempo
está acotado: los paquetes corren en paralelo, así que el fail-fast sólo
ahorra tiempo cuando YA hay un fallo (el caso en el que menos importa
acortar).

**Verificación del cambio:** `pnpm test` → 19 paquetes ejecutados, 1 fallo
total (el flake ajeno de §4), frente a fail-fast que se habría parado en el
primer paquete.

### T4 — Índice de scripts ###

`scripts/README.md` — reescrito como **índice de puertas de calidad**: una
tabla con, para cada script, *qué hace · cuándo corre · salida esperada*,
separando los **gates** (los que pueden fallar el pipeline) de las
utilidades de soporte. Incluye los 13 scripts de A7 (los 11 de las olas
anteriores + `verify-vantadb-ids.mjs`) y los que ya existían.

## 2. Barrido de IDs VantaDB: resultado ##

**Estado medido al cierre de A7-Ola1c** (`node scripts/verify-vantadb-ids.mjs`):

| Métrica | Valor |
|---|---|
| IDs registrados en el registro | **19** (6 BUG · 4 INC · 9 REQ) |
| Ficheros de código analizados | **835** (`packages/**` + `apps/**`, sin `node_modules`/`dist`/`out`/`vendor`) |
| Referencias a IDs en el código | **62** |
| **Errores bloqueantes** | **24** |
| Avisos | **38** |

### 2.1 Los 24 errores, por zona y causa ###

| Zona | Ficheros | Errores | Qué falta |
|---|---:|---:|---|
| **A2** (`packages/knowledge`, `packages/memory`) | 6 | **22** | Referencias a `VDB-REQ-10` (7), `VDB-REQ-11` (5) y `VDB-REQ-12` (10): IDs que **NO existen** en el registro |
| **A1** (`docs/VANTADB-FEEDBACK-Y-MEJORAS.md`) | 1 | **2** | `VDB-INC-04` y `VDB-BUG-06` tienen sección de detalle pero **no tienen fila en el índice** |

**Semántica de los IDs no registrados** (extraída del propio código, para que
A2 sepa a qué ID del registro debería apuntar cada uno):

| ID citado | Tema real del código | Dónde |
|---|---|---|
| `VDB-REQ-10` | El binding `vantadb-node@0.8.0` no expone canal denso / RRF real ni `query_vector` denso | `Workaround upstream:` en `HybridSearch.ts:18,40` · `schemas/knowledge.ts:66` · `similarity.ts:10,12,74` · `EgoMemoryAdapter.ts:679` |
| `VDB-REQ-11` | El binding 0.8.0 **no expone el motor de consultas (IQL)** | `Workaround upstream:` en `GraphRagEngine.ts:54,267` · `EgoMemoryAdapter.ts:1208` |
| `VDB-REQ-12` | El sustrato de grafo **no se sembraba** con la cadena causal real | `Workaround:` en `ProjectMemoryGraph.ts:102,116` · `GraphSeeding.test.ts:5` · `EgoMemoryAdapter.ts:1099,1123,1147,1180,1212` |

**Cómo lo resuelve A2** (opción A, sin tocar el registro): renumerar las
referencias a IDs que **ya existen** y cuyo tema encaja:

| Tema | ID del registro que encaja | Nota |
|---|---|---|
| Canal denso / RRF / `query_vector` denso | `VDB-REQ-02` | es el tema ya citado en `HybridSearch.ts:14,37` y `similarity.ts:5` |
| IQL / motor de consultas ausente en el binding | `VDB-REQ-09` (publicar el binding) **no** encaja: hace falta un ID nuevo | opción B |
| Siembra del sustrato de grafo | `VDB-REQ-07` (poda y grado en grafos) es lo más cercano, pero no es lo mismo: hace falta un ID nuevo | opción B |

> Opción B (recomendada): **A1 registra `VDB-REQ-10` (IQL), `VDB-REQ-11`
> (siembra del grafo) y `VDB-REQ-12` (canal denso)**, y A2 renumera sus
> referencias. El fixture que usé para la prueba VERDE del gate es esa
> combinación (registro con las filas nuevas + código renumerado) y el gate
> sale **exit 0**.

### 2.2 Los 38 avisos (no bloquean) ###

| Código | Nº | Qué son |
|---|---:|---|
| `W1` | 9 | Referencias sin anclaje temático (**posible desalineación semántica**) |
| `W2` | 2 | IDs Alta/Crítica nunca citados en el código |
| `W3` | 15 | Entradas cuya evidencia no incluye `archivo:línea` |
| `W4` | 1 | 19 entradas sin campo `**Estado:**` (agregado) |
| `W5` | 11 | Entradas sin alguna sección mínima (agregado) |

**Sobre `W1` (el detector de desalineación semántica):** la heurística es
"el comentario no comparte **ningún** término significativo con el título ni
la descripción de la entrada del registro". Con cero overlap, 8 de los 9
casos son referencias **correctas** cuyo comentario simplemente no repite el
vocabulario del registro, y 1 es una referencia **realmente** mal alineada
detectada por el gate:

```text
packages/memory/EgoMemoryAdapter.ts:563 VDB-BUG-02 ::
  // Workaround: VDB-BUG-02 (metadata etiquetada en putMulti; aquí se desenvuelve)
```

`VDB-BUG-02` es "Fallo de deserialización IEEE-754 a `VantaValue::Int(i64)`",
pero el comentario habla de **metadata etiquetada**: ese caso es
`VDB-BUG-04` ("Rechazo de estructuras anidadas profundas en `metadata`"). El
mismo fichero cita `VDB-BUG-04` en otras líneas.

**Calibración (medida, no supuesta):** la señal de overlap=0 tiene ~89 % de
falsos positivos. Por eso `W1` es **aviso**, no error: sirve para que una
persona mire, no para bloquear. Los **errores** del gate se limitan a lo
determinista (IDs inexistentes, incoherencia del registro).

## 3. Verificación ###

| Comando | Exit | Resultado |
|---|---|---|
| `node scripts/verify-vantadb-ids.mjs` (repo real) | **1** | 24 errores · 38 avisos → **ROJO** (TDD) |
| `node scripts/verify-vantadb-ids.mjs --root <fixture>` | **0** | 0 errores → **VERDE** (TDD) |
| `pnpm typecheck` | **0** | 21 paquetes + renderer + tests |
| `pnpm lint` | **0** | 299 warnings (ratchet 310) + typecheck encadenado |
| `pnpm audit --json` | **0** | **0 críticos, 0 altos**, 3 moderados |
| `pnpm test` (con `--no-bail`) | 1 | 19 paquetes ejecutados, **1 fallo total** (flake ajeno, §4) |
| `pnpm docs:lint` | **0** | baseline 11 490 / 273 ficheros |
| `node scripts/verify-ci-triggers.mjs` | **0** | 6/6 workflows alcanzables |
| `node scripts/verify-harness.mjs` | **0** | 18 agentes + 13 comandos sin drift |
| `pnpm --filter @ego/avatar sync:check` | **0** | SIN DRIFT |
| `pnpm --filter @ego/avatar geometry:check` | **0** | 168/168 |

**Baseline de markdownlint (valor final para el informe del orquestador):**
**11 489 violaciones en 273 ficheros** (`scripts/docs-lint-baseline.json`,
markdownlint-cli2 0.15.0). El corpus crece con cada documento que aterrizan
A1/A5/A6/A8: hay que recalibrar al cierre de la ola.

## 4. Deuda / no resuelto ###

1. **El gate de IDs está en ROJO (24 errores)**: es lo que debe pasar. A1 (2
   filas de índice + 2-3 IDs nuevos) y A2 (22 referencias) lo tienen que
   arreglar. Hasta entonces el step de CI va como aviso (`continue-on-error`).
2. **`pnpm test` falla por UN test ajeno**:
   `apps/desktop/test/ipc-bridges-t13.test.ts` (el "401 del proveedor → error
   accionable") **falla bajo carga y pasa aislado** (10/10, 4,6 s). Es un
   fichero que **A4 está editando** (`M` en `git status`). Con `--no-bail` se
   ve el panorama completo en una sola ejecución: 19 paquetes, 1 fallo.
3. **La baseline de markdownlint hay que recalibrarla** cada vez que aterrice
   documentación nueva (valor actual: 11 489 / 273 ficheros).
4. **Los 9 overrides siguen vivos**: 5 temporales (los quitan A2/A3/A4 al
   subir sus manifiestos) y 4 permanentes (`tinypool`, `tar`,
   `vitepress>vite` y `app-builder-lib`, que no se pueden resolver por
   resolución de peers).
5. **Ratchet de lint en 310** con 299 warnings reales: el orquestador puede
   ajustarlo al cierre de la ola.
6. **DIST-09 sigue bloqueado por el owner** (publicar `vantadb-node` en npm +
   tag de release). El tarball no se versiona (decisión de arquitectura).
7. **3 advisories moderados sin fix upstream** (`vitest`/`@vitest/mocker` path
   traversal, `sprintf-js` DoS): informativos.
8. **`W1` tiene ~89 % de falsos positivos**: sirve para revisión humana, no
   como gate. Para ganar precisión hace falta un diccionario de temas curado
   por A1 en el propio registro; no lo he inventado porque sería una decisión
   de A1.
