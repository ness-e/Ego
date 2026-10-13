# Deuda C03-list — unwrap central en `list()` — Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `adapter.list()` retorna metadata desenvuelta (primitivas), todos sus lectores verificados, round-trip de Export probado y hallazgo registrado en Backlog sin tocar estados.

**Architecture:** Un cambio central en `EgoMemoryAdapter.list()` (`:183-186`, `unwrapMetadata` de Task C02-2) + verificación por consumidor. `exportDump` usa `db.list` crudo directo: NO le afecta (fidelidad del dump intacta). `KnowledgeExport` (vía `adapter.list`) se verifica con round-trip.

**Tech Stack:** pnpm, TypeScript strict, vitest.

**Decisiones HITL aplicadas:** unwrap central (no por consumidor, no listRaw sin evidencia); verificar TODOS los lectores + tests por paquete; Export con test round-trip; fila de hallazgo en Backlog sin tocar Estados (H28 fuera de alcance).

**Backlog relacionado (solo lectura):** `KB-07` (QuarantineManager ✅), `KB-08` (FactLifecycle ✅), `KB-09` (Bitemporal ✅) — lecturas rotas en silencio; `VDB-BUG-02` (workaround citado), `VDB-REQ-06` (emulación bitemporal).

---

### Task 1: Inventario de lectores vía `list()`

- **Ruta:** ego-arch
- **Estado:** ✅ COMPLETED
- **Contrato:** `docs/agent-ops/tasks/C03-list-blast-radius.md` existe con 0 consumidores sin clasificar

**Files:**
- Create: `docs/agent-ops/tasks/C03-list-blast-radius.md`
- Leer: `adapter.list(` en `packages/`, `apps/` (excluir `db.list` crudo interno y `registry.list` no-adapter)

**Step 1:** enumerar consumidores y clasificar por uso de metadata: LEE-META (BitemporalQueries, QuarantineManager, resto por confirmar) vs PAYLOAD-ONLY (payload, sin cambio) vs CRUDO-INTERNO (`db.list` en adapter/exportDump: fuera de alcance).
**Step 2:** escribir tabla `archivo:línea | usa-metadata? | veredicto`.
**Step 3:** commit `docs: blast radius inventory for C03-list unwrap`.

---

### Task 2: unwrap central en `list()` + tests memory

- **Ruta:** ego-worker
- **Estado:** ✅ COMPLETED
- **Contrato:** `pnpm --filter @ego/memory test` + `typecheck` exit 0

**Files:**
- Modify: `packages/memory/EgoMemoryAdapter.ts:183-186` (`metadata: unwrapMetadata(r.metadata...)` + comentario `// Workaround: VDB-BUG-02`)
- Modify: `packages/memory/test/**` solo asserts que esperen tagged (si existen)

**Step 1:** cambio de 1 línea + actualizar tests que afirmen shape tagged.
**Step 2:** suite + typecheck PASS. **Step 3:** commit `fix: unwrap metadata in list() (C03-list)`.

---

### Task 3: Verificar lectores knowledge + suites

- **Ruta:** ego-worker
- **Estado:** ✅ COMPLETED
- **Contrato:** `pnpm --filter @ego/knowledge test` exit 0 + `asOf`/`listPending` devuelven valores reales (no fallbacks) en test

**Files:** `BitemporalQueries.ts`, `QuarantineManager.ts`, `FactLifecycle.ts` (paths vía list), `KnowledgeIndexer.ts`, `ProjectMemoryGraph.ts`, `KnowledgeExport.ts` (solo lectura salvo que el inventario exija cambio)

**Step 1:** por lector: con metadata desenvuelta, ¿el fallback desaparece? Añadir/extender asserts donde el test enmascaraba el fallback (ej. `validAt !== 0` con fixture tagged real).
**Step 2:** suite PASS. **Step 3:** commit `fix: verify knowledge readers over unwrapped list() (C03-list)`.

---

### Task 4: Verificar resto (dailystate/decision/subegos) + suites

- **Ruta:** ego-worker
- **Estado:** ✅ COMPLETED
- **Contrato:** suites `dailystate,decision,subegos` en verde + `pnpm typecheck` exit 0

**Files:** consumidores del inventario fuera de knowledge (DecisionsFeed, DailyStatePersistence/Engine, DecisionAuditor list, SelfImprovementLoop).
**Step 1:** verificar cada lectura de metadata; ajustar tests que afirmaban fallbacks.
**Step 2:** suites + typecheck PASS. **Step 3:** commit.

---

### Task 5: Round-trip KnowledgeExport con nuevo shape

- **Ruta:** ego-worker
- **Estado:** ✅ COMPLETED
- **Contrato:** test round-trip export→import con checksum OK en verde

**Files:** `packages/knowledge/test/` (nuevo o extendido `BitemporalAndExport.test.ts`)

**Step 1 (TDD):** export de namespace con metadata tagged real → import → checksum OK + payload/metadata íntegros.
**Step 2:** si dumps viejos (tagged) fallan checksum: NO cambiar algoritmo; documentar migración en notes + test que lo evidencie.
**Step 3:** commit.

---

### Task 6: Registro Backlog + gate de cierre

