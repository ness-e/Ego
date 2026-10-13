# C02 — Contrato `get()` a envelope + unwrap + M13 — Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `EgoMemoryAdapter.get()` retorna envelope `{key,payload,metadata}` con metadata desenvuelta, todos los callers migrados, idempotencia por `content_hash` funcional + M13 (batch/flush/doble index).

**Architecture:** Un solo contrato de lectura (igual que `list()`): envelope siempre. `unwrapMetadata()` centraliza el desenvuelto del tagged `{Float,String,Bool}` (workaround `VDB-BUG-02`, citado en código). `get()` viejo (payload pelado) desaparece; migración mecánica de todos los callers con gates por paquete.

**Tech Stack:** pnpm, TypeScript strict, vitest, NativeVantaDB (solo vía adapter).

**Decisiones HITL aplicadas:** enfoque = cambiar `get()` a envelope (opción B elegida por el desarrollador con evidencia de ~30 call sites a migrar); unwrap sí adaptado al envelope; M13 incluido como Task final.

**Riesgo declarado:** blast radius grande (todos los `adapter.get`). Task 1 lo inventaría completo antes de tocar código (Regla 0).

---

### Task 1: Blast-radius — inventario total de `adapter.get`

- **Ruta:** ego-arch
- **Estado:** ✅ COMPLETED
- **Contrato:** `docs/agent-ops/tasks/C02-blast-radius.md` existe con 0 callers sin clasificar (verificado contra grep)

**Files:**
- Create: `docs/agent-ops/tasks/C02-blast-radius.md`
- Grep (solo lectura): `adapter\.get\(|memory\.get\(` en `packages/`, `apps/`, `tests/`

**Step 1: Enumerar**
Run: `grep -rn "adapter\.get(\|memory\.get(" packages apps tests --include="*.ts"`
Expected: lista completa (base conocida: KnowledgeIndexer×2, FactLifecycle×3, ProjectMemoryGraph×1, DecisionAuditor, DailyStatePersistence, tests de memory/runtime/contract/checkpoint).

**Step 2: Clasificar cada caller**
Payload-only (usa el retorno como payload: casts `as {title}`, `verdict`, tests) vs metadata (lee `.metadata.*`). Anotar archivo:línea + veredicto + migración requerida (`?.payload` o uso directo del envelope).

**Step 3: Escribir inventario**
Formato por fila: `archivo:línea | tipo (payload/metadata) | migración`.

**Step 4: Commit**
```bash
git add docs/agent-ops/tasks/C02-blast-radius.md
git commit -m "docs: blast radius inventory for C02 get() envelope"
```

---

### Task 2: `unwrapMetadata()` + unit tests

- **Ruta:** ego-worker
- **Estado:** ✅ COMPLETED
- **Contrato:** `pnpm --filter @ego/memory test -- unwrap` PASS (archivo nuevo `packages/memory/test/unwrap-metadata.test.ts`)

**Files:**
- Create: `packages/memory/src/unwrapMetadata.ts` (exporta `unwrapMetadata(tagged): Record<string, unknown>` + `wrapMetadata` NO — el wrap queda en `putMulti`)
- Create: `packages/memory/test/unwrap-metadata.test.ts`
- Modify: `packages/memory/src/index.ts` (export, verificar nombre del barrel)

**Step 1 (TDD rojo): casos** `{Float:1.5}→1.5`, `{String:"a"}→"a"`, `{Bool:true}→true`, `"Null"→null`, objeto anidado pasa tal cual, clave ausente → `{}`, número crudo legacy → tal cual.
**Step 2:** `pnpm --filter @ego/memory test -- unwrap` → FAIL (módulo inexistente).
**Step 3:** implementar con comentario `// Workaround: VDB-BUG-02 (inverso del etiquetado en putMulti)`.
**Step 4:** test → PASS. **Step 5:** commit `feat: add unwrapMetadata helper (VDB-BUG-02)`.

---

### Task 3: `get()` a envelope + tests del paquete memory

- **Ruta:** ego-worker
- **Estado:** ✅ COMPLETED
- **Contrato:** `pnpm --filter @ego/memory test` + `typecheck` exit 0

**Files:**
- Modify: `packages/memory/EgoMemoryAdapter.ts:165-170` (`get` retorna `{key, payload: parseRecord, metadata: unwrapMetadata(record.metadata)} | null`), `packages/memory/test/*.test.ts` (casts de payload → `?.payload`)
- Referencia: inventario Task 1 (solo callers de `packages/memory`)

