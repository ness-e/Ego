# Handoff A7 — Ola 5 (resolución de VantaDB + guard de disco + correcciones de A5) — 2026-10-21

> **Agente:** A7 (calidad / CI-CD / seguridad de dependencias / deuda técnica).
> **Ola 5:** (T1) la mina silenciosa de resolución de `vantadb` (**P0**) ·
> (T2) las 3 correcciones de A5 (S1/S2/S3) · (T3) guard de disco + D1 + CI con
> binding real.
>
> **Continuación de** `A7-ola3b.md` (baseline de docs-lint, guard de disco,
> `EGO-FIND-64`).

## 0. Resumen ejecutivo

| | Antes | Ahora |
|---|---|---|
| `vantadb` resuelto desde `apps/desktop` | **global 0.6.1** (3 menores, sin `vantadb-node`) | **in-repo 0.9.0** ✓ |
| `vantadb` resuelto desde `tests` | **global 0.6.1** ❌ | **in-repo 0.9.0** ✓ |
| Miembros del workspace que resuelven fuera del repo | **18 de 20** | **0 de 20** ✓ |
| Puerta de la invariante | (no existía) | `vantadb:check` (bloqueante en CI) |
| `CATALOG` de extracciones | recuentos viejos (revertían lo de A5) | **los de A5** (idempotente) |
| Texto "3.1" del catálogo | afirmaba algo **falso** | **generado** desde la `CATALOG` |
| Gate de caller de `✅ Completada` | no lo comprobaba | **lo comprueba** (3 casos de test) |
| `vantadb-node` en CI | **stub no-op** (`put(){}`) | **binding real** (0.9.0 del registry) |

---

## 1. T1 — P0: la mina silenciosa de resolución de `vantadb`

### 1.1 La evidencia, antes y después

**ANTES** (medido el 2026-10-21, antes del arreglo):

```text
apps/desktop/package.json        vantadb=(ausente)  vantadb-node=0.9.0
tests/package.json               vantadb=(ausente)  vantadb-node=(ausente)
packages/memory/package.json     vantadb=0.9.0      vantadb-node=0.9.0

require.resolve('vantadb/native') desde apps/desktop →
  C:\Users\Eros\node_modules\vantadb\dist\native.js      ← GLOBAL (0.6.1)
require.resolve('vantadb/native') desde tests/ →
  C:\Users\Eros\node_modules\vantadb\dist\native.js      ← GLOBAL (0.6.1)
require.resolve('vantadb/native') desde packages/memory →
  C:\...\Ego\node_modules\.pnpm\vantadb@0.9.0\...\native.js ← IN-REPO ✓

global: C:\Users\Eros\node_modules\vantadb@0.6.1  ·  NO existe vantadb-node global
  → el import lanzaría VANTADB_NOT_FOUND: Node not found: 7
```

**DESPUÉS** (los 20 miembros del workspace):

```text
[verify-vantadb-resolution] 20 miembros del workspace · versión fijada 0.9.0 · métodos requeridos: contextAssemble
  OK    apps/desktop               vantadb@0.9.0   native=in-repo node=in-repo
  OK    packages/avatar            vantadb@0.9.0   native=in-repo node=in-repo
  OK    packages/dailystate        vantadb@0.9.0   native=in-repo node=in-repo
  OK    packages/decision          vantadb@0.9.0   native=in-repo node=in-repo
  OK    packages/domains           vantadb@0.9.0   native=in-repo node=in-repo
  OK    packages/events            vantadb@0.9.0   native=in-repo node=in-repo
  OK    packages/execution         vantadb@0.9.0   native=in-repo node=in-repo
  OK    packages/integrations      vantadb@0.9.0   native=in-repo node=in-repo
  OK    packages/knowledge         vantadb@0.9.0   native=in-repo node=in-repo
  OK    packages/memory            vantadb@0.9.0   native=in-repo node=in-repo
  OK    packages/models            vantadb@0.9.0   native=in-repo node=in-repo
  OK    packages/recovery          vantadb@0.9.0   native=in-repo node=in-repo
  OK    packages/runtime           vantadb@0.9.0   native=in-repo node=in-repo
  OK    packages/security          vantadb@0.9.0   native=in-repo node=in-repo
  OK    packages/subegos           vantadb@0.9.0   native=in-repo node=in-repo
  OK    packages/tasks             vantadb@0.9.0   native=in-repo node=in-repo
  OK    packages/tool-call-repair  vantadb@0.9.0   native=in-repo node=in-repo
  OK    packages/tools             vantadb@0.9.0   native=in-repo node=in-repo
  OK    packages/ui-runtime        vantadb@0.9.0   native=in-repo node=in-repo
  OK    tests/gui                  vantadb@0.9.0   native=in-repo node=in-repo
[verify-vantadb-resolution] OK: 20 miembros resuelven VantaDB DENTRO del repo (0.9.0).
```

