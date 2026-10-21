# scripts/ — Ledger de utilidades (F6T12/M32)

Estado verificado 2026-10-20. Un script está **mantenido** solo si tiene
referencias vivas (código, CI, docs activas o taskfiles del plan maestro).
El resto son **one-offs archivados**: se conservan por historia, no usar
como dependencia.

> **Este es el índice de las puertas de calidad de Ego.** Si añades un gate
> nuevo, añádelo aquí con: qué hace · cuándo se ejecuta · qué salida se
> espera. El próximo agente lo leerá antes de tocar el pipeline.

## Puertas de calidad (gates): qué hace · cuándo corre · salida esperada

| Gate | Qué hace | Cuándo corre | Salida esperada |
|---|---|---|---|
| `verify-ci-triggers.mjs` | Comprueba que **cada** workflow de `.github/workflows/` tenga un trigger alcanzable en la rama real del repo (cruza los filtros de rama con `git branch -r`). Sin esto, un workflow puede quedar **inerte** (rojo/verde que no significa nada). | CI, job `verify` (step "Verificar triggers alcanzables"). Local: `pnpm verify:ci`. | exit 0 + "TODOS LOS WORKFLOWS ALCANZABLES (6)". Si hay un workflow inerte → exit 1 con el fichero. |
| `verify-harness.mjs` | Valida el rack de agentes: frontmatter de `.opencode/agents/*.md` (description + mode + permission con claves soportadas), **sin drift** con `.agents/`, paridad de comandos y anti-stale de refs en `AGENTS.md`. | CI, job `verify`. Local: `pnpm verify:harness`. | exit 0 + "harness sano". Con drift → exit 1 con el agente afectado. |
| `check-docs-lint.mjs` | Gate de markdownlint **con línea base**: falla sólo ante violaciones NUEVAS (el corpus arrastra **7 131** preexistentes en 336 ficheros, toleradas por `scripts/docs-lint-baseline.json`). | CI, job `docs-lint` (`pnpm docs:lint`). | exit 0 + "gate OK: ninguna violación nueva". `--write-baseline` recalibra. |
| `preflight-disk.mjs` | **Gate de disco previo a la suite**: mide el espacio libre, lo compara con el presupuesto MEDIDO de la suite y limpia los restos de test de `%TEMP%` (> 1 h y sin proceso vivo). | `pnpm test` (primero, no se puede saltar) · `pnpm disk:check`. | exit 0 con margen · exit 1 con el mensaje accionable (cuánta GB faltan y cómo liberarlas). |
| `verify-vantadb-resolution.mjs` | **Puerta de la resolución de VantaDB** (EGO-FIND-16): desde **cada** miembro del workspace resuelve `vantadb/native` y `vantadb-node` y falla si la ruta cae **fuera del repo**, si la versión ≠ la fijada, o si el tipo del binding no declara `contextAssemble`. | `pnpm vantadb:check` · `pnpm verify:all` · CI (job `verify`, bloqueante). | exit 0 = los 20 miembros resuelven dentro del repo. |
| `verify-real-binding.mjs` | **Prueba que el binding de VantaDB es el REAL** (no el stub no-op): resuelve el paquete, exige un binario `.node` > 1 MB, la API `VantaDb.connect` y (por defecto) un round-trip real sobre disco. | CI: job `verify` (`--shallow`) y job `integration-real-db` (round-trip). | exit 0 = binding real verificado · exit 1 = es un stub o no carga. |
| `audit-extraction-gates.mjs` | Gate de coherencia de las fichas de extracción ↔ backlog. Además (A5-S3) comprueba que **cada fila `✅ Completada` cite un caller de producción REAL**: `archivo:línea` que existe, bajo `packages/`/`apps/`, y cuya línea no sea sólo un comentario. `--root <dir>` permite auditar un fixture. | `pnpm audit:extraction` · `pnpm audit:extraction:test`. | exit 0 = coherentes y con callers verificables. |
| `test-audit-extraction-gates.mjs` | **Test del gate anterior** (TDD): 3 casos con fixture — caller inexistente → falla · caller real → pasa · caller que es un comentario → falla. | `pnpm audit:extraction:test`. | exit 0 = 3/3. |
| `audit-security.mjs` | Gate de advisories: parsea `pnpm audit --json`; **falla con cualquier CRITICAL** y con cualquier HIGH que no esté en su `ALLOWLIST` (cada entrada exige justificación escrita). | CI, job `security` (bloqueante). Local: `pnpm audit:security`. | exit 0 + "0 críticos y 0 altos sin justificar". |
| `verify-vantadb-ids.mjs` | Gate de **trazabilidad de los IDs del registro canónico de VantaDB** (`docs/VANTADB-FEEDBACK-Y-MEJORAS.md`): toda referencia `VDB-XXX-NN` del código debe existir en el registro, y el registro debe ser coherente (índice↔detalle, descripciones, secciones mínimas). Es el gate mecánico del guardrail de `AGENTS.md` §4 ("Prohibición de Workarounds Silenciosos"). | CI, job `verify` (step "Trazabilidad de IDs de VantaDB"), **no bloqueante** mientras el registro no cuadre (`continue-on-error` + `::warning::`). Local: `node scripts/verify-vantadb-ids.mjs`. | exit 0 + "todas las referencias cuadran". Con desalineación → exit 1 con fichero:línea de cada problema. `--json` para el job; `--strict` hace que los avisos también bloqueen; `--root <dir>` audita otro árbol (fixtures). |
| `audit-debt.mjs` | Mide la deuda técnica: `any`, `catch {}` vacío, I/O síncrono, `disable` huérfanos, `transition-all`, hex hardcodeados, god files y skips (producción vs test). | CI, job `debt` (informativo, publica `debt-report.json`). Local: `pnpm audit:debt`. | exit 0 siempre (job informativo). `--baseline <f>` + `--fail-on-regression` lo convierte en gate. |
| `verify-paths.mjs` | Integridad de rutas: ninguna ruta trackeada ni sin trackear puede contener un carácter que Windows no admite en un nombre de fichero (ni caracteres de control, ni nombres que empiecen por `{`, que son el patrón que hepatitis de un redireccionamiento mal citado). | Local / CI. | exit 0 si todas las rutas son válidas; exit 1 con la ruta exacta. |
| `inventory-tautological-tests.mjs` | Inventario de tests que afirman sobre **texto de fuente** (`readFileSync` + `expect(...).toContain/toMatch`), clasificado por zona de propiedad. | Manual (auditoría). Local: `node scripts/inventory-tautological-tests.mjs`. | exit 0 + tabla por fichero. |
| `audit-extraction-gates.mjs` | Gate mecánico del **catálogo de extracción** (`docs/extractions/` + `docs/review/`): comprueba que la ficha y el backlog de cada repo compartan el mismo conjunto de IDs, que cada fila cierre en uno de los 4 estados canónicos (0 filas en el limbo), que los IDs sean contiguos y que el recuento declarado coincida con las filas reales. | Manual / CI. Local: `node scripts/audit-extraction-gates.mjs`. | exit 0 + "0 filas en el limbo, recuentos y estados coherentes". Con discrepancias → exit 1 con el repo, el ID y los estados enfrentados. |
| `verify-backlog-gates.mjs` | Gate de **coherencia de la matriz de compuertas** de `docs/roadmap/Backlog.md` con el catálogo canónico (`docs/review/backlog-*.md`): cada fila de compuerta debe citar un ID existente y su token de estado inicial debe coincidir con el canónico. | Manual / CI. Local: `node scripts/verify-backlog-gates.mjs`. | exit 0 + "coincide con el catálogo canónico". Con discrepancias → exit 1 con `ID: Backlog=… · catálogo=…`. |
| `sync-backlog-gates.mjs` | Sincronizador de la matriz de compuertas: renumera las filas a la numeración canónica de la ficha y ajusta la columna "Estado" al estado real de evidencia (el criterio "estado = evidencia, no memoria" de la auditoría del 2026-10-19), conservando las anotaciones entre paréntesis. | Manual (tras una revisión de fichas). Local: `node scripts/sync-backlog-gates.mjs`. | exit 0 + nº de filas renumeradas y de estados sincronizados. |
| `sync-extraction-indexes.mjs` | Reconstruye los bloques del catálogo en los tres índices canónicos (`docs/extractions/README.md` §3 y §4.1, `docs/review/README.md`, `docs/roadmap/Backlog.md`) desde una única fuente de verdad, para que los recuentos del índice no se desincronicen del catálogo real. | Manual (tras una revisión de fichas). Local: `node scripts/sync-extraction-indexes.mjs`. | exit 0 + "índices reconstruidos: N repos · M tareas". |
| `insert-phase-gates.mjs` | Inyecta en las 12 **matrices de compuertas por fase** de `docs/roadmap/Backlog.md` las compuertas del catálogo que falten, derivando la fase de los IDs de tarea de cada fila (`Relaciones Ego` y dependencias). Resuelve el alias `backlog-hermes.md` → ficha `hermes-agent.md`. | Manual (tras una revisión de fichas). Local: `node scripts/insert-phase-gates.mjs [--dry-run]`. | exit 0 + nº de filas insertadas por fase y lista de compuertas sin fase asignable. |
| `ensure-fresh-dist.cjs` | Gate `pretest` de frescura de `dist/` (HIG-02): reconstruye los paquetes obsoletos en **orden topológico** (Kahn) y con **lock de archivo** (varios `pretest` corren en paralelo). Cubre paquetes JS (`packages/avatar`). | `pretest` de `apps/desktop` y de `tests`. | exit 0 + "TODOS LOS DIST AL DIA". Si un build falla → exit 1 (fail-closed: los tests NO se ejecutan contra un `dist/` obsoleto). |
| `generate-checksums.cjs` | Genera `SHASUMS.txt` (sha256) de los artefactos de distribución. | Cableado al script `dist` raíz. | exit 0 + "N artefacto(s) → SHASUMS.txt". |
| `prepare-vantadb-tarball.mjs` | Empaqueta `vantadb-node` y calcula su `integrity` sha512; emite el diff exacto para eliminar la dependencia `file:` fuera del repo. | Manual (owner). | exit 0 + tarball + `integrity` + diff a aplicar. |
| `release/sign.mjs` | SPEC fail-closed de firma de código (DIST-04, BLOQUEO owner). | Manual. | **exit 2** siempre: imprime el bloqueo. No firma nada. |