**Step 1:** cambiar `get()` (5 líneas) + actualizar casts en tests del paquete.
**Step 2:** `pnpm --filter @ego/memory test` → PASS; `typecheck` → exit 0.
**Step 3:** commit `fix: get() returns envelope with unwrapped metadata (C02)`.

---

### Task 4: Migrar callers de knowledge

- **Ruta:** ego-worker
- **Estado:** ✅ COMPLETED
- **Contrato:** `pnpm --filter @ego/knowledge test` exit 0

**Files (del inventario):**
- Modify: `packages/knowledge/src/KnowledgeIndexer.ts` (2 sitios: `existing.metadata` → `existing?.metadata`), `packages/knowledge/src/FactLifecycle.ts` (3 sitios), `packages/knowledge/src/ProjectMemoryGraph.ts` (1 sitio)

**Step 1:** adaptar a envelope (metadata ya desenvuelta: comparar `meta["content_hash"]` directo).
**Step 2:** suite knowledge PASS. **Step 3:** commit `fix: migrate knowledge readers to get() envelope (C02)`.

---

### Task 5: Migrar resto de callers (decision/dailystate/domains/runtime/apps/tests)

- **Ruta:** ego-worker
- **Estado:** ✅ COMPLETED
- **Contrato:** suites `decision,dailystate,domains,runtime,desktop` en verde + `typecheck` global exit 0

**Files:** todos los payload-only del inventario → `(await get(...))?.payload as T` (cambio mecánico, sin lógica).
**Step 1:** migrar por paquete con su suite en verde cada uno. **Step 2:** commit `refactor: migrate remaining get() callers to envelope (C02)`.

---

### Task 6 (M13): batch + flush + test doble indexación

- **Ruta:** ego-worker
- **Estado:** ⬜ PENDING
- **Contrato:** `pnpm --filter @ego/knowledge test -- double-index` PASS (segunda pasada skips todo, 0 puts nuevos)

**Files:**
- Modify: `packages/knowledge/src/KnowledgeIndexer.ts` (tras fix C02: idempotencia vía `getRecord`-equivalente `get()` + `flush()` al final de `indexDocument`; evaluar batch si el diff lo justifica, si no solo flush)
- Create: `packages/knowledge/test/double-index.test.ts`

**Step 1 (TDD):** indexar doc dos veces → 2ª vez `skipped === chunks`, `indexed === 0`.
**Step 2:** implementar flush + (batch si aplica). **Step 3:** PASS + commit `feat: idempotent index with flush (M13/C02)`.

---

### Task 7: Puerta de calidad + cierre

- **Ruta:** ego-lead
- **Estado:** ✅ COMPLETED
- **Contrato:** `pnpm typecheck` exit 0 + suites de paquetes tocados en verde + `pnpm build` exit 0

**Files:**
- Verify: gate completo por paquete (no global con timeout: uno por uno)
- Re-verificar claim Fase-06 (`content_hash` dedup) con el test de Task 6 como evidencia (sin tocar Backlog: H28 fuera de alcance)
- Commit final si hay restos; `task_update_state` COMPLETED por task con SHAs.

=== RECITATION 1 ===
Objetivo activo: Task 1 — inventario blast-radius C02
Estado: completed
Última acción: Commit 1c86755 + task_update_state COMPLETED
Resultado: ✅ 82 callers (76 payload/2 metadata/4 mixtos/0 sin clasificar). Commit 1c86755.
State: COMPLETED (desde IN PROGRESS)
Próxima acción: Task 2 (unwrapMetadata)
Contrato: docs/agent-ops/tasks/C02-blast-radius.md existe con 0 sin clasificar
Invariantes: Solo lectura + inventario; getDb crudo anotado fuera de alcance
Comandos de verificación: grep exhaustivo + tabla archivo:línea|tipo|migración; totales cuadran
Deuda: patrón storage.get omitido (hallado y cerrado en Task 5)
Próxima tarea si completa: Task 2
last-synced: 2026-10-12T02:25:32-04:00
=== END RECITATION ===

=== RECITATION 2 ===
Objetivo activo: Task 2 — unwrapMetadata + tests
Estado: completed
Última acción: Commit 33025c8 + task_update_state COMPLETED
Resultado: ✅ Helper + 8 tests, suite 57/57. Commit 33025c8.
State: COMPLETED (desde IN PROGRESS)
Próxima acción: Task 3 (get a envelope)
Contrato: pnpm --filter @ego/memory test -- unwrap PASS
Invariantes: Función pura sin I/O; cita VDB-BUG-02; layout plano del paquete respetado
Comandos de verificación: unwrap 8/8; suite 57/57; typecheck exit 0
Deuda: ninguna
Próxima tarea si completa: Task 3
last-synced: 2026-10-12T02:27:23-04:00
=== END RECITATION ===

