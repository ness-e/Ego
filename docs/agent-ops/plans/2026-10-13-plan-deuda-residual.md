# Plan — Deuda residual + DIST-02..12 + vigilancia upstream

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Cerrar la deuda accionable (snapshots quarantine-aware, gate dist/, `any` en main, tsc en tests/), dejar DIST-02..12 ejecutables y la vigilancia upstream documentada.

**Architecture:** Higiene primero (estabiliza gates), luego seguridad restante, luego DIST en orden de progresión, upstream como vigilancia sin código.

**Tech Stack:** pnpm, TypeScript strict, vitest, Electron, VantaDB vía adapter.

**Decisiones HITL aplicadas (2026-10-13):** alcance = todo incl. upstream como vigilancia; orden = higiene primero; snapshots sí; dist-gate sí (rebuild pre-test).

**MCP por defecto:** `codegraph_explore`, `task_validate_scope`, `task_verify_cmd`, `check_index_coverage`. Skills: SDP al dispatch + fijadas por task. Taskfiles en DISCOVERY (`docs/agent-ops/tasks/<ID>.md`).

## Índice ejecutable (10 columnas canónicas)

| ID | Severidad | Hallazgo | Archivo:línea | Esfuerzo | Prioridad | Estado | Descripción | Relaciones | Dependencias |
|---|---|---|---|---|---|---|---|---|---|
| `HIG-01` | 🟡 Media | **Normalizar `tsc` en `tests/`** | `tests/` | 🟡 1-2d | 🔴 P0 | ⏳ En curso | Task file `docs/agent-ops/tasks/HIG-01.md` EN PROGRESO (T09 sync; el `Pendiente` anterior estaba obsoleto). 57 errores alegados pendientes de verificación con `tsc --noEmit -p tests/tsconfig.json` en Task 1. | Plan §Task 1 | — |
| `HIG-02` | 🟠 Alta | **Gate automático contra `dist/` obsoleto** | `apps/desktop/test/`, `packages/*/dist` | 🟢 1d | 🔴 P0 | ⏳ En curso | Task file `docs/agent-ops/tasks/HIG-02.md` EN PROGRESO (T09 sync). Gate obsoleto pendiente de cierre en Task 2. | Plan §Task 2 | — |
| `HIG-03` | 🟡 Media | **Eliminar 23 `any` en `main.ts`** | `apps/desktop/src/main.ts` | 🟡 1-2d | 🟠 P1 | ⏳ En curso | Task file `docs/agent-ops/tasks/HIG-03.md` IN PROGRESS (T09 sync). Narrowing + unknown. Ver Task 3. | Plan §Task 3 | — |
| `HIG-04` | 🔴 Crítica | **Lectura quarantine-aware en `system/snapshots`** | `packages/dailystate/DailyStatePersistence.ts` | 🟡 1-2d | 🔴 P0 | ✅ Completada | R9 reconciliado (T09): el código YA es quarantine-aware (`getSnapshot` resuelve live primero y `quarantine/pending` después vía `getQuarantineAware`, con comentario `HIG-04 / SEC-09` en el fuente) + task file `HIG-04.md` COMPLETED. Último diferimiento SEC-09 cerrado. | Plan §Task 4 | `SEC-09` |
| `HIG-05` | 🟢 Baja | **Verificar residuales M16 (path edge, audit ms)** | `packages/domains/src/engineering/` | 🟢 0.5d | 🟢 P2 | 🆕 Pendiente | Tests que fijan los edges o aceptación documentada. Ver Task 5. | Plan §Task 5 | `M16` |
| `UP-01` | 🟢 Baja | **Vigilancia upstream VantaDB** | `docs/engineering/vantadb-readiness-plan.md` | 🟢 0.5d | 🟢 P2 | 🆕 Pendiente | Verificar estado FIND-249 + REQ-04/05/06, documentar. Sin código. Ver Task 6. | Plan §Task 6 | — |
| `DIST-02` | 🔴 Crítica | **Configuración `asarUnpack`** | `apps/desktop/electron-builder.yml` | 🟢 2h | 🔴 P0 | 🆕 Pendiente | Ver Backlog + Task 7. | Plan §Task 7 | `DIST-01` |
| `DIST-03` | 🟠 Alta | **Instaladores multiplataforma (+ iconos + code-splitting)** | `apps/desktop/build/` | 🟡 2-3d | 🟠 P1 | 🆕 Pendiente | Incluye iconos dedicados y chunk 1.48MB→split. Ver Task 8. | Plan §Task 8 | `DIST-01` |
| `DIST-04` | 🔴 Crítica | **Firmado y notarización** | `scripts/release/sign.mjs` | 🟡 2-3d | 🟠 P1 | 🆕 Pendiente | Requiere certificados del owner. Ver Task 9. | Plan §Task 9 | `DIST-03` |
| `DIST-05` | 🟠 Alta | **Auto-Updater** | `apps/desktop/src/updater.ts` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | Ver Task 10. | Plan §Task 10 | `DIST-01` |
| `DIST-06` | 🔴 Crítica | **Clean Machine VM** | `docs/dev/desktop/CLEAN_MACHINE_TEST.md` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | Requiere VM limpia. Ver Task 11. | Plan §Task 11 | `DIST-03` |
| `DIST-07` | 🟡 Media | **Docs usuario final** | `docs/user/` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | Ver Task 12. | Plan §Task 12 | `DIST-03` |
| `DIST-08` | 🔴 Crítica | **Golden Path Beta** | `tests/e2e/golden-path-beta.test.ts` | 🔴 3-4d | 🟠 P1 | 🆕 Pendiente | Sello release. Ver Task 13. | Plan §Task 13 | `CORE-*`..`DIST-*` |
| `DIST-09` | 🔴 Crítica | **Pin VantaDB develop** | `apps/desktop/package.json` | 🟢 1d | 🔴 P0 | 🆕 Pendiente | Cierra el `file:` al publicar upstream. Ver Task 14. | Plan §Task 14 | `CORE-06` |
| `DIST-10` | 🔴 Crítica | **Smoke headless asar en CI** | `.github/workflows/` | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | Ver Task 15. | Plan §Task 15 | `DIST-01` |
| `DIST-11` | 🟡 Media | **Lint real o retirar claim** | `eslint.config.*` | 🟢 0.5-1d | 🟠 P1 | 🆕 Pendiente | Ver Task 16. | Plan §Task 16 | — |
| `DIST-12` | 🟡 Media | **Dev concurrente + concurrently** | `package.json` | 🟢 0.5-1d | 🟠 P1 | 🆕 Pendiente | Requiere dep `concurrently` (había falta de internet). Ver Task 17. | Plan §Task 17 | `DIST-01` |

