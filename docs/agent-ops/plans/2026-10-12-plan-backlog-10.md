# Plan — Siguientes 10 del Backlog (Fase 11 → 12)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Completar SEC-01–SEC-09 (Fase 11 Seguridad) y DIST-01 (puerta Fase 12) con gates mecánicos, compsuertas de extracción, y taskfiles creados en DISCOVERY por task (pipeline-full).

**Architecture:** Seguridad primero (orden de progresión estricta §6 AGENTS.md: Fase 11 antes que 12). `packages/security/` como hogar del enforcement; main como único consumidor en main process; renderer untrusted siempre.

**Tech Stack:** pnpm, TypeScript strict, vitest, Electron (sandbox/CSP/IPC), keytar/safeStorage (decidir en DISCOVERY con evidencia), `floor-guard.ps1`, `pnpm audit`.

**Orden y dependencias:** SEC-01, SEC-02 (base) → SEC-03 → SEC-04/SEC-09 (dependen SEC-03) + SEC-05 → SEC-06 (⏳ en curso: continuar, no reiniciar) → SEC-07 → SEC-08 (requiere SEC-01..05) → DIST-01 (requiere CORE-01 ✅ + electron-builder real). Compuertas por fila (CARP-03/04, HERM-19, DSEK-05, COUC-10) se ejecutan como gates Opción B antes de codificar cada task (leer ficha `docs/extractions/*.md` + backlog revisión correspondiente).

**MCP por defecto:** `codegraph_explore`, `task_validate_scope`, `task_verify_cmd`, `check_index_coverage`. Skills: SDP al dispatch + fijadas por task. Taskfiles: crear en DISCOVERY (`docs/agent-ops/tasks/<ID>.md`) si no existen; si existen (SEC-06), continuar desde el primer ⬜.

## Índice ejecutable (10 columnas canónicas)

| ID | Severidad | Hallazgo | Archivo:línea | Esfuerzo | Prioridad | Estado | Descripción | Relaciones | Dependencias |
|---|---|---|---|---|---|---|---|---|---|
| `SEC-01` | 🔴 Crítica | **Auditoría Sandboxing y Context Isolation** | `apps/desktop/src/main.ts:42` | 🟢 1d | 🔴 P0 | 🆕 Pendiente | Verificar 0 APIs Node/VantaDB en renderer + CSP estrictas. Ver Task 1. | Plan §Task 1 | `CORE-02` |
| `SEC-02` | 🔴 Crítica | **IPC validado con Zod en Main** | `apps/desktop/src/ipc/handlers.ts` | 🟡 2d | 🔴 P0 | 🆕 Pendiente | Todo mensaje IPC validado; renderer untrusted. Ver Task 2. | Plan §Task 2 | `CORE-02` |
| `SEC-03` | 🔴 Crítica | **Credential Manager con Keychain** | `packages/security/CredentialManager.ts` | 🟡 2d | 🔴 P0 | 🆕 Pendiente | Keychain SO (keytar/DPAPI/Secret Service). Ver Task 3. | Plan §Task 3 | `CORE-01` |
| `SEC-04` | 🔴 Crítica | **Barrera Zero Secrets in Storage** | `packages/security/SecretsFilter.ts` | 🟢 1d | 🔴 P0 | 🆕 Pendiente | Interceptor anti-fuga. Ver Task 4. | Plan §Task 4 | `SEC-03` |
| `SEC-05` | 🟠 Alta | **Matriz de permisos y Sandbox** | `packages/security/ToolPermissions.ts` | 🟡 2d | 🔴 P0 | 🆕 Pendiente | Paths workspace + comandos prohibidos. Ver Task 5. | Plan §Task 5 | `ACT-01` |
| `SEC-06` | 🟠 Alta | **Auditoría inmutable gov/audit** | `packages/memory/EgoMemoryAdapter.ts:240` | 🟢 1-2d | 🔴 P0 | ⏳ En curso | Continuar (no reiniciar). Ver Task 6. | Plan §Task 6 | `CORE-06` |
| `SEC-07` | 🟡 Media | **Purga criptográfica ADR-046/VER-02** | `packages/security/CryptoErasure.ts` | 🟢 1d | 🔴 P0 | 🆕 Pendiente | Borrado verificable. Ver Task 7. | Plan §Task 7 | `CORE-06` |
| `SEC-08` | 🟠 Alta | **Suite penetración e inyección** | `tests/security/injection-boundaries.test.ts` | 🟡 2d | 🔴 P0 | 🆕 Pendiente | Requiere SEC-01..05. Ver Task 8. | Plan §Task 8 | `SEC-01`..`SEC-05` |
| `SEC-09` | 🔴 Crítica | **Cuarentena por defecto sin cifrado** | `packages/memory/EgoMemoryAdapter.ts` | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | Depende FIND-249 (lado Ego). Ver Task 9. | Plan §Task 9 | `SEC-03`, `KB-07` |
| `DIST-01` | 🔴 Crítica | **Pipeline electron-builder** | `apps/desktop/package.json` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | Última por progresión. Ver Task 10. | Plan §Task 10 | `CORE-01` |