=== RECITATION 3 ===
Objetivo activo: Task 3 — get() a envelope
Estado: completed
Última acción: Commit 8a8a2e6 + task_update_state COMPLETED
Resultado: ✅ Envelope + metadata desenvuelta, 57/57. Commit 8a8a2e6.
State: COMPLETED (desde IN PROGRESS)
Próxima acción: Task 4 (knowledge)
Contrato: pnpm --filter @ego/memory test + typecheck exit 0
Invariantes: null en clave inexistente preservado; list() intacto en esta task
Comandos de verificación: suite 57/57; typecheck exit 0
Deuda: list() sigue tagged → deuda C03
Próxima tarea si completa: Task 4
last-synced: 2026-10-12T02:31:03-04:00
=== END RECITATION ===

=== RECITATION 4 ===
Objetivo activo: Task 4 — migrar knowledge
Estado: completed
Última acción: Commit 5f13137 + task_update_state COMPLETED
Resultado: ✅ 6 sitios migrados, suite 29/29. Commit 5f13137.
State: COMPLETED (desde IN PROGRESS)
Próxima acción: Task 5 (resto callers)
Contrato: pnpm --filter @ego/knowledge test exit 0
Invariantes: Cero lógica nueva; comparación content_hash directa (primitiva)
Comandos de verificación: suite 29/29; typecheck exit 0
Deuda: dist memory stale obligó casts exactos (rebuild en Task 7)
Próxima tarea si completa: Task 5
last-synced: 2026-10-12T02:35:22-04:00
=== END RECITATION ===

=== RECITATION 5 ===
Objetivo activo: Task 5 — resto de callers
Estado: completed
Última acción: Commit c67aa20 + task_update_state COMPLETED
Resultado: ✅ 86 callers migrados, suites verdes + typecheck global. Commit c67aa20.
State: COMPLETED (desde IN PROGRESS)
Próxima acción: Task 6 (M13)
Contrato: suites decision/dailystate/domains/runtime/desktop verdes + pnpm typecheck exit 0
Invariantes: Cambio mecánico ?.payload; 14 tolerantes intactos; getDb crudo fuera de alcance
Comandos de verificación: 5 suites PASS; typecheck 19/19
Deuda: inventario omitió storage.get (enmendado + migrado)
Próxima tarea si completa: Task 6
last-synced: 2026-10-12T02:55:33-04:00
=== END RECITATION ===

=== RECITATION 6 ===
Objetivo activo: Task 6 (M13) — batch + flush + doble index
Estado: completed
Última acción: Commit c80fb88 + task_update_state COMPLETED
Resultado: ✅ Idempotencia probada 30/30 (2ª pasada 0 puts). Commit c80fb88.
State: COMPLETED (desde IN PROGRESS)
Próxima acción: Task 7 (gate)
Contrato: test doble indexación PASS (skipped===chunks, 0 puts, 0 duplicados en list)
Invariantes: put delega a putMulti (misma normalización); flush incondicional; sin duplicados por otra causa
Comandos de verificación: double-index PASS; suite 30/30; typecheck exit 0
Deuda: ninguna; re-verifica claim dedup Fase-06
Próxima tarea si completa: Task 7
last-synced: 2026-10-12T02:58:17-04:00
=== END RECITATION ===

=== RECITATION 7 ===
Objetivo activo: Task 7 — puerta de calidad + cierre
Estado: completed
Última acción: task_update_state COMPLETED (gate sin commit propio)
Resultado: ✅ typecheck 19/19, suites memory57/knowledge30/decision29/dailystate17/domains45/runtime48/desktop102/subegos40/tasks40, dist reconstruidos.
State: COMPLETED (desde IN PROGRESS)
Próxima acción: Plan C03-list (deuda list tagged)
Contrato: pnpm typecheck exit 0 + suites por paquete en verde + build
Invariantes: Gate por paquete (global excede timeout verificador); H28 fuera de alcance, Backlog intacto
Comandos de verificación: typecheck 19/19; suites verdes; dist memory+knowledge rebuild
Deuda: C03-list (list tagged) → siguiente plan
Próxima tarea si completa: plan C03-list
last-synced: 2026-10-12T03:00:00-04:00
=== END RECITATION ===
