# Contrato de ejecución — Ola 3 (Fase 02 + transversales) — 2026-10-20

> Ola 3 del plan `docs/agent-ops/plans/2026-10-19-remediation-wave1/VERDICT.md` §7.
> **Paralelismo dentro de la fase, secuencia entre fases** (`AGENTS.md` §6: una fase completa antes de la siguiente).
> Esta ola cierra **Fase 02** (E4, E6-res, E2-bis, EGO-FIND-64) + tres transversales que no dependen de fase.

## Por qué esta ola y no las 18 de golpe

El plan de la Ola 3 tiene 18 ítems ordenados por progresión de fases, y 4 con **bloqueo del owner** que ningún agente puede resolver (EGO-FIND-81 canal del token MCP · DIST-04 certificados · DIST-09 publicar `vantadb-node` · E3 binarios MCP firmados). Regla vigente: *"Ningún bloque marcado BLOQUEO OWNER avanza sin desbloqueo"*.

**Esta ola = Fase 02 completa + transversales.** Las olas siguientes (Fase 03 → 04 → 06 → 10 → 11 → 12) se lanzan al cerrar esta.

## Propiedad de ficheros (EXCLUSIVA, con 2 excepciones declaradas)

| Agente | ESCRIBE | NO toca |
|---|---|---|
| **A3** | `packages/tools/**`, `packages/recovery/**`, `packages/tasks/**`, `packages/subegos/**` | `apps/**`, `docs/**` (salvo su handoff), raíz, `scripts/**` |
| **A4** | `apps/desktop/src/**`, `apps/desktop/test/**`, `apps/desktop/renderer/**` (salvo `floating/vendor/avatar/**`) | `packages/**`, `docs/**`, raíz, `scripts/**` |
| **A7** | `scripts/**`, `.github/**`, `package.json` raíz, `pnpm-lock.yaml`, `.oxlintrc.json`, `.markdownlint.json`, `pnpm-workspace.yaml`, `.gitignore`, `.husky/**` · **excepción 1**: `apps/desktop/package.json` y `packages/memory/package.json` (para EGO-FIND-64) | resto de `packages/**`, resto de `apps/**`, `docs/**` |
| **A2** | `packages/{memory,knowledge,runtime,models,decision,execution,events,security,tool-call-repair}/**` · **excepción 2**: `docs/adr/0022-*.md` (ADR nuevo, nombre único) | `apps/**`, `docs/**` (salvo ese ADR y su handoff), raíz, `scripts/**` |
| **A1** | `docs/**` (salvo `docs/adr/0022-*` → A2), `AGENTS.md`, `CHANGELOG.md` | `packages/**`, `apps/**`, raíz, `scripts/**` |

**Excepciones**: A7 edita 2 manifiestos de otros (1 línea cada uno) y A2 crea 1 ADR con nombre único. Ambas están declaradas aquí para que no haya colisión.

## Handoff (mismo formato que la Ola 1)

`docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/<AGENTE>-ola3.md` con: cambios aplicados · **solicitudes fuera de zona con diff exacto** · verificación (comando + exit + resumen) · deuda abierta.

## Método (inalterable)

1. **TDD real**: test rojo primero, **demostrado** con su output pegado. Un test que codifica una deuda ya pagada es un test que hay que **actualizar su línea base** y añadirle guards (lección registrada).
2. **Objetivos medibles, no frases**: todo objetivo numérico se convierte en **gate de CI** que recorre el árbol de verdad.
3. **Nada de commits** — el orquestador commitea. Nada de `git checkout/reset/stash/clean`. Nada de `pnpm install` ( monopolio de A7).
4. **Workarounds de VantaDB** → registro canónico con ID referenciado en el código.
5. `RESULTADO` final: `{agente, status, archivos_modificados, hallazgos_resueltos, verify, solicitudes_handoff, deuda_abierta, SKILLS_CARGADAS}`. `PARTIAL` es legítimo si declara el bloqueo exacto.

## Tareas transversales (las 3, en paralelo)

- **T-X1 (A3 + A4)**: los tests dejan **320 MB por corrida** en `%TEMP%` (`ego-desktop-ipc-test-*`, `ego-sessions-resume-*`, `tmp*` de VantaDB) y no limpian al morir → el disco bajó al 2,5 %. Cada agente arregla **su zona**: teardown idempotente, resistant a la muerte del proceso, y limpieza por antigüedad al inicio de la siguiente corrida. **Verificable**: disco libre antes/después de una corrida completa, y 0 dirs huérfanos.
- **T-X2 (A1)**: normalizar las **15 entradas legacy** de `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` (22 avisos W3/W4/W5: falta `Estado:`, falta `Impacto en Ego:` con `archivo:línea`). Cada "Impacto" debe ser una **afirmación comprobable**, no relleno.
- **T-X3 (A2)**: **EGO-FIND-80** — contrastar la constraint del proveedor (`tool_result` en el orden de `tool_use`) contra la **doc oficial**, no solo contra el source del SDK. La doc está geobloqueada por región en este entorno → usa el skill `coordinated-web-search` y los MCP de búsqueda (`metasearch`, `argus`, `websearch`) para llegar a la **fuente primaria**. Si es absolutamente inaccesible, **documenta el intento con la evidencia del bloqueo** (URL, status, región) y deja la tarea abierta con dueño.

## Tareas de Fase 02

- **E4 (A3)** — exportadores de artefactos PDF/DOCX/XLSX/PPTX + REPL Python, **en TypeScript** (guardrail `AGENTS.md` §4: sin Python en el producto). Herramienta `export_artifact` + `python_repl`. **Requiere** ficha de extracción o ADR antes de codificar (§4 del contrato) → redáctala en tu handoff y propón el ADR a A1.
- **E6-res (A4)** — remate de `main.ts`: bloque del **tray** (~190 líneas) + 3 bloques cohesivos (~170) → módulos nuevos bajo `apps/desktop/src/main/`. Objetivo: `main.ts` **< 1 100 líneas** y **0 `let` globales**. Actualiza el gate `test/e6-runtime-state.test.ts` con los nuevos umbrales.
- **E2-bis (A2)** — la **puerta de invariantes** del ADR-0020: ¿el `contextAssemble()` nativo preserva el system prompt y los pares `tool_call`/`tool_result`? Si no → petición upstream `VDB-REQ-13`. Es el **pre-requisito** de E2 (Fase 06) → sin esto, E2 no puede empezar.
- **EGO-FIND-64 (A7)** — `vantadb-node` por `file:` fuera del repo → **tarball vendorizado** con hash. Los 2 manifiestos pasan al tarball; el lockfile se regenera; **CI debe ejercitar el binding real** (hoy compila un stub no-op y el job `verify` verde nunca toca VantaDB). **Aviso ya detectado**: el checkout hermano está en **0.9.0** y el repo declara **0.8.0** → alinea las versiones o documenta la discrepancia.

## Cierre de la ola

1. Los 5 agents entregan `handoff/<AGENTE>-ola3.md` + `RESULTADO`.
2. **Verificación global**: 17 checks (los de la Ola 2) + los nuevos gates de la Ola 3.
3. **A8** (no lanzado en esta ola) actualiza la matriz de 22 secciones y el VERDICT §7 al cerrar.
4. El orquestador commitea en commits atómicos por área y reconcilia la memoria del agente.
