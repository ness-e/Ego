# Handoff A2 — Ola 2, Vitest 3 — 2026-10-20

> Agente: A2 (núcleo cognitivo, 9 paquetes) · Zona: `packages/{memory,knowledge,runtime,models,decision,execution,events,security,tool-call-repair}/**` + paquete `tests` (raíz)
> No se tocó `package.json` raíz ni `pnpm-lock.yaml` (A7). Sin commits. Sin `pnpm install`.

## 1. Cambios aplicados (ficheros propios)

### T1 — Los 10 manifiestos alineados con la realidad

Todos pasan de `vitest: "^2.1.2"` a `vitest: "^3.2.7"` (una línea por fichero; formato JSON preservado byte a byte salvo la línea tocada):

| Manifiesto | Antes | Ahora | Script `test` |
|---|---|---|---|
| `packages/decision/package.json` | `^2.1.2` | **`^3.2.7`** | `vitest run` |
| `packages/events/package.json` | `^2.1.2` | **`^3.2.7`** | `vitest run` |
| `packages/execution/package.json` | `^2.1.2` | **`^3.2.7`** | `vitest run` |
| `packages/knowledge/package.json` | `^2.1.2` | **`^3.2.7`** | `vitest run` |
| `packages/memory/package.json` | `^2.1.2` | **`^3.2.7`** | `vitest run --test-timeout=20000` ← (§2) |
| `packages/models/package.json` | `^2.1.2` | **`^3.2.7`** | `vitest run` |
| `packages/runtime/package.json` | `^2.1.2` | **`^3.2.7`** | `vitest run` |
| `packages/security/package.json` | `^2.1.2` | **`^3.2.7`** | `vitest run` |
| `packages/tool-call-repair/package.json` | `^2.1.2` | **`^3.2.7`** | `vitest run` |
| `tests/package.json` (`@ego/e2e-tests`) | `^2.1.2` | **`^3.2.7`** | `vitest run` |

Verificación: **20 manifiestos en el repo declaran vitest ⇒ los 20 en `^3.2.7`, 0 fuera de línea** (los 10 míos + los 10 de A3/A4/A6/A7). El `git diff` de cada manifiesto es de **1 línea**.

### T2 — Timeout de `packages/memory` (único paquete con margen insuficiente)

`packages/memory/package.json` → `"test": "vitest run --test-timeout=20000"`.

**Causa medida** (no especulativa): con el pool `forks` de vitest 3, el test más lento de mi zona es
`packages/memory/test/snapshot-retention.test.ts :: poda a max_snapshots conservando los más recientes` con
**4577 ms** frente al límite por defecto de **5000 ms** ⇒ **423 ms de margen (8 %)**. Escribe muchos snapshots
en el VantaDB real (fsync en Windows). Con el paralelismo de ficheros de CI, ese margen se evapora.

Precedente: A3 ya lo hizo en `packages/tools` y `packages/recovery` (`--test-timeout=20000`).
**No se silencia nada**: es un límite *mayor* para tests que hacen I/O real; ningún test se salta ni se silencia.

## 2. Análisis de breaking changes v2 → v3 (verificado contra el source INSTALADO, no de memoria)

Fuentes leídas: `node_modules/.pnpm/vitest@2.1.9*/node_modules/vitest/dist/chunks/*.js` y
`node_modules/.pnpm/vitest@3.2.7*/node_modules/vitest/dist/chunks/*.js` + `@vitest/expect/dist/index.js` de ambas.