### Task 1: HIG-01 — tsc en tests/
- **Ruta:** ego-worker
- **Estado:** ✅ COMPLETED
- **Contrato:** `pnpm --filter @ego/e2e-tests typecheck` (o script equivalente) exit 0 con los 57 errores resueltos o acotados con justificación por archivo.
- **Files:** `tests/` (fix por archivo) + script en `tests/package.json`. **Skills:** `test-driven-development`. **Verify:** typecheck + `pnpm test:e2e` verde.

### Task 2: HIG-02 — gate dist/
- **Ruta:** ego-worker
- **Estado:** ✅ COMPLETED
- **Contrato:** suite que consuma `dist/` falla en rojo si el dist está obsoleto, o pre-test reconstruye automáticamente; 0 regresiones.
- **Files:** script pre-test o cambio de resolución a `src/` en tests desktop. **Skills:** `systematic-debugging`. **Verify:** KnowledgeIndexer-style: romper dist a propósito → gate lo detecta.

### Task 3: HIG-03 — any en main
- **Ruta:** ego-desktop
- **Estado:** ✅ COMPLETED
- **Contrato:** `grep -c ": any" apps/desktop/src/main.ts` → 0 sin justificación + typecheck + tests IPC verdes.
- **Files:** `apps/desktop/src/main.ts`. **Skills:** `test-driven-development`. **Verify:** typecheck + IPC suites.