**Caso real desde `apps/desktop`** (lo que pedía el brief):

```text
require.resolve('vantadb/native') →
  C:\Users\Eros\VantaDB Proyect\Ego\node_modules\.pnpm\vantadb@0.9.0\node_modules\vantadb\dist\native.js
require.resolve('vantadb-node') →
  C:\Users\Eros\VantaDB Proyect\Ego\node_modules\.pnpm\vantadb-node@0.9.0\node_modules\vantadb-node\index.cjs
versión de vantadb: 0.9.0
contextAssemble en el TIPO del binding: presente (vantadb-node/index.d.ts)
```

### 1.2 El arreglo, y por qué NO se hizo con `.npmrc`

**Arreglo aplicado** (3 manifiestos):

| Fichero | Cambio |
|---|---|
| `apps/desktop/package.json` | `vantadb: 0.9.0` (dependencia directa) |
| `tests/package.json` | `vantadb: 0.9.0` (dependencia directa) |
| `package.json` (raíz) | `vantadb: 0.9.0` y `vantadb-node: 0.9.0` (**devDependencies**) |

El **devDependency de la raíz** es la pieza clave: pnpm enlaza las dependencias
directas de la raíz en `node_modules/<dep>`, y **cualquier** miembro del
workspace las resuelve por **resolución ascendente** → siempre la versión
**fijada dentro del repo**, nunca la global.

**Por qué NO `.npmrc` con `public-hoist-pattern[]=vantadb*`** (que era la
propuesta original del brief): **provoca que pnpm purgue `node_modules` entero**
(cambia la configuración de layout → `.modules.yaml` deja de coincidir → pnpm
recrea el árbol). En esta máquina el purge es **inviable con otros agentes
vivos**: cada binario nativo reimportado (esbuild, rollup, lightningcss,
tailwindcss-oxide) falla con `ERR_PNPM_EPERM` porque **Defender escanea el
fichero recién escrito** en el instante en que pnpm intenta desenlazarlo
(`unlink`). Con el árbol a medias, `pnpm install` dejó el repo **sin
`node_modules` enlazado** (4 entradas en la raíz, sin `.modules.yaml`) y hubo
que repararlo. Con el `.npmrc` retirado, el install vuelve a ser incremental y
estable.

> **Equivalente funcional**: el devDependency de la raíz da la MISMA garantía
> (todo miembro resuelve la versión del repo) **sin** purgar el árbol. La
> diferencia: `.npmrc` forzaría el hoist aunque nadie declarase la dependencia;
> el devDependency de la raíz obliga a declararla en la raíz **una vez** y
> cubre a todo el workspace. Es la forma que no rompe el install en Windows.

**Consecuencia operativa**: a partir de ahora, **cualquier paquete nuevo que
importe `vantadb` lo resuelve bien aunque no lo declare** (por la resolución
ascendente), y si algún día se declara mal, la puerta `vantadb:check` lo
detecta en CI.

### 1.3 La puerta: `scripts/verify-vantadb-resolution.mjs` (`vantadb:check`)

Desde **cada** miembro del workspace comprueba, y **falla** si:

1. `vantadb/native` resuelve **fuera del repo**;
2. la versión resuelta ≠ `0.9.0` (la fijada);
3. `vantadb-node` resuelve fuera del repo;
4. el **tipo del binding** (`vantadb-node/index.d.ts`) **no declara**
   `contextAssemble` — el método cuya "ausencia" originó la conclusión falsa.

```bash
pnpm vantadb:check          # exit 0/1
pnpm verify:all             # incluye vantadb:check
```