- **Ruta:** ego-lead
- **Estado:** ✅ COMPLETED
- **Contrato:** fila de hallazgo presente en Backlog + `pnpm typecheck` exit 0 + suites tocadas en verde

**Files:**
- Modify: `docs/roadmap/Backlog.md` (sección Hallazgos pendientes: fila `FIND-` siguiente disponible para deuda C03-list, SIN tocar ningún Estado)
- Verify: gate por paquete tocado.
- `task_update_state` COMPLETED por task con SHAs.

=== RECITATION 1 ===
Objetivo activo: Task 1 — inventario lectores list()
Estado: completed
Última acción: Commit b54037b + task_update_state COMPLETED
Resultado: ✅ 21 consumidores (9 lee-meta/12 payload/4 crudos/0 bloqueantes). Commit b54037b.
State: COMPLETED (desde IN PROGRESS)
Próxima acción: Task 2 (unwrap central)
Contrato: docs/agent-ops/tasks/C03-list-blast-radius.md con 0 sin clasificar
Invariantes: Solo lectura; exportDump vía db.list crudo fuera de alcance a propósito
Comandos de verificación: grep + tabla + totales; 0 BLOQUEANTES
Deuda: ninguna
Próxima tarea si completa: Task 2
last-synced: 2026-10-12T03:15:48-04:00
=== END RECITATION ===

=== RECITATION 2 ===
Objetivo activo: Task 2 — unwrap central en list()
Estado: completed
Última acción: Commit 360a0af + task_update_state COMPLETED
Resultado: ✅ 1 línea + cita VDB-BUG-02, suite 57/57 sin cambios en tests. Commit 360a0af.
State: COMPLETED (desde IN PROGRESS)
Próxima acción: Task 3 (knowledge)
Contrato: pnpm --filter @ego/memory test + typecheck exit 0
Invariantes: db.list crudo (:638,:715), putMulti, get() intactos
Comandos de verificación: suite 57/57; typecheck exit 0
Deuda: ninguna
Próxima tarea si completa: Task 3
last-synced: 2026-10-12T03:17:51-04:00
=== END RECITATION ===

=== RECITATION 3 ===
Objetivo activo: Task 3 — lectores knowledge
Estado: completed
Última acción: Commit 02bd576 + task_update_state COMPLETED
Resultado: ✅ 36/36 con asserts anti-fallback, src intacto. Commit 02bd576.
State: COMPLETED (desde IN PROGRESS)
Próxima acción: Task 4 (resto)
Contrato: pnpm --filter @ego/knowledge test exit 0 + valores reales (no fallbacks)
Invariantes: Lectores ya correctos con desenvuelto; dist stale obligó rebuild (gitignored)
Comandos de verificación: suite 36/36; typecheck exit 0
Deuda: ninguna
Próxima tarea si completa: Task 4
last-synced: 2026-10-12T03:21:44-04:00
=== END RECITATION ===

=== RECITATION 4 ===
Objetivo activo: Task 4 — resto de lectores
Estado: completed
Última acción: Commit ac6e8ff + task_update_state COMPLETED
Resultado: ✅ dailystate/decision/subegos verificados, src intacto, typecheck global. Commit ac6e8ff.
State: COMPLETED (desde IN PROGRESS)
Próxima acción: Task 5 (round-trip)
Contrato: suites dailystate/decision/subegos verdes + pnpm typecheck exit 0
Invariantes: Dual-shape ya toleraba ambos; PAYLOAD-ONLY verificados sin reescribir
Comandos de verificación: 19/19 + 30/30 + 146/146; typecheck global exit 0
Deuda: ninguna
Próxima tarea si completa: Task 5
last-synced: 2026-10-12T03:27:14-04:00
=== END RECITATION ===

=== RECITATION 5 ===
Objetivo activo: Task 5 — round-trip Export
Estado: completed
Última acción: Commit e759d28 + task_update_state COMPLETED
Resultado: ✅ Round-trip OK + migración legacy documentada. Commit e759d28.
State: COMPLETED (desde IN PROGRESS)
Próxima acción: Task 6 (registro + gate)
Contrato: test round-trip export→import con checksum OK en verde
Invariantes: Algoritmo intacto; dumps viejos evidenciados con test, no maquillados
Comandos de verificación: ExportUnwrapRoundtrip 2/2; suite knowledge verde
Deuda: dumps legacy tagged → EGO-FIND-01
Próxima tarea si completa: Task 6
last-synced: 2026-10-12T03:30:03-04:00
=== END RECITATION ===

=== RECITATION 6 ===
Objetivo activo: Task 6 — registro Backlog + gate
Estado: completed
Última acción: Commit 315dc3a + task_update_state COMPLETED
Resultado: ✅ EGO-FIND-01 registrado sin tocar estados; gate verde. Commit 315dc3a.
State: COMPLETED (desde IN PROGRESS)
Próxima acción: Plan maestro hallazgos
Contrato: fila EGO-FIND-01 presente + typecheck + suites tocadas en verde
Invariantes: Ningún Estado canónico tocado (H28 con owner)
Comandos de verificación: typecheck exit 0; fila presente con esquema 10 columnas
Deuda: EGO-FIND-01 🆕 pendiente (migración dumps)
Próxima tarea si completa: plan maestro
last-synced: 2026-10-12T03:30:53-04:00
=== END RECITATION ===