| Cambio v2 → v3 | v2.1.9 (source) | v3.2.7 (source) | Impacto en mi zona |
|---|---|---|---|
| **Pool por defecto** | *"Specify pool… (default: `threads`)"* | *"Specify pool… (default: `forks`)"* + *"Isolate tests in forks pool (default: `true`)"* | **MEDIO** — arranque más lento por fichero (fork vs thread). Medido: el test más lento de mi zona = 4577 ms (`memory`, carga del binding nativo de VantaDB). Mitigado con `--test-timeout=20000` en `memory`. Los otros 8 paquetes: test más lento ≤ 3040 ms ⇒ margen ≥ 1,9 s ⇒ **no necesitan cambio**. |
| `fileParallelism` | `true` | `true` (*"Should all test files run in parallel… (default: `true`)"*) | **Ninguno** |
| `sequence.concurrent` / `maxConcurrency` | sin cambio relevante | sin cambio relevante | **Ninguno** (mis tests son secuenciales) |
| Matchers usados por mi zona: `vi.fn` (105 usos), `vi.spyOn` (41), `toHaveBeenCalled*` (68), `expect.objectContaining` (22), `vi.mocked` (6), `vi.stubGlobal`/`unstubAllGlobals` (6), `toSatisfy` (2), `toHaveBeenCalledOnce` (1), `toBeCalled*`, `toBeOneOf`, `expect.stringContaining`/`arrayContaining`/`stringMatching` | **todos PRESENTES** | **todos PRESENTES** | **Ninguno**. Nota de rigor: `toSatisfy` existe en **v2.1.9 también** (lo verifiqué) ⇒ **no** es un matcher exclusivo de v3 y no puede usarse como argumento de incompatibilidad. |
| Snapshots (`toMatchSnapshot` / `toMatchInlineSnapshot`) | formato antiguo | formato nuevo (v3) | **Ninguno** — mi zona **no usa snapshots** (0 ocurrencias). |
| `environment: 'edge'` | soportado | eliminado | **Ninguno** — sin entornos custom en mi zona. |
| `vi.useFakeTimers` / `advanceTimersByTime` | — | — | **Ninguno** — 0 usos en mi zona (los timers son reales). |
| `test.each` / `it.each` | — | — | **Ninguno** — 0 usos en mi zona. |
| `vi.mock` con factory / hoisting | — | — | **Ninguno** — mi zona no usa `vi.mock` (0 usos). |
| `pool: 'forks'` + `isolate` | n/a | `isolate` por defecto `true` | **Ninguno** (más aislamiento, no menos). |

**Conclusión**: el único breaking change con impacto real en mi zona es el **pool por defecto `threads` → `forks`**, y su efecto medido es el tiempo de arranque por fichero. Todo lo demás que usa mi zona es API estable entre v2 y v3.

### Medida de los timeouts por test (reporter JSON de vitest 3.2.7, durations reales)

| Paquete | tests | test más lento | ≥ 3000 ms | ≥ 5000 ms (límite) |
|---|---|---|---|---|
| memory | 153 | **4577 ms** | 1 | 0 |
| models | 93 | 3040 ms | 2 | 0 |
| knowledge | 86 | 1779 ms | 0 | 0 |
| runtime | 103 | 1544 ms | 0 | 0 |
| decision | 52 | 1165 ms | 0 | 0 |
| execution | 59 | 618 ms | 0 | 0 |
| security | 103 | 119 ms | 0 | 0 |
| events | 38 | 97 ms | 0 | 0 |
| tool-call-repair | 11 | 4 ms | 0 | 0 |

**0 tests ≥ 5000 ms en los 9 paquetes** ⇒ sólo `memory` (el que carga el binding nativo) necesitaba margen extra.

## 3. Verificación