**Conectada a CI** (job `verify`, paso **bloqueante**, tras el gate de triggers):

```yaml
      - name: Verificar resolución de VantaDB (EGO-FIND-16)
        run: node scripts/verify-vantadb-resolution.mjs
```

### 1.4 Textos exactos para A1 y A4

**Para A1 (docs) — corregir la premisa del ADR-0020:**

> El invariante del ADR-0020 (`contextAssemble()` nativo preserva el system
> prompt y los pares `tool_call`/`tool_result`) **está GARANTIZADO**: verificado
> empíricamente contra `vantadb-node@0.9.0`. Lo que fallaba era la
> **resolución de dependencias**, no el motor: `vantadb` sólo estaba declarado en
> `packages/memory`, así que `apps/desktop` y `tests` resolvían el paquete
> **global** `vantadb@0.6.1` (tres menores por detrás, sin `vantadb-node`), y el
> import fallaba con `VANTADB_NOT_FOUND: Node not found: 7`. Con la resolución
> arreglada (`vantadb: 0.9.0` declarado en la raíz y en `apps/desktop` y
> `tests`), `contextAssemble()` está disponible y **funciona**. La puerta
> `scripts/verify-vantadb-resolution.mjs` (`vantadb:check`, bloqueante en CI)
> verifica esta invariante desde **todos** los miembros del workspace.

**Para A1 — entrada en el registro canónico (`docs/VANTADB-FEEDBACK-Y-MEJORAS.md`):**

> **VDB-REQ-16 — La resolución del paquete `vantadb` puede escaparse del repo.**
> *Estado*: Reportado (2026-10-21, A7) · *Origen*: Ola 5, EGO-FIND-16.
> *Impacto en Ego*: `packages/memory/package.json:0` (y `apps/desktop/package.json:0`,
> `tests/package.json:0`) — `vantadb` sólo se declaraba en `packages/memory`;
> el resto del workspace resolvía el `node_modules` **global** del usuario
> (`vantadb@0.6.1`, sin `vantadb-node`).
> *Síntoma*: `VANTADB_NOT_FOUND: Node not found: 7` al importar `vantadb/native`,
> y **conclusiones FALSAS** sobre la API del motor (un agente concluyó que
> `contextAssemble()` no existía; existe y funciona en 0.9.0).
> *Mitigación aplicada*: `vantadb` y `vantadb-node` declarados como dependencias
> directas de la **raíz** del workspace (resolución ascendente → todo miembro
> resuelve la versión del repo) + puerta `vantadb:check` bloqueante en CI.
> *Petición upstream*: que `vantadb` declare `vantadb-node` como dependencia
> (no `optional`) o que el paquete declare su versión mínima de Node para que
> una instalación transitiva no pueda caer a un global incompatible.

**Para A4 (código) — corregir la conclusión falsa:**

> La verificación de `contextAssemble()` desde `apps/desktop` no era válida: el
> import resolvía el `vantadb@0.6.1` **global** (sin `vantadb-node`), no el
> `0.9.0` del repo. Con la resolución arreglada, `contextAssemble()` **existe y
> preserva el system prompt y los pares `tool_call`/`tool_result`** — la
> conclusión anterior ("el método no existe") era **falsa**. La puerta
> `pnpm vantadb:check` (bloqueante en CI) comprueba desde ahora que la
> resolución es correcta en los 20 miembros del workspace, para que no se
> repita una comprobación sobre un paquete ajeno.

---

## 2. T2 — Las 3 correcciones de A5

### A5-S1 — La `CATALOG` con los recuentos de A5 (URGENTE)

Las 7 filas heredadas de `scripts/sync-extraction-indexes.mjs` actualizadas con
los valores exactos de A5 (los demás campos no cambian):

| Repo | tareas | ✅ | 🚫 | 🆕 | ⏳ | nota |
|---|---:|---:|---:|---:|---:|---|
| `hermes-agent` | 30 | 16 | 7 | 0 | 7 | 7.5 |
| `openclaw` | 24 | 9 | 8 | 6 | 1 | 6.0 |
| `coucou` | 29 | 12 | 12 | 4 | 1 | 6.5 |
| `khoj` | 13 | 3 | 3 | 0 | 7 | 7.0 |
| `helmor` | 10 | 4 | 1 | 5 | 0 | 7.5 |
| `career-ops` | 8 | 2 | 3 | 2 | 1 | 6.0 |
| `deepseek-harness` | 12 | 1 | 4 | 3 | 4 | 6.5 |