## Utilidades de soporte (no son gates)

| Script | Qué hace | Cuándo corre | Salida esperada |
|---|---|---|---|
| `telemetry-sink.mjs` | Sink de disco **rotado** (JSONL) para telemetría. Interfaz para inyectar en `packages/events` (handoff A2). | Cuando el main process lo inyecte (pendiente, A2). | Escrituras append; rotación al superar `maxBytes`. |
| `export-telemetry.mjs` | Agrega la telemetría (p50/p90/p99, cumplimiento del presupuesto de 150 ms, % con `correlationId`) y la exporta a JSON. | Manual o en un job futuro. | exit 0 + resumen. exit 2 si el directorio de telemetría no existe. |
| `correlation.mjs` | Helper de `correlationId` (derivado y determinista) para `packages/events` / `packages/decision` (handoff A2). | Cuando el runtime lo use (pendiente, A2). | id opaco de 32 hex; el mismo (padre, span) da siempre el mismo id. |
| `fix-md-headings.mjs` | Normaliza los encabezados de un markdown al estilo `atx_closed` que exige `.markdownlint.json` (MD003). | Manual, antes de pasar `docs-lint`. | exit 0 + nº de encabezados normalizados. Idempotente. |
| `fix-md-fences.mjs` | Pone lenguaje a los bloques de código (MD040), deja líneas en blanco alrededor (MD031) y colapsa blancos consecutivos (MD012). | Manual, antes de pasar `docs-lint`. | exit 0 + nº de ajustes. Idempotente. |
| `fix_links.py` | Repara `](docs/...)` relativos-a-raíz en `docs/` (C10). | Manual. | `python scripts/fix_links.py [--check]`. |
| `ingest/bulk_import.py` | Sidecar de ingesta masiva vía stdio JSONL. | Invocado por `packages/knowledge/src/ingest/PythonSidecarBridge.ts`. | JSONL por stdout. |