| Comando | Exit | Resumen |
|---|---|---|
| `pnpm --filter @ego/{memory,knowledge,runtime,models,decision,execution,events,security,tool-call-repair} test` | **0** | **698 tests, 0 fallos** (memory 153 · knowledge 86 · runtime 103 · models 93 · decision 52 · execution 59 · events 38 · security 103 · tool-call-repair 11) |
| Los 9 paquetes con el **binario de vitest 3.2.7 del store invocado directamente** (`node node_modules/.pnpm/vitest@3.2.7*/node_modules/vitest/vitest.mjs run`) | **0** | idéntico: 698 passed. Prueba explícita, no dependiente de cómo se resuelva el binario |
| `pnpm --filter @ego/e2e-tests test` (paquete `tests`, 10.º manifiesto) | 1 | **71 passed · 5 failed · 1 skipped**. Los 5 fallos son de `e2e/contract/floating-wiring.contract.test.ts` → **no son un problema de vitest 3**: el test lee `apps/desktop/src/main.ts` **como texto** (`readFileSync`) y afirma que contiene `win.on("minimize")`. Ese patrón **estaba en `main.ts` en HEAD** y A4 lo ha movido al extraer `main.ts` (E6, +91/−1159 líneas). Verificado con `git show HEAD:apps/desktop/src/main.ts`. → **handoff a A4** |
| `pnpm -r typecheck` | 2 | **1 error, en zona de A4**: `apps/desktop/src/main/models/model-config.ts:453` → *"Cannot find name 'setCurrentModelConfigState'"*. El símbolo **sólo aparece en su punto de uso** (no existe en ninguna otra parte del repo) ⇒ referencia rota de la descomposición de `main.ts` en curso. **No relacionado con vitest** (es un fichero de `apps/desktop`, no un test). Mis 9 paquetes typechequean limpios |
| `pnpm --filter @ego/<cada uno> typecheck` (×9) | **0** | 9/9 sin errores |
| Manifiestos con `vitest` en el repo | — | **20/20 en `^3.2.7`**, 0 en `^2.1.2` |
| `pnpm-lock.yaml` | — | **21 entradas con `specifier: ^3.2.7` y 0 con `^2.1.2`** ⇒ el lockfile **ya está re-resuelto** (el `pnpm install` de A7, que terminó a las 12:51, incorporó mis manifiestos) |

**Sobre la "trampa" del override**: mientras el override estuvo, mis tests corrían bajo v3 aunque el manifiesto dijera `^2.1.2`. Ahora el override **ya no está** (A7 lo quitó: `git diff package.json` muestra `- "vitest": "^3.2.7"` en `pnpm.overrides`) y **el repo sigue verde** ⇒ la realidad (v3.2.7) y los manifiestos coinciden por primera vez.

## 4. Estado del lockfile y trabajo que queda para A7

**A7 ya hizo el install y el lockfile ya refleja los 10 manifiestos** (21 × `^3.2.7`, 0 × `^2.1.2`). Y el override `vitest` de la raíz **ya no está**.

Lo que **queda por confirmar** del lado de A7 (no es mío):
1. **`pnpm install` de confirmación** tras mi cambio de `packages/memory/package.json` (añadí `--test-timeout=20000` al script `test`: es un cambio de *script*, no de dependencia ⇒ **no afecta al lockfile** ⇒ no requiere install; pero si A7 re-lanza install, que sea sobre el estado actual).
2. **Quitar el override `vitest`** de `pnpm.overrides` — **ya hecho** (verificado en `git diff`). Si A7 lo revierte, el repo sigue verde, pero el manifiesto y el lockfile quedan inconsistentes con la raíz.
3. **Re-baselinar el ratchet de lint** al recuento real (los avisos de `apps/desktop` y `packages/avatar` siguen fuera de mi zona).

**Advertencia para A7 sobre concurrencia**: durante mi verificación, `pnpm --filter ... test` falló de forma intermitente en `memory`/`knowledge`/`runtime` (y el e2e pasó de 71 a 57) **mientras tu `pnpm install` estaba en curso** (2 procesos `pnpm` vivos, `node_modules/.pnpm` modificado a las 12:46). Reintenté tras tu install (12:51) ⇒ **todo verde**. Es la carrera que la tarea advertía: no es un fallo de vitest 3 ni de mis manifiestos.

## 5. Handoff a A4 (fichero ajeno, causa verificada)