### Task 4: HIG-04 — snapshots quarantine-aware
- **Ruta:** ego-worker
- **Estado:** ✅ COMPLETED
- **Contrato:** lectura de snapshots vía cuarentena + test cold-reboot + suites dailystate verdes.
- **Files:** `DailyStatePersistence.ts` + tests. **Skills:** `test-driven-development`, `doubt-driven-development`. **Verify:** suites + typecheck. Retira el diferimiento del taskfile SEC-09.

### Task 5: HIG-05 — residuales M16
- **Ruta:** ego-worker
- **Estado:** ✅ COMPLETED
- **Contrato:** tests que fijan path edge + audit-ms, o aceptación documentada firmada.
- **Files:** `WorktreeManager.ts` + tests. **Skills:** `test-driven-development`. **Verify:** suite domains verde.

### Task 6: UP-01 — vigilancia upstream
- **Ruta:** ego-docs
- **Estado:** ✅ COMPLETED
- **Contrato:** nota fechada en `readiness-plan` con estado FIND-249 + REQ-04/05/06. Sin código.
- **Files:** `docs/engineering/vantadb-readiness-plan.md`. **Skills:** `documentation-and-adrs`. **Verify:** `check-agents-refs.ps1`.

### Task 7: DIST-02 — asarUnpack

- **Ruta:** ego-lead
- **Estado:** ✅ COMPLETED
- **Contrato:** config con `asarUnpack: ["**/*.node"]` verificada + Backlog `DIST-02` a ✅ con evidencia. Compuerta HERM-15.

### Task 8: DIST-03 — instaladores (+ iconos + code-splitting)

- **Ruta:** ego-desktop
- **Estado:** ✅ COMPLETED
- **Contrato:** targets NSIS/DMG/AppImage en verde + iconos dedicados + chunk dividido. Compuerta HERM-14.

### Task 9: DIST-04 — firmado y notarización

- **Ruta:** owner-gate
- **Estado:** ⬜ PENDING
- **Contrato:** BLOQUEO hasta certificados del owner; con ellos, firma verificada. Compuerta HERM-16.

### Task 10: DIST-05 — auto-updater

- **Ruta:** ego-desktop
- **Estado:** ✅ COMPLETED
- **Contrato:** detección + descarga diferencial + aviso, con tests. Roadmap §145.

### Task 11: DIST-06 — clean machine VM

- **Ruta:** owner-gate
- **Estado:** ⬜ PENDING
- **Contrato:** BLOQUEO hasta VM limpia; con ella, arranque con 0 errores DLL. Roadmap §142.

### Task 12: DIST-07 — docs usuario

- **Ruta:** ego-docs
- **Estado:** ✅ COMPLETED
- **Contrato:** `docs/user/` con guía + BYOK + troubleshooting; refs verdes.

### Task 13: DIST-08 — Golden Path Beta

- **Ruta:** ego-chaos
- **Estado:** ✅ COMPLETED
- **Contrato:** suite multi-día en verde, 0 regresiones. Sello release. Roadmap §182.

### Task 14: DIST-09 — pin VantaDB develop

- **Ruta:** ego-lead
- **Estado:** ✅ COMPLETED
- **Contrato:** `file:` sustituido por pin versionado cuando upstream publique (hoy 404 → vigilancia); tabla workaround→FIND al día.

### Task 15: DIST-10 — smoke headless asar en CI

- **Ruta:** ego-lead
- **Estado:** ✅ COMPLETED
- **Contrato:** test Windows x64 que carga `.node` empaquetado + `connect()`; falla ante ABI drift. Compuerta HERM-15.

### Task 16: DIST-11 — lint real o retirar claim

- **Ruta:** ego-lead
- **Estado:** ✅ COMPLETED
- **Contrato:** ESLint/Biome con gate en CI o borrar claim de `AGENTS.md`.

### Task 17: DIST-12 — dev concurrente

- **Ruta:** ego-desktop
- **Estado:** ✅ COMPLETED
- **Contrato:** `concurrently` + `VITE_DEV_SERVER_URL` + docs del loop.

=== RECITATION 1 ===
Campaign ID: 
Objetivo activo: 
Estado: completed
Última acción: Estado actualizado a COMPLETED
Resultado: tsc 0 errores + e2e 45/45. Commit 6fa17be.
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===