## Mantenidos (otros)

| Script | Referencias vivas |
|---|---|
| `ensure-fresh-dist.cjs` | Gate `pretest` de frescura de `dist/` (HIG-02). Orden **topológico** (Kahn) + cobertura de paquetes JS (`packages/avatar`) + **lock de archivo** (varios `pretest` en paralelo). API: `isStale`, `findStalePackages`, `sourceFiles`, `newestMtimeMs`, `buildOrder`. |
| `generate-checksums.cjs` | Genera `SHASUMS.txt` (sha256) de los artefactos. **Cableado** al script `dist` raíz. Uso: `node scripts/generate-checksums.cjs [dir]`. |
| `release/sign.mjs` | SPEC fail-closed de firma de código (DIST-04, BLOQUEO owner): imprime el bloqueo y sale con `exit 2`. No firma nada. |
| `verify-ci-triggers.mjs` | **Gate T1**: comprueba que cada workflow tenga un trigger alcanzable en la rama real del repo. `--ref <git-ref>` reproduce otro estado. |
| `verify-harness.mjs` | **Gate T11**: frontmatter válido de `.opencode/agents/*.md` + sin drift con `.agents/` + paridad de comandos + anti-stale de refs en `AGENTS.md`. Cross-platform (Node puro). |
| `audit-security.mjs` | **Gate T3 (bloqueante en CI)**: parsea `pnpm audit --json`; falla con críticos o altos sin justificación en su `ALLOWLIST`. `--report <file>` deja el JSON. |
| `audit-debt.mjs` | **T9**: mide `any`, `catch {}`, I/O síncrono, `disable` huérfanos, `transition-all`, hex, god files y skips (prod vs test). `--write-baseline` / `--baseline` / `--fail-on-regression`. |
| `inventory-tautological-tests.mjs` | **T8**: inventario de tests que afirman sobre TEXTO DE FUENTE (`readFileSync` + `expect(...).toContain/toMatch`), clasificado por zona de propiedad. |
| `telemetry-sink.mjs` | **T10**: sink de disco rotado (JSONL) para telemetría. Interfaz para inyectar en `packages/events` (handoff A2). |
| `export-telemetry.mjs` | **T10**: agregador/exportador de telemetría (p50/p90/p99, cumplimiento del presupuesto de 150 ms, % con `correlationId`). |
| `correlation.mjs` | **T10**: helper de `correlationId` (nuevo, derivado y determinista) para `packages/events` / `packages/decision` (handoff A2). |
| `prepare-vantadb-tarball.mjs` | **T7/B6**: empaqueta `vantadb-node` y emite el diff exacto para eliminar la dependencia `file:` fuera del repo. Flujo completo abajo. |
| `check-docs-lint.mjs` | **B4**: gate de markdownlint con **línea base** (`scripts/docs-lint-baseline.json`). Falla sólo ante violaciones NUEVAS (el corpus arrastra **7 131** preexistentes en 336 ficheros). `--write-baseline` regenera la base. Ver §"El gate de markdownlint: línea base y convención". |
| `preflight-disk.mjs` | **T2 (Ola 3)**: preflight de disco de la suite. Ver §"El preflight de disco". |
| `verify-real-binding.mjs` | **EGO-FIND-64 (Ola 3)**: prueba que el binding de VantaDB instalado es el real. Ver §"El binding de VantaDB en CI: real, no stub". |
| `fix-md-linter-driven.mjs` | **T1 (Ola 3)**: corrige MD032 (blancos alrededor de listas) y MD037 (espacio dentro de énfasis) **guiado por el informe del linter**, no por heurísticas. Sólo inserta blancos y quita espacios intra-énfasis; nunca borra texto. Idempotente. |
| `fix-md-headings.mjs` | **B4**: normaliza los encabezados de un markdown al estilo `atx` que exige `.markdownlint.json` (MD003). Idempotente. |
| `fix-md-fences.mjs` | **B4**: pone lenguaje a los bloques de código (MD040), deja líneas en blanco alrededor (MD031) y colapsa blancos consecutivos (MD012). Idempotente. |
| `verify-vantadb-ids.mjs` | **Ola 1c**: gate de trazabilidad de los IDs de VantaDB (guardrail de `AGENTS.md` §4). Ver la tabla de puertas arriba. |