| # | Fichero | Cambio pedido | Motivo | Bloqueante |
|---|---|---|---|---|
| 1 | `tests/e2e/contract/floating-wiring.contract.test.ts` (o `apps/desktop/src/main.ts` + el test) | Los 5 contratos fallan porque `win.on("minimize")` ya **no está** en `main.ts` (A4 lo movió al extraerlo: `git show HEAD:apps/desktop/src/main.ts` lo tiene; hoy no). Opciones: (a) actualizar el contrato para leer el nuevo módulo donde A4 lo movió el wiring, o (b) reintroducir el registro en `main.ts` | El test contractual lee `main.ts` como texto (`readFileSync`, línea 42) ⇒ falla por contenido, no por vitest | — (A4) |
| 2 | `apps/desktop/src/main/models/model-config.ts:453` | Falta `setCurrentModelConfigState` (el símbolo no existe en ninguna otra parte del repo) ⇒ `pnpm -r typecheck` falla | Referencia rota de la descomposición de `main.ts` en curso | — (A4) |

## 6. Deuda / no resuelto

1. **Nada pendiente en mi zona**: los 10 manifiestos declaran la realidad, los 698 tests pasan bajo vitest 3.2.7 real (probado con el binario del store invocado directamente), y el único timeout ajustado está justificado por una medición.
2. **Los 5 fallos del paquete `tests`** y **el error de typecheck de `apps/desktop`** son de A4 (§5), no míos.
3. **Riesgo residual**: `packages/memory` sigue siendo el paquete con menor margen (4577 ms de 5000 ms → ahora 20000 ms gracias al `--test-timeout`). Si A7 quiere un margen uniforme, la alternativa es un `vitest.config.ts` por paquete con `testTimeout` global, en lugar del flag por CLI (decision de A7, no mía).

```
RESULTADO: {
  agente: A2-nucleo-ola2-vitest3,
  status: COMPLETED,
  archivos_modificados: [
    "packages/decision/package.json", "packages/events/package.json", "packages/execution/package.json",
    "packages/knowledge/package.json", "packages/memory/package.json", "packages/models/package.json",
    "packages/runtime/package.json", "packages/security/package.json", "packages/tool-call-repair/package.json",
    "tests/package.json",
    "docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A2-ola2-vitest3.md"
  ],
  hallazgos_resueltos: [
    "10 manifiestos con vitest ^2.1.2 -> ^3.2.7 (alineados con la realidad y con el lockfile: 21 x ^3.2.7, 0 x ^2.1.2)",
    "packages/memory: --test-timeout=20000 justificado por medición (test más lento 4577 ms de un límite de 5000 ms con el pool forks de vitest 3)"
  ],
  verify: { typecheck: "9/9 paquetes A2 exit 0; `pnpm -r typecheck` falla SOLO en apps/desktop (zona A4: setCurrentModelConfigState indefinido)",
    tests: "698 passed / 0 failed en los 9 paquetes (probado con el binario vitest 3.2.7 del store invocado directamente)",
    e2e: "tests: 71 passed / 5 failed / 1 skipped — los 5 son contratos sobre apps/desktop/src/main.ts (A4 movió el wiring; verificado contra HEAD)",
    lockfile: "21 entradas vitest ^3.2.7, 0 con ^2.1.2; el override vitest de la raíz ya no está" },
  solicitudes_handoff: 2,
  deuda_abierta: [
    "A4: 5 contratos de floating-wiring fallan porque win.on(\"minimize\") salió de main.ts (verificado con git show HEAD)",
    "A4: setCurrentModelConfigState indefinido en apps/desktop/src/main/models/model-config.ts:453 -> rompe `pnpm -r typecheck`",
    "A7: confirmar install final y re-baselinar el ratchet de lint; el override vitest de la raíz ya fue retirado"
  ],
  SKILLS_CARGADAS: ["source-driven-development", "test-driven-development", "systematic-debugging", "code-review-and-quality"]
}
```