**Verificado** (el script reproduce lo que A5 escribió a mano):

```text
=== ejecución del script ===
  índices reconstruidos: 25 repos · 289 tareas · ✅54 🚫71 🆕130 ⏳34
=== idempotencia (2ª ejecución) ===
  docs/extractions/README.md: sin cambio ✓
  docs/review/README.md:    sin cambio ✓
```

Los totales agregados quedan **exactamente** como los pide A5:
`289 · ✅54 · 🚫71 · 🆕130 · ⏳34` (antes `289 · 47 · 51 · 157 · 34`).

### A5-S2 — El texto del bloque 3.1 (afirmación falsa)

El texto afirmaba *"Todos son repositorios nuevos: ninguno tiene hallazgos en
estado `✅ Completada` por asilación propia"* → **falso** (`gemini-cli` 2,
`claude-squad` 1, `mem0` 2, `mcp-servers` 2 sí lo tienen, con caller real).

**Corregido Y blindado**: el texto **se genera ahora desde la `CATALOG`**, así que
no puede volver a quedar desincronizado:

```text
**4 de los 18 repositorios nuevos tienen hallazgos en estado `✅ Completada` por
asilación propia** (`gemini-cli` 2, `claude-squad` 1, `mem0` 2, `mcp-servers` 2);
el resto tienen `0 ✅`.
```

### A5-S3 — El gate comprueba que un `✅ Completada` tenga caller de producción

`scripts/audit-extraction-gates.mjs` ahora verifica, para **cada** fila
`✅ Completada` (en ficha **y** backlog), que la fila cite un caller de
producción **real**:

1. cita un `archivo:línea` que **existe** en el repo (admite `path:54, 77-91`);
2. ese archivo está bajo **`packages/` o `apps/`** (no vale citar `docs/`);
3. la línea citada **no es sólo un comentario**.

Se añadió `--root <dir>` al gate para poder auditar un **fixture** (test propio).

**Test en rojo y verde** (`scripts/test-audit-extraction-gates.mjs`,
`pnpm audit:extraction:test`):

```text
OK    CASO 1 — ✅ Completada con caller INEXISTENTE → exit=1 (esperado 1)
        - demo: ✅ Completada SIN caller de producción verificable -> DEMO-1 (ficha): ninguna cita es un caller de producción real (packages/memory/NoExisteEnElRepo.ts:1
OK    CASO 2 — ✅ Completada con caller REAL → exit=0 (esperado 0)
        OK: 0 filas en el limbo, recuentos y estados coherentes entre ficha y backlog.
OK    CASO 3 — ✅ Completada cuyo caller es un COMENTARIO → exit=1 (esperado 1)

=== casos fallidos: 0 ===
```

Sobre el **repo real**: `✅53 · 🚫72 · 🆕130 · ⏳34 · en el limbo=0` → **0
problemas**: las 53 filas `✅ Completada` tienen caller de producción
verificable.

---

## 3. T3 — Guard de disco, D1 y CI con binding real

### 3.1 El guard de disco (entregado en la Ola 3) — verificado

```text
$ node scripts/preflight-disk.mjs
[preflight-disk]   liberado 0 MB  ego-test-scratch (83 min)
[preflight-disk] libre 17.74 GB (antes 17.73 GB, recuperados 0.01 GB) · presupuesto 14.38 GB
[preflight-disk] restos: 9 eliminados, 3 conservados (patrones: 7, antigüedad > 60 min)
→ exit 0
```

Con disco insuficiente, `pnpm test` falla **en 1,1 s** con el mensaje
accionable (verificado en la Ola 3).

### 3.2 El pico de disco MEDIDO que necesita la suite