## El preflight de disco (T2, Ola 3)

`pnpm test` **no arranca la suite sin comprobar el disco antes**. El primer paso
del script raíz `test` es `node scripts/preflight-disk.mjs`.

### Por qué

La suite completa falló con `IO error: Disk full` dentro de `@ego/memory`: un
test que **no tiene nada que ver con el disco**. La causa es que
`NativeVantaDB.connect()` **pre-reserva 320 MB por store**, aunque esté vacío.
Medido con el binding real:

| Fichero del store | Tamaño |
|---|---:|
| `vstore_L0.vanta` … `vstore_L3.vanta` | 4 × 64 MB |
| `0.jnl` (journal) | 64 MB |
| **Total por store** | **320 MB** |

### El presupuesto (medido, no estimado)

Un muestreador de disco corriendo **en paralelo** a `pnpm test` (740 muestras
cada 2 s durante 1 501 s, 2026-10-21) midió:

| Métrica | Valor |
|---|---:|
| Stores de VantaDB **simultáneos** en el pico | **10** |
| Caída de espacio libre observada | 22,96 GB → **19,57 GB** (−3,39 GB) |
| Presupuesto aplicado | pico (10 × 320 MB = 3,13 GB) × **3** de seguridad + **5 GB** de margen = **14,38 GB** |

> El factor 3 cubre: máquinas con más CPUs (más paquetes en paralelo), una
> fuga que vuelva a aparecer, y corridas solapadas.
>
> **Contexto**: antes de que A3/A4 arreglaran la fuga (T-X1) el pico era
> **~19 GB** (cada paquete dejaba su store de 320 MB sin limpiar). Con la fuga
> corregida, el pico es 3,2 GB. El presupuesto del preflight cubre el caso
> **peor**: si la fuga vuelve, el gate salta **antes** de que un test ajeno
> falle con "Disk full".

### Qué hace

1. **Limpia** los restos de test de `%TEMP%`: patrones `ego-*`, `vdb-*`,
   `ego-scratch`, `ego-test-scratch`, `tmp*`, `vanta-cog-ckpt*`, `a7-*`, con
   **tres** condiciones: casa con el patrón, su último write es de hace **más
   de 1 h**, y si el nombre lleva PID, **ese proceso no existe** → nunca se
   toca el store de un proceso vivo.
2. **Comprueba** el espacio libre contra el presupuesto. Si no hay margen,
   **falla rápido** con un mensaje accionable (cuánta GB faltan, por qué cada
   store reserva 320 MB, y tres formas de liberarlo).

### Verificado

| Escenario | Resultado |
|---|---|
| Disco sano (22,4 GB libres) | exit **0** en 1 s, limpia 2 restos obsoletos |
| Disco simulado lleno (`EGO_DISK_BUDGET_GB=40`) | exit **1** en **1,1 s** con el mensaje (antes: ~15 min hasta "Disk full" en un test ajeno) |

```bash
pnpm disk:check          # comprobar (y limpiar)
pnpm disk:check:json     # informe machine
pnpm disk:clean          # sólo limpiar
```

## La mina de resolución de `vantadb` (EGO-FIND-16, Ola 5)