=== RECITATION 2 ===
Campaign ID: 
Objetivo activo: 
Estado: completed
Última acción: Estado actualizado a COMPLETED
Resultado: Gate pre-test dist, 5/5 + suites verdes. Commit 4646cbe.
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===

=== RECITATION 3 ===
Campaign ID: 
Objetivo activo: 
Estado: completed
Última acción: Estado actualizado a COMPLETED
Resultado: 0 any + eventos + manifest, desktop 138/138. Commit 3966c9e.
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===

=== RECITATION 4 ===
Campaign ID: 
Objetivo activo: 
Estado: completed
Última acción: Estado actualizado a COMPLETED
Resultado: Snapshots QA, diferimiento retirado, 37/37. Commit 7bd117d.
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===

=== RECITATION 5 ===
Campaign ID: 
Objetivo activo: 
Estado: completed
Última acción: Estado actualizado a COMPLETED
Resultado: 2 bugs reales fixeados + tests. Commit 67bd65d.
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===

=== RECITATION 6 ===
Campaign ID: 
Objetivo activo: 
Estado: completed
Última acción: Estado actualizado a COMPLETED
Resultado: Vigilancia anotada, refs verdes. Commit 1eab464.
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===

=== RECITATION 7 ===
Campaign ID: 
Objetivo activo: 
Estado: completed
Última acción: Estado actualizado a COMPLETED
Resultado: asarUnpack verificado + DIST-02 a ✅. Commit c8c589b.
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===

=== RECITATION 8 ===
Campaign ID: 
Objetivo activo: 
Estado: completed
Última acción: Estado actualizado a COMPLETED
Resultado: Targets + iconos + 6 chunks, build verde. Commit 8f2acec.
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===

=== RECITATION 9 ===
Campaign ID: 
Objetivo activo: 
Estado: pending
Última acción: Estado actualizado a PENDING
Resultado: BLOQUEO owner-gate: DIST-04 requiere certificados Authenticode EV + Apple Notary del owner. Sin ellos no hay ejecución posible.
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===

=== RECITATION 10 ===
Campaign ID: 
Objetivo activo: 
Estado: completed
Última acción: Estado actualizado a COMPLETED
Resultado: Updater skeleton 12/12, desktop 150 tests. Commit 2344eb6. Descarga real bloqueada por DIST-04.
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===

=== RECITATION 11 ===
Campaign ID: 
Objetivo activo: 
Estado: pending
Última acción: Estado actualizado a PENDING
Resultado: BLOQUEO owner-gate: DIST-06 requiere VM Windows limpia sin toolchains. Sin ella no hay ejecución posible.
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===

=== RECITATION 12 ===
Campaign ID: 
Objetivo activo: 
Estado: completed
Última acción: Estado actualizado a COMPLETED
Resultado: docs/user/ 5 archivos + refs verdes. Commit b0b7959.
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===

=== RECITATION 13 ===
Campaign ID: 
Objetivo activo: 
Estado: completed
Última acción: Estado actualizado a COMPLETED
Resultado: Beta 47/47, sello release. Commit 9c35a13.
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===

=== RECITATION 14 ===
Campaign ID: 
Objetivo activo: 
Estado: completed
Última acción: Estado actualizado a COMPLETED
Resultado: Registry verificado (404), vigilancia anotada. Commit 4a7e11d. file: se queda.
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===

=== RECITATION 15 ===
Campaign ID: 
Objetivo activo: 
Estado: completed
Última acción: Estado actualizado a COMPLETED
Resultado: Smoke nativo verde + workflow CI. Commit 3788e9d.
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===

=== RECITATION 16 ===
Campaign ID: 
Objetivo activo: 
Estado: completed
Última acción: Estado actualizado a COMPLETED
Resultado: Gate oxlint con dientes, lint+typecheck verdes. Commit f903971.
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===

=== RECITATION 17 ===
Campaign ID: 
Objetivo activo: 
Estado: completed
Última acción: Estado actualizado a COMPLETED
Resultado: Loop concurrente verificado con ventana real. Commit 00ed6f1.
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===