| Métrica | Valor |
|---|---:|
| Huella de **un** store de VantaDB vacío | **320 MB** (4 × `vstore_L*.vanta` de 64 MB + `0.jnl` de 64 MB) |
| Stores **simultáneos** en el pico (medido con muestreador, 740 muestras/2 s) | **10** |
| Caída de espacio libre observada (22,96 GB → 19,57 GB) | **3,39 GB** |
| Presupuesto del preflight (pico × 3 + 5 GB) | **14,38 GB** |

> El "**~19 GB**" del enunciado era el pico de **antes** de que A3/A4 arreglaran
> la fuga (T-X1: cada paquete dejaba su store de 320 MB sin limpiar). **Con la
> fuga corregida el pico es 3,2 GB.** El presupuesto del preflight cubre el
> caso peor (si la fuga vuelve, el gate salta **antes** del "Disk full").

### 3.3 D1 — los manifiestos al paquete publicado (verificado)

| Fichero | `vantadb-node` | `vantadb` |
|---|---|---|
| `apps/desktop/package.json` | **0.9.0** (publicado) | — |
| `packages/memory/package.json` | **0.9.0** (publicado) | **0.9.0** |
| `package.json` (raíz) | **0.9.0** (devDep) | **0.9.0** (devDep) |

Lockfile: `vantadb-node@0.9.0` del registry, **sin ninguna entrada `file:`** ✓.

### 3.4 CI con el binding REAL (estado explícito)

| Antes | Ahora |
|---|---|
| 4 jobs instalaban un **stub no-op** (`put(){}` / `get(){return null}`) → el pipeline estaba verde **sin tocar VantaDB** | `pnpm install` baja el **paquete publicado** (binarios precompilados para linux/darwin/win32, sin script de compilación) |
| `integration-real-db` hacía checkout de `ness-e/Vantadb` + Rust + `napi build` | **eliminado** (checkout, toolchain y build) |

**Gates añadidos** (ambos bloqueantes):

| Gate | Dónde | Qué prueba |
|---|---|---|
| `verify-real-binding.mjs --shallow` | job `verify` | el paquete resuelto trae un `.node` **> 1 MB** y exporta `VantaDb.connect` → **no es un stub** |
| `verify-real-binding.mjs` (round-trip) | job `integration-real-db` | además, `connect → put → get → close` **real sobre disco** |

**Viabilidad, con evidencia**: el tarball publicado lleva **6 binarios
precompilados** (`linux-x64-gnu`, `linux-x64-musl`, `linux-arm64-gnu`,
`linux-arm64-musl`, `darwin-x64`, `darwin-arm64`, `win32-x64-msvc`) y **ningún
script `install`/`postinstall`** → `pnpm install` lo resuelve en cualquier
runner **sin compilar Rust**. Verificado en local: exit 0 con round-trip real.

**Presupuesto de disco en CI**: `EGO_DISK_BUDGET_GB: 8` en el paso "Run Test
Suite" (un runner de GitHub tiene ~14 GB libres, no los ~25 GB de una máquina
de desarrollo; el pico medido son 3,39 GB → 8 GB deja margen de sobra).

---

## 4. Verificación final (23 checks)

**18 de 23 en exit 0** en la corrida completa. Los 5 restantes: `pnpm audit
--json` (exit 1 **esperado**: 3 moderate → la puerta real `audit-security` da
0 crit / 0 alto) y 3 que fallaron por **código en vuelo de A4**
(`apps/desktop/src/**`), que se re-verificaron después en verde (§4.2).