`vantadb` sólo estaba declarado en `packages/memory`. Los demás miembros del
workspace (`apps/desktop`, `tests` y cualquier paquete futuro) **resolvían
fuera del repo**, al `node_modules` **global** del usuario
(`C:\Users\Eros\node_modules\vantadb` = **0.6.1**, tres menores por detrás y
**sin `vantadb-node`**) → el import lanzaba `VANTADB_NOT_FOUND: Node not found: 7`
y un agente llegó a la conclusión **falsa** de que `contextAssemble()` no existía.

**Cómo queda resuelto:**

1. `vantadb: 0.9.0` declarado como dependencia **directa** en `apps/desktop` y
   `tests` (declara lo que usa).
2. `vantadb: 0.9.0` y `vantadb-node: 0.9.0` como **devDependencies de la raíz**
   del workspace → pnpm las enlaza en el `node_modules` raíz y **cualquier**
   miembro las resuelve por **resolución ascendente**: siempre la versión
   **fijada dentro del repo**, nunca la global.
3. La puerta `scripts/verify-vantadb-resolution.mjs` (`pnpm vantadb:check`,
   **bloqueante en CI**) verifica desde los 20 miembros: ruta dentro del repo ·
   versión fijada · `contextAssemble` en el **tipo** del binding.

> **Por qué NO un `.npmrc` con `public-hoist-pattern[]=vantadb*`**: cambia la
> configuración de layout de pnpm → **purga `node_modules` entero**. En Windows
> ese purge es inviable con otros agentes vivos: cada binario nativo
> reimportado (esbuild, rollup, lightningcss, tailwindcss-oxide) falla con
> `ERR_PNPM_EPERM` porque **Defender escanea el fichero recién escrito** en el
> instante en que pnpm intenta desenlazarlo. El devDependency de la raíz da la
> **misma garantía** sin purgar el árbol.

## La pre-reserva de 320 MB por store (VDB-REQ-14, pendiente de A1)

`NativeVantaDB.connect()` **pre-reserva 320 MB por store** aunque esté vacío
(4 × `vstore_L*.vanta` de 64 MB + `0.jnl` de 64 MB) y **no es parametrizable**
(`ConnectOptions` sólo expone `read_only` y `memory_limit`). Con 10 stores
simultáneos (el pico medido de la suite) son 3,2 GB; antes del arreglo de la fuga
(T-X1) eran ~19 GB → el disco se agotaba y los tests fallaban con
`IO error: Disk full` en ficheros ajenos. **Es la petición upstream más
urgente**: afecta al 100 % del estado persistente del producto.

## El binding de VantaDB en CI: real, no stub (EGO-FIND-64, Ola 3)

`vantadb-node@0.9.0` está **publicado en npm** (Apache-2.0) con binarios
precompilados para las 6 plataformas (`linux-x64-gnu`, `linux-x64-musl`,
`linux-arm64-gnu`, `linux-arm64-musl`, `darwin-x64`, `darwin-arm64`,
`win32-x64-msvc`) y **sin script de compilación** → `pnpm install` lo instala
en cualquier runner.

**Lo que se eliminó** (4 pasos de stub + checkout + toolchain Rust + build napi):

| Antes | Ahora |
|---|---|
| `verify`, `e2e-electron`, `gui`, `visual` instalaban un stub no-op (`put(){}` / `get(){return null}`) → **el pipeline estaba verde sin tocar VantaDB** | `pnpm install` baja el paquete publicado |
| `integration-real-db` hacía checkout de `ness-e/Vantadb` + Rust + `napi build` | instala el paquete del registry (sin toolchain) |

**Lo que se añadió** — `scripts/verify-real-binding.mjs`, un gate que **prueba**
que el binding instalado es el real:

1. `vantadb-node` resuelve al paquete publicado;
2. trae un binario `.node` de **> 1 MB** (un stub pesa KB);
3. exporta `VantaDb.connect` (la API que usa `vantadb/native`);
4. (por defecto) **round-trip real sobre disco**: connect → put → get → close.

En CI corre en dos sitios: `verify` (`--shallow`, sin disco) e
`integration-real-db` (round-trip completo).

> **Los manifiestos** `apps/desktop/package.json` y `packages/memory/package.json`
> ya no declaran `file:../../../VantaDB/vantadb-node`: declaran
> `vantadb-node: 0.9.0` (publicado) y `vantadb: 0.9.0`. El repo **ya no
> necesita un checkout hermano** para instalar.

## El gate de markdownlint: línea base y convención

### Qué es la línea base

`scripts/check-docs-lint.mjs` es un gate **de regresión**: la línea base
(`scripts/docs-lint-baseline.json`) congela el recuento de violaciones por
fichero y regla, y el gate falla **sólo** ante violaciones nuevas. Sin ella el
gate estaría rojo desde el día 1 (el gate se añadió después del corpus) y nadie
lo miraría — es el mismo patrón que `scripts/audit-debt.mjs --baseline`.

### La convención (`.markdownlint.json`) — ajustada el 2026-10-20 (Ola 2)

