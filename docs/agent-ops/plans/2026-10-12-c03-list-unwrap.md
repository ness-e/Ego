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
- **Estado:** ⬜ PENDING
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
- **Estado:** ⬜ PENDING
- **Contrato:** `pnpm --filter @ego/memory test` + `typecheck` exit 0

**Files:**
- Modify: `packages/memory/EgoMemoryAdapter.ts:183-186` (`metadata: unwrapMetadata(r.metadata...)` + comentario `// Workaround: VDB-BUG-02`)
- Modify: `packages/memory/test/**` solo asserts que esperen tagged (si existen)

**Step 1:** cambio de 1 línea + actualizar tests que afirmen shape tagged.
**Step 2:** suite + typecheck PASS. **Step 3:** commit `fix: unwrap metadata in list() (C03-list)`.

---

### Task 3: Verificar lectores knowledge + suites

- **Ruta:** ego-worker
- **Estado:** ⬜ PENDING
- **Contrato:** `pnpm --filter @ego/knowledge test` exit 0 + `asOf`/`listPending` devuelven valores reales (no fallbacks) en test

**Files:** `BitemporalQueries.ts`, `QuarantineManager.ts`, `FactLifecycle.ts` (paths vía list), `KnowledgeIndexer.ts`, `ProjectMemoryGraph.ts`, `KnowledgeExport.ts` (solo lectura salvo que el inventario exija cambio)

**Step 1:** por lector: con metadata desenvuelta, ¿el fallback desaparece? Añadir/extender asserts donde el test enmascaraba el fallback (ej. `validAt !== 0` con fixture tagged real).
**Step 2:** suite PASS. **Step 3:** commit `fix: verify knowledge readers over unwrapped list() (C03-list)`.

---

### Task 4: Verificar resto (dailystate/decision/subegos) + suites

- **Ruta:** ego-worker
- **Estado:** ⬜ PENDING
- **Contrato:** suites `dailystate,decision,subegos` en verde + `pnpm typecheck` exit 0

**Files:** consumidores del inventario fuera de knowledge (DecisionsFeed, DailyStatePersistence/Engine, DecisionAuditor list, SelfImprovementLoop).
**Step 1:** verificar cada lectura de metadata; ajustar tests que afirmaban fallbacks.
**Step 2:** suites + typecheck PASS. **Step 3:** commit.

---

### Task 5: Round-trip KnowledgeExport con nuevo shape

- **Ruta:** ego-worker
- **Estado:** ⬜ PENDING
- **Contrato:** test round-trip export→import con checksum OK en verde

**Files:** `packages/knowledge/test/` (nuevo o extendido `BitemporalAndExport.test.ts`)

**Step 1 (TDD):** export de namespace con metadata tagged real → import → checksum OK + payload/metadata íntegros.
**Step 2:** si dumps viejos (tagged) fallan checksum: NO cambiar algoritmo; documentar migración en notes + test que lo evidencie.
**Step 3:** commit.

---

### Task 6: Registro Backlog + gate de cierre

- **Ruta:** ego-lead
- **Estado:** ⬜ PENDING
- **Contrato:** fila de hallazgo presente en Backlog + `pnpm typecheck` exit 0 + suites tocadas en verde

**Files:**
- Modify: `docs/roadmap/Backlog.md` (sección Hallazgos pendientes: fila `FIND-` siguiente disponible para deuda C03-list, SIN tocar ningún Estado)
- Verify: gate por paquete tocado.
- `task_update_state` COMPLETED por task con SHAs.

=== RECITATION 1 ===
Campaign ID: 
Objetivo activo: 
Estado: in progress
Última acción: Estado actualizado a IN PROGRESS
Resultado: Inicio C03-list Task 1: inventario lectores list()
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===