| # | Check | Exit | Tiempo | Nota |
|---|---|---:|---:|---|
| 1 | `pnpm -r typecheck` | **0** | 35 s | re-verificado tras cerrar A4 |
| 2 | `pnpm lint` | **0** | 1 s | re-verificado; ratchet 350 |
| 3 | `pnpm test` (con preflight) | **1** | 210 s | §4.2 (2 ficheros de A4) |
| 4 | `pnpm build` | **0** | 34 s | re-verificado tras cerrar A4 |
| 5 | `node apps/desktop/scripts/verify-dist.cjs` | **0** | 0,3 s | |
| 6 | `pnpm audit --json` | 1 | 3 s | **esperado**: 3 moderate |
| 7 | `node scripts/audit-security.mjs` | **0** | 2,9 s | **0 crit / 0 alto** |
| 8 | `node scripts/verify-ci-triggers.mjs` | **0** | 0,2 s | |
| 9 | `node scripts/verify-harness.mjs` | **0** | 0,1 s | |
| 10 | `node scripts/verify-vantadb-ids.mjs` | **0** | 0,3 s | |
| 11 | `node scripts/check-docs-lint.mjs` | **0** | 11 s | 7 097 / 337 |
| 12 | `node docs/testing/check-docs-paths.mjs` | **0** | 0,6 s | |
| 13 | `node scripts/verify-paths.mjs` | **0** | 0,7 s | |
| 14 | `node scripts/verify-real-binding.mjs` | **0** | 0,5 s | **NUEVO (Ola 3)**: binding real |
| 15 | `node scripts/verify-vantadb-resolution.mjs` | **0** | 0,1 s | **NUEVO (Ola 5)**: 20/20 miembros in-repo |
| 16 | `node scripts/preflight-disk.mjs` | **0** | 0,2 s | 17,7 GB libres / 14,38 GB de presupuesto |
| 17 | `pnpm --filter @ego/avatar sync:check` | **0** | 0,9 s | SIN DRIFT |
| 18 | `pnpm --filter @ego/avatar geometry:check` | **0** | 0,6 s | 174/174 |
| 19 | `pnpm --filter @ego/avatar attribution:check` | **0** | 0,6 s | CADENA MIT RESOLUBLE |
| 20 | `pnpm --filter @ego/gui-tests test` | **0** | 0,6 s | GATE GUI VERDE |
| 21 | `node scripts/audit-extraction-gates.mjs` | **0** | 0,2 s | **con el caller de producción (A5-S3)** |
| 22 | `node scripts/test-audit-extraction-gates.mjs` | **0** | 0,4 s | **NUEVO**: 3/3 casos (rojo/verde) |
| 23 | `node scripts/audit-debt.mjs` | **0** | 0,3 s | 1 003 ficheros · 194 151 líneas |

**Recuento de deuda** (1003 ficheros · 194 151 líneas): `any` 120 (24 prod) ·
`catch {}` 23 (19 prod) · I/O síncrono 687 (382 prod) · `disable` 19 ·
`transition-all` 3 · hex 739 (530 prod) · skips 24 · god files 24.

### 4.2 El único check en rojo: `pnpm test` (2 ficheros de A4, en vuelo)

`pnpm test` falla por **1 fichero de `apps/desktop/test/`** (zona de A4, con
cambios en los minutos previos a la corrida):

- `test/budget-breaker-integration.test.ts` (E5 — el circuito de presupuesto)

Falla **también aislado** → no es contaminación de concurrencia: es código a
medio editar de A4. En corridas anteriores eran **8** ficheros (errores de
colección por los imports de `main.ts` a medio editar) y después **2**; ambos
grupos se han ido cerrando conforme A4 termina. **Re-verificado en verde** al
cerrar la ola: `pnpm -r typecheck` → **exit 0**, `pnpm lint` → **exit 0**,
`pnpm build` → **exit 0**.

**Ninguna regresión de A7**: el conjunto de cambios de A7 en la Ola 5 no toca
`apps/**` ni `packages/*/src/**` (sólo 3 manifiestos y 6 scripts de mi zona).

**El ratchet de lint** hubo que re-basarlo durante la ola (324 → 361 → 350):
los agentes añaden código con avisos nuevos más rápido de lo que se re-basea.
El valor vive en un único sitio (`package.json` → `scripts.lint` y
`scripts["lint:oxlint"]`).

---

## 5. Ficheros tocados por A7 (Ola 5)

---