La convención anterior (`MD003: atx_closed` + `MD013: 120 chars`) **no la
cumplía nadie**: el 100% de los agentes escribe ATX plano (`## Título`), y el
corpus tiene p90 = 189 chars por línea. Una regla que el 100% del corpus
incumple no da señal: sólo infla la base. Medido sobre un **snapshot
congelado** del corpus (para que la comparación no se contamine con ficheros
que se escriben mientras se mide):

| Variante | Violaciones | Ficheros | MD003 | MD013 |
|---|---:|---:|---:|---:|
| A) `atx_closed` + 120 chars (la de antes) | 11 683 | 283 | 3 430 | 4 697 |
| B) `atx` + 120 chars | 9 676 | 348 | 1 423 | 4 697 |
| C) `atx` + 200 chars | 7 128 | 333 | 1 423 | 2 149 |
| D) C) + `code_blocks: false` | 7 084 | 333 | 1 423 | 2 105 |

**Decisión: variante C** (`MD003: atx`, `MD013: 200 chars` con `tables: false`).

- `MD003 → atx`: se pasa de 3 430 violaciones toleradas a 1 423, y la regla pasa
  a detectar lo que sí es un defecto real (mezcla de estilos ATX/setext).
- `MD013 → 200 chars` (las tablas ya estaban excluidas): de 4 697 a 2 149. Se
  midió también `code_blocks: false` (D): sólo resta 44 → **no se aplica**, no
  compensa.
- **Resultado: 11 668 → 7 125 violaciones toleradas (−39%)**, y la cobertura
  **sube** de 282 a 333 ficheros vigilados por la base.
- Lo que NO se toca: MD056 (tablas mal formadas), MD032/MD022 (blancos), MD040
  (fences sin lenguaje), MD047, MD031… siguen siendo reglas que el gate exige.

### El quirk del `--ignore-path` (corregido el 2026-10-20)

