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
- **Estado:** ⬜ PENDING
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
- **Estado:** ⬜ PENDING
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
- **Estado:** ⬜ PENDING
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
- **Estado:** ⬜ PENDING
- **Contrato:** `pnpm --filter @ego/knowledge test` exit 0

**Files (del inventario):**
- Modify: `packages/knowledge/src/KnowledgeIndexer.ts` (2 sitios: `existing.metadata` → `existing?.metadata`), `packages/knowledge/src/FactLifecycle.ts` (3 sitios), `packages/knowledge/src/ProjectMemoryGraph.ts` (1 sitio)

**Step 1:** adaptar a envelope (metadata ya desenvuelta: comparar `meta["content_hash"]` directo).
**Step 2:** suite knowledge PASS. **Step 3:** commit `fix: migrate knowledge readers to get() envelope (C02)`.

---

### Task 5: Migrar resto de callers (decision/dailystate/domains/runtime/apps/tests)

- **Ruta:** ego-worker
- **Estado:** ⬜ PENDING
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
- **Estado:** ⬜ PENDING
- **Contrato:** `pnpm typecheck` exit 0 + suites de paquetes tocados en verde + `pnpm build` exit 0

**Files:**
- Verify: gate completo por paquete (no global con timeout: uno por uno)
- Re-verificar claim Fase-06 (`content_hash` dedup) con el test de Task 6 como evidencia (sin tocar Backlog: H28 fuera de alcance)
- Commit final si hay restos; `task_update_state` COMPLETED por task con SHAs.

=== RECITATION 1 ===
Campaign ID: 
Objetivo activo: 
Estado: in progress
Última acción: Estado actualizado a IN PROGRESS
Resultado: Inicio C02 Task 1: inventario blast-radius
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===