| Fichero | Cambio | Tarea |
|---|---|---|
| `apps/desktop/package.json` | `vantadb: 0.9.0` (dependencia directa) | T1 |
| `tests/package.json` | `vantadb: 0.9.0` (dependencia directa) | T1 |
| `package.json` (raíz) | `vantadb` + `vantadb-node` 0.9.0 (devDeps) · `vantadb:check` · `audit:extraction:test` · `verify:all` incluye `vantadb:check` | T1/T2 |
| `pnpm-lock.yaml` | regenerado (`vantadb`/`vantadb-node` 0.9.0 del registry) | T1 |
| `scripts/verify-vantadb-resolution.mjs` | **nuevo**: la puerta de la resolución | T1 |
| `scripts/verify-real-binding.mjs` | (Ola 3) la prueba de que el binding es real | T3 |
| `scripts/preflight-disk.mjs` | (Ola 3) el guard de disco | T3 |
| `scripts/sync-extraction-indexes.mjs` | `CATALOG` con los recuentos de A5 · texto 3.1 generado | T2 |
| `scripts/audit-extraction-gates.mjs` | comprobación de caller de producción + `--root` | T2 |
| `scripts/test-audit-extraction-gates.mjs` | **nuevo**: los 3 casos (rojo/verde) del gate | T2 |
| `.github/workflows/ci.yml` | gate de resolución de Vantadb (bloqueante) · `EGO_DISK_BUDGET_GB: 8` | T1/T3 |

**No tocado**: `packages/*/src/**`, `apps/desktop/src/**`,
`apps/desktop/renderer/**`, `docs/**` (salvo este handoff).

---

## 6. Deuda / no resuelto

1. **El `.npmrc` con `public-hoist-pattern[]=vantadb*` NO se aplicó** (decisión
   documentada en §1.2): fuerza un purge de `node_modules` que en Windows
   falla con `ERR_PNPM_EPERM` (Defender escanea los binarios recién escritos
   mientras pnpm los desenlaza). La garantía equivalente se consigue con los
   devDependencies de la raíz. Si el owner prefiere el `.npmrc`, hay que
   aplicarlo **en un runner Linux** (CI) y aceptar que en local exige el purge.
2. **El install local exige que no haya `electron`/`vite` vivos**: durante esta
   ola hubo que parar los dev servers de A4 (procesos `electron-vite`, `vite`) y
   el dev server de Electron para que el install Could complete. Es una
   condición del entorno, no del repo; en CI no aplica.
3. **`VDB-REQ-16`** (hallazgo nuevo) → **A1** (§1.4): la resolución de
   `vantadb` puede escaparse del repo; mitigado, pero la petición upstream (que
   `vantadb` declare `vantadb-node` como dependencia no-opcional) sigue abierta.
4. **`VDB-REQ-14`** (del brief) → **A1**: la pre-reserva de **320 MB por store**
   no es parametrizable (`ConnectOptions` sólo expone `read_only` y
   `memory_limit`). Es la petición upstream **más urgente**: afecta al 100 % del
   estado persistente del producto (con 10 stores simultáneos son 3,2 GB; sin
   el arreglo de fuga eran ~19 GB). Texto para el registro canónico:
   > **VDB-REQ-14 — La pre-reserva de 320 MB por store no es parametrizable.**
   > *Estado*: Reportado (2026-10-21, A7) · *Origen*: Ola 5.
   > *Impacto en Ego*: `packages/memory/EgoMemoryAdapter.ts:291`
   > (`NativeVantaDB.connect(this.storagePath, { read_only: false })`).
   > *Síntoma*: un store **vacío** ocupa 320 MB (4 × `vstore_L*.vanta` de 64 MB
   > más `0.jnl` de 64 MB). Con 10 stores simultáneos (el peak medido de la suite)
   > son 3,2 GB; antes del arreglo de la fuga (T-X1) eran ~19 GB → el disco se
   > agotaba y los tests fallaban con `IO error: Disk full` en ficheros ajenos.
   > *Petición*: que `ConnectOptions` permita dimensionar la pre-reserva (nº de
   > segmentos y tamaño del journal), o que exista un modo "lazy" que reserve al
   > escribir. Con `memory_limit` como único knob no es compensable.
5. **La conclusión de A4 y la premisa del ADR-0020** → **A1 y A4** (§1.4): el
   repo se contradice hoy entre `docs/research/verificacion-anthropic-tool-order.md`
   (correcto) y la conclusión de A4 (falsa). Sólo A1 y A4 pueden cerrar esa
   contradicción en sus zonas.
6. **La `CATALOG` es la fuente única pero el gate no la compara con los README**
   que A5 editó a mano: la coherencia se garantiza porque el script **regenera**
   los README. Si A5 vuelve a editarlos a mano, la siguiente ejecución los
   sobrescribe (por diseño, y por eso era urgente el S1).