`markdownlint-cli2 --ignore-path <fichero>` **incluye ese mismo fichero en el
conjunto a lintar**, aunque el glob no lo mencione (probado: *"Linting: 2
file(s)"* con `--ignore-path` frente a *"Linting: 1 file(s)"* sin él). Como el
ignore del gate es `.gitignore` —cuyos comentarios `# …` markdownlint lee como
encabezados ATX— el gate estaba lintando **`.gitignore` como si fuera
markdown**: **43 violaciones espurias** y un fichero fantasma en la base.

El parseo (`parseViolations`) descarta ahora el fichero de exclusiones. Se
mantiene `.gitignore` como **única** fuente de verdad de las exclusiones
(`docs/.vitepress/dist/`, carpetas `archive`, …) en vez de duplicar esos
patrones en un `.markdownlint-cli2.jsonc` propio, que se desincronizaría.

### Prueba de que la base sigue detectando

Crear un fichero con una violación MD013 deliberada → el gate **falla**
(exit 1) y lo nombra; al revertirlo, el gate vuelve a **verde** (exit 0).
Verificado el 2026-10-20 con `docs/_a7-redtest-probe.md` (ya borrado).

## El corpus de atribución MIT NO se lintea (decisión de la Ola 2)

`.oxlintrc.json` excluye dos árboles con `ignorePatterns`:

```json
"ignorePatterns": [
  "packages/avatar/vendor/**",
  "apps/desktop/renderer/floating/vendor/**"
]
```

**Por qué** (es una decisión de alcance del lint, NO un `eslint-disable` por fichero,
que sería ocultamiento de deuda):

1. `packages/avatar/vendor/{agent-robot-avatar,coucou,coucou-swift}` y
   `apps/desktop/renderer/floating/vendor/avatar/vendor/**` son **material legal de
   terceros con licencia MIT**: no se pueden modificar (el corpus existe para que la
   atribución sea resoluble *tal cual*) y sus avisos **no son deuda de Ego**.
2. `apps/desktop/renderer/floating/vendor/avatar/{core,render,runtime,studio}` es el
   **espejo byte-idéntico** de `packages/avatar/src` (verificado por SHA-256): lintarlo
   cuenta **dos veces** la misma deuda. Su integridad la garantiza la puerta
   `pnpm --filter @ego/avatar sync:check` (SHA-256), que es el instrumento correcto
   para un espejo.
3. Medido: la exclusión quita **46 avisos** (481 → 435 en la misma medición A/B).

**Coherencia del corpus (verificada en la Ola 2):**

| Puerta | Estado del corpus |
|---|---|
| Typecheck | **Excluido**: el `tsconfig.json` del renderer lo excluye (`floating/vendor/avatar/vendor`) y el de `packages/avatar` sólo incluye `src/**` |
| Lint | **Excluido** (esta decisión) |
| Empaquetado | **Excluido**: `verify-dist.cjs` comprueba que *"el corpus legal NO está en el árbol de runtime del renderer"* |
| Atribución | **Resoluble**: `pnpm --filter @ego/avatar attribution:check` → *"CADENA MIT RESOLUBLE"* (exit 0) |
| Rutas | **Válidas**: `node scripts/verify-paths.mjs` → exit 0 |

> **Nota de mantenimiento:** `ignorePatterns` usa patrones *enrutados al repositorio*
> (glob-style, relativos a la raíz donde vive `.oxlintrc.json`). Si algún día apareciera
> un `vendor/` legítimo con código **nuestro**, no quedaría lintado: en ese caso hay que
> añadir una excepción explícita, no ampliar el patrón.

## Estado de las solicitudes abiertas (Ola 2)

### `EGO-FIND-81` — contrato de obtención del token del MCP Server (BLOQUEO owner)

**Lo verificado por A7 (Ola 2, sólo lectura — `apps/desktop/src/main/mcp/` es zona de A4):**

| Hecho | Evidencia |
|---|---|
| El servidor MCP de Ego expone un **puerto efímero** | `mcp-server-runtime.ts:154` → `port: 0` (lo asigna el SO en cada arranque) |
| El **token bearer es obligatorio** y se genera al arrancar | 32 bytes aleatorios (`randomBytes(32)`, base64url) |
| El token vive en el **keychain del SO**, no en disco ni en variables | `MCP_SERVER_TOKEN_SERVICE = "mcp"` / `MCP_SERVER_TOKEN_ACCOUNT = "ego-mcp-server"` vía `CredentialManager` |
| El token **nunca se expone al renderer** ni aparece en la URL | cabecera del propio módulo: *"Nunca se expone al renderer ni aparece en la URL"* |
| **El runtime no emite NADA por IPC** | `mcp-server-runtime.ts` no contiene ni `ipcMain` ni `webContents.send` → el puerto efímero no cruza al renderer por ningún canal |
| **`preload.ts` no expone puerto ni token** | `apps/desktop/src/preload.ts` no declara ningún campo `port`; el único `token` que aparece es el **de canje de selección de carpeta** (`ipc.projects.selectFolderRedeem`, opaco, TTL 60 s, canjeado en main) — **sin relación con el MCP** |
| Los tipos MCP del preload son de **servidores EXTERNOS** | `McpServerConfigSchema` (`id`, `name`, `transport`, `command`, `args`, `env`, `cwd`, `url`, `headers`): es la config de los MCP que el usuario añade, no la del servidor de Ego |
| Al cerrar el servidor, el token **se revoca** | `close()` cierra el listener **y** revoca el token; idempotente |

**Verificación re-hecha el 2026-10-20 (Ola 2, T3)**: `preload.ts` +
`mcp-server-runtime.ts` + `apps/desktop/src/ipc/` → **no hay ningún canal que
exponga el puerto ni el token al renderer**. **No hay handoff a A4**: no hay
filtración que corregir.

**Lo que falta (decisión del owner, NO la toma A7):** el **canal definitivo** por el que un
cliente MCP externo obtiene (a) el puerto efímero y (b) el token. Candidatos: fichero de
descubrimiento en el app-data con permisos restringidos, o entrega manual por canal seguro.
Hasta que el owner lo fije, el descubrimiento del puerto **no se publica** en ningún sitio
público: sólo vive en el handle del proceso main.

### `EGO-FIND-64` — binding `vantadb-node` fuera del repo — **RESUELTO en la Ola 3**

**Ya no está bloqueado**: `vantadb-node@0.9.0` está publicado en npm
(Apache-2.0) con binarios precompilados para todas las plataformas.

- `apps/desktop` y `packages/memory` declaran **`vantadb-node: 0.9.0`** (el
  paquete publicado) y `packages/memory` declara **`vantadb: 0.9.0`** — ya no
  hay dependencia `file:` fuera del repo: `pnpm install --frozen-lockfile` es
  **reproducible para quien clonea**.
- El **tarball no se versiona** (decisión de arquitectura): `*.tgz` y
  `vendor/vantadb-node/` están en `.gitignore`.
- **CI ya ejercita el binding real**: se eliminaron los 4 stubs no-op y el
  build napi con Rust; el gate `scripts/verify-real-binding.mjs` prueba que lo
  instalado es el binding real (binario nativo + round-trip). Ver §"El binding
  de VantaDB en CI: real, no stub".
- Verificado en local: `node scripts/verify-real-binding.mjs` → exit 0
  (0.9.0, binario de 6,56 MB, round-trip `connect → put → get → close` OK) y
  `@ego/memory` → **24 ficheros / 153 tests en verde** con el paquete publicado.

### `EGO-FIND-23` — override de `electron` (YA RESUELTO)

El override `electron` de la raíz **ya no existe** (eliminado en la Ola 1d) y
`apps/desktop/package.json` declara `electron: ^41.10.7` directamente → coherente con D1
("subir Electron **sin** `pnpm.overrides` para congelarlo"). Estado verificado: `pnpm audit`
→ **0 críticos / 0 altos** y `pnpm install --frozen-lockfile` → exit 0.

## Flujo del binding `vantadb-node` (B6 / DIST-09, BLOQUEADO por el owner)

`apps/desktop` y `packages/memory` declaran hoy
`"vantadb-node": "file:../../../VantaDB/vantadb-node"` → una dependencia que
apunta **fuera del repo**: `pnpm install --frozen-lockfile` no es reproducible
para quien clonea, y CI compila un stub no-op.

**Decisión de arquitectura (Ola 1b): el tarball NO se versiona.** Es un
artefacto de build de una dependencia externa (`ness-e/Vantadb`), y versionar
binarios de terceros en el repo es peor que no tenerlos. Los patrones `*.tgz` y
`vendor/vantadb-node/` están en `.gitignore`.

**Flujo completo:**

1. **Preparar** (con un checkout de `ness-e/Vantadb` al lado del repo):

   ```bash
   node scripts/prepare-vantadb-tarball.mjs \
     --source "C:/ruta/a/VantaDB/vantadb-node"
   ```

   La ruta de salida se **deriva de la versión real del paquete fuente**
   (`vantadb-node-<versión>.tgz`): hoy el checkout va por **0.9.0** mientras el
   repo declara `vantadb: 0.8.0`. Con `--out` explícito manda el operador.
   El script imprime el `integrity` sha512 que pnpm escribirá en el lockfile.

   > **Antes de publicar (owner):** la versión del paquete publicado y la que
   > fijen `packages/memory` + `apps/desktop` deben **coincidir** con la del
   > `vantadb` que usa el repo (hoy 0.8.0). Publicar 0.9.0 sin subir el resto
   > deja el lockfile apuntando a dos versiones distintas de VantaDB.

2. **Instalar localmente** con el tarball (los `package.json` de
   `packages/memory` y `apps/desktop` deben apuntar a él — zona de A2/A4):

   ```json
   "vantadb-node": "file:../../vendor/vantadb-node/vantadb-node-0.8.0.tgz"
   ```

   El `vendor/` local queda fuera de git por `.gitignore`; en CI el binding se
   compila por plataforma (jobs `integration-real-db` / `nightly` / `smoke-native`).

3. **Publicar** el paquete en npm (`vantadb-node@0.8.0`) → el `package.json`
   pasa a `"vantadb-node": "^0.8.0"` (o el tag exacto) y desaparece el `file:`.

   **DIST-09 sigue ABIERTO y bloqueado por el owner** (publicación + tag de
   release). Hasta entonces, los 3 workflows que compilan el binding para
   linux/macos siguen necesitando el checkout hermano.

**Verificación del ABI (obligatoria tras cualquier salto de Electron):**

```bash
ELECTRON_RUN_AS_NODE=1 pnpm --filter @ego/desktop exec electron \
  scripts/smoke-native-packaged.cjs --require-electron
```

Con Electron 41.10.7 (node 24.18.0) el binding napi-rs carga con
`NODE_MODULE_VERSION=145` y el roundtrip put/get es idéntico → el binding es
**N-API estable** y el salto de Electron 33 → 41 no rompe la ABI.

## Comandos raíz relacionados

| Script raíz | Qué hace |
|---|---|
| `pnpm lint` | oxlint sobre `apps packages tests scripts eval` con `--max-warnings 296` (ratchet) + `pnpm typecheck`. El corpus de atribución MIT está **excluido** por `ignorePatterns` en `.oxlintrc.json` (ver §"El corpus de atribución MIT NO se lintea"). |
| `pnpm test` | `pnpm -r exec vitest run --test-timeout=10000` (paquetes vitest) + `@ego/avatar` (`node --test`) + `@ego/gui-tests` (gate estático). |
| `pnpm audit:security` | Gate de advisories (local, mismo criterio que CI). |
| `pnpm audit:debt` | Línea base de deuda técnica. |
| `pnpm docs:lint` | Gate de markdownlint con línea base (B4). |
| `pnpm docs:lint:baseline` | Regenera la línea base de markdownlint. |
| `pnpm verify:all` | Triggers de CI + salud del rack de agentes. |
| `pnpm telemetry:export` | Exporta/resume la telemetría de `logs/telemetry`. |

## Archivados (one-offs, sin referencias vivas)

| Script | Origen probable |
|---|---|
| `adapt_opencode.py` | Migración puntual de formato opencode (jul-2026). |
| `extract_docx.py` | Extracción puntual de DOCX a texto (may-2026). |
| `freeze_prd_07_11.py` | Congelado puntual de PRD (may-2026). |
| `generate_review_tracker.py` | Generó `docs/ego-review-tracker.html` (jul-2026). Solo referenciado por `update_tracker_arch.py` (también archivado). |
| `integrate_overview_sections.py` | Integración puntual de secciones overview (may-2026). |
| `scaffold_docs.py` | Andamiaje inicial de docs (jul-2026). |
| `split_prd.py` | División puntual de PRD (may-2026). |
| `update_tracker_arch.py` | Actualización puntual del tracker (may-2026). |

Regla: antes de archivar definitivamente (borrar) cualquiera de estos,
pedir decisión del owner. Prohibido añadirles dependientes nuevos.