---

### Task 1: SEC-01 — Sandboxing y Context Isolation

- **Ruta:** ego-audit (veredicto) + ego-desktop (fix si hay)
- **Estado:** ✅ COMPLETED
- **Contrato:** auditoría PASS + `floor-guard.ps1` verde + 0 APIs Node/VantaDB en renderer

**Files:** `apps/desktop/src/main.ts:42` (BrowserWindows), `preload.ts`, compuertas `CARP-03`, `HERM-19`.
**Relaciones:** `CORE-02` ✅. Docs: `AGENTS.md` §Seguridad.
**Skills:** `doubt-driven-development`.
**Verify:** audit + typecheck. Sin cambios de comportamiento salvo closures probados.

### Task 2: SEC-02 — IPC validado con Zod en Main

- **Ruta:** ego-desktop
- **Estado:** ✅ COMPLETED
- **Contrato:** todo handler IPC valida schema + test de payload inválido rechazado

**Files:** `apps/desktop/src/ipc/handlers.ts` (verificar ruta real en DISCOVERY; el Backlog puede estar stale), esquemas `ipc/schema.ts`.
**Relaciones:** `CORE-02` ✅. Docs: `docs/engineering/lenguajes.md` §32.
**Skills:** `test-driven-development`, `doubt-driven-development`.
**Verify:** suite IPC + typecheck.

### Task 3: SEC-03 — Credential Manager con Keychain

- **Ruta:** ego-worker (implementa) + ego-audit (veredicto)
- **Estado:** ⬜ PENDING
- **Contrato:** round-trip guardar/leer/borrar en los 3 SO o degradación documentada + tests

**Files:** `packages/security/CredentialManager.ts` (existe parcial: SafeStorageBackend de F1T1; aquí keytar/DPAPI/Keychain/SecretService + `DSEK-05`).
**Relaciones:** `CORE-01` ✅. Docs: `AGENTS.md` §Seguridad.
**Skills:** `test-driven-development`, `source-driven-development` (docs keytar vs safeStorage desde fuente, no memoria).
**Verify:** tests (con keychain real donde haya, mock firmado donde no) + typecheck. Decisión documentada si se elige safeStorage-sobre-keytar.

### Task 4: SEC-04 — Barrera Zero Secrets in Storage

- **Ruta:** ego-worker + ego-audit
- **Estado:** ⬜ PENDING (bloqueada hasta SEC-03 salvo stub testeable)
- **Contrato:** interceptor bloquea API key/token hacia VantaDB/logs/prompts + tests de fuga

**Files:** `packages/security/SecretsFilter.ts` (crear), compuertas `CARP-04`, `DSEK-05`.
**Relaciones:** `SEC-03`, Fase 11 roadmap.
**Skills:** `test-driven-development`, `doubt-driven-development`.
**Verify:** tests de fuga (canarios) + typecheck.

### Task 5: SEC-05 — Matriz de permisos y Sandbox

- **Ruta:** ego-worker + ego-audit
- **Estado:** ⬜ PENDING
- **Contrato:** paths fuera del workspace denegados + comandos prohibidos bloqueados + tests

**Files:** `packages/security/ToolPermissions.ts` (crear), compuertas `CARP-03`, `HERM-19`, `COUC-10`.
**Relaciones:** `ACT-01`. Docs: `principios-innegociables.md` §6.
**Skills:** `test-driven-development`, `doubt-driven-development`.
**Verify:** tests de denegación + typecheck.

