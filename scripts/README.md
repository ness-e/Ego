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
| `check-docs-lint.mjs` | Gate de markdownlint **con línea base**: falla sólo ante violaciones NUEVAS (el corpus arrastra ~11 400 preexistentes). | CI, job `docs-lint` (`pnpm docs:lint`). | exit 0 + "gate OK: ninguna violación nueva". `--write-baseline` recalibra. |
| `audit-security.mjs` | Gate de advisories: parsea `pnpm audit --json`; **falla con cualquier CRITICAL** y con cualquier HIGH que no esté en su `ALLOWLIST` (cada entrada exige justificación escrita). | CI, job `security` (bloqueante). Local: `pnpm audit:security`. | exit 0 + "0 críticos y 0 altos sin justificar". |
| `verify-vantadb-ids.mjs` | Gate de **trazabilidad de los IDs del registro canónico de VantaDB** (`docs/VANTADB-FEEDBACK-Y-MEJORAS.md`): toda referencia `VDB-XXX-NN` del código debe existir en el registro, y el registro debe ser coherente (índice↔detalle, descripciones, secciones mínimas). Es el gate mecánico del guardrail de `AGENTS.md` §4 ("Prohibición de Workarounds Silenciosos"). | CI, job `verify` (step "Trazabilidad de IDs de VantaDB"), **no bloqueante** mientras el registro no cuadre (`continue-on-error` + `::warning::`). Local: `node scripts/verify-vantadb-ids.mjs`. | exit 0 + "todas las referencias cuadran". Con desalineación → exit 1 con fichero:línea de cada problema. `--json` para el job; `--strict` hace que los avisos también bloqueen; `--root <dir>` audita otro árbol (fixtures). |
| `audit-debt.mjs` | Mide la deuda técnica: `any`, `catch {}` vacío, I/O síncrono, `disable` huérfanos, `transition-all`, hex hardcodeados, god files y skips (producción vs test). | CI, job `debt` (informativo, publica `debt-report.json`). Local: `pnpm audit:debt`. | exit 0 siempre (job informativo). `--baseline <f>` + `--fail-on-regression` lo convierte en gate. |
| `inventory-tautological-tests.mjs` | Inventario de tests que afirman sobre **texto de fuente** (`readFileSync` + `expect(...).toContain/toMatch`), clasificado por zona de propiedad. | Manual (auditoría). Local: `node scripts/inventory-tautological-tests.mjs`. | exit 0 + tabla por fichero. |
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
| `check-docs-lint.mjs` | **B4**: gate de markdownlint con **línea base** (`scripts/docs-lint-baseline.json`). Falla sólo ante violaciones NUEVAS (el corpus arrastra ~11 400 preexistentes). `--write-baseline` regenera la base. |
| `fix-md-headings.mjs` | **B4**: normaliza los encabezados de un markdown al estilo `atx_closed` que exige `.markdownlint.json` (MD003). Idempotente. |
| `fix-md-fences.mjs` | **B4**: pone lenguaje a los bloques de código (MD040), deja líneas en blanco alrededor (MD031) y colapsa blancos consecutivos (MD012). Idempotente. |
| `verify-vantadb-ids.mjs` | **Ola 1c**: gate de trazabilidad de los IDs de VantaDB (guardrail de `AGENTS.md` §4). Ver la tabla de puertas arriba. |

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
     --source "C:/ruta/a/VantaDB/vantadb-node" \
     --out "C:/ruta/a/VantaDB/vantadb-node-0.8.0.tgz"
   ```

   Imprime el `integrity` sha512 que pnpm escribirá en el lockfile.

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
| `pnpm lint` | oxlint sobre `apps packages tests scripts eval` con `--max-warnings 310` (ratchet) + `pnpm typecheck`. |
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