### Task 6: SEC-06 — Auditoría inmutable (continuar, no reiniciar)

- **Ruta:** ego-worker
- **Estado:** ⏳ EN CURSO (leer estado actual primero)
- **Contrato:** cada comando/archivo/aprobación con SHA-256 + Sub-Ego ID, verificable por test

**Files:** `packages/memory/EgoMemoryAdapter.ts:240` + namespace `gov/audit`.
**Relaciones:** `CORE-06` ✅.
**Skills:** `test-driven-development`.
**Verify:** tests + typecheck. Regla: continuar el trabajo existente, prohibido rehacer.

### Task 7: SEC-07 — Purga criptográfica ADR-046/VER-02

- **Ruta:** ego-worker + ego-audit
- **Estado:** ⬜ PENDING
- **Contrato:** borrado verificable + test de irrecuperabilidad a nivel API

**Files:** `packages/security/CryptoErasure.ts` (crear). Docs: `memoria-vantadb.md` §14.
**Relaciones:** `CORE-06` ✅.
**Skills:** `test-driven-development`.
**Verify:** tests + typecheck. Nota: borrado físico real depende del LSM (documentar límite honestamente).

### Task 8: SEC-08 — Suite penetración e inyección

- **Ruta:** ego-chaos (con revisión ego-audit)
- **Estado:** ⬜ PENDING (requiere SEC-01..05 verdes)
- **Contrato:** `tests/security/injection-boundaries.test.ts` creado (hoy inexistente) y en verde

**Files:** `tests/security/` (crear dir + suite; verificar si entra al workspace pnpm o necesita paquete, ver C09).
**Relaciones:** `SEC-01`..`SEC-05`. Docs: `docs/testing/estrategia.md`.
**Skills:** `test-driven-development`, `doubt-driven-development`.
**Verify:** suite + typecheck. Solo fixtures temporales, nunca datos reales.

### Task 9: SEC-09 — Cuarentena por defecto sin cifrado

- **Ruta:** ego-worker + ego-audit
- **Estado:** ⬜ PENDING (requiere SEC-03 + VantaDB FIND-249; si FIND-249 abierto, implementar lado Ego y documentar dependencia)
- **Contrato:** namespaces sensibles → `quarantine/pending` + aviso UI + 0 secretos en storage/logs

**Files:** `packages/memory/EgoMemoryAdapter.ts` + `packages/security/SecretsFilter.ts`.
**Relaciones:** `SEC-03`, `SEC-04`, `KB-07` ✅. Origen VantaDB `FIND-249`.
**Skills:** `test-driven-development`, `doubt-driven-development`.
**Verify:** tests + typecheck.

### Task 10: DIST-01 — Pipeline electron-builder

- **Ruta:** ego-lead
- **Estado:** ⬜ PENDING (requiere CORE-01 ✅; llega última por progresión)
- **Contrato:** `pnpm build` empaqueta + artefactos verificados (main, preload, renderer)

**Files:** `apps/desktop/package.json`, `electron-builder.config.cjs` (+ `assets/` de F5T11 si existe), `pnpm-workspace.yaml` scripts.
**Relaciones:** `CORE-01` ✅. Docs: `docs/operations/despliegue.md`. Compuerta: `HERM-14`.
**Skills:** `ci-cd-and-automation`.
**Verify:** build + artefactos + typecheck. Sin firmados (DIST-04) ni installers (DIST-03) en esta task.

=== RECITATION SEC-01 ===
Campaign ID: 
Objetivo activo: 
Estado: completed
Última acción: Estado actualizado a COMPLETED
Resultado: CSP estricta + 5 tests, floor verde. Commit 30b6aa1.
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===

=== RECITATION SEC-02 ===
Campaign ID: 
Objetivo activo: 
Estado: completed
Última acción: Estado actualizado a COMPLETED
Resultado: 50/50 handlers validados, 5 gaps cerrados. Commit 8daba8f.
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===

=== RECITATION SEC-03 ===
Campaign ID: 
Objetivo activo: 
Estado: in progress
Última acción: Estado actualizado a IN PROGRESS
Resultado: Inicio SEC-03: Credential Manager Keychain
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===
