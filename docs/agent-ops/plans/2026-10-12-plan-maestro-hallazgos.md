# Plan Maestro — Hallazgos restantes revisión 2026-10-12

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Cerrar los ~80 hallazgos abiertos del reporte `revision-proyecto-2026-10-12.md` en 6 épicas y 13 tasks ejecutables con gates mecánicos, sin regresiones y sin tocar Estados del Backlog.

**Architecture:** Un contrato por área (seguridad real vía Keychain, contratos de decisión unificados, envelopes ya cerrados en C02/C03-list), fixes mínimos por hallazgo, verificación por paquete + typecheck global. Lo ya cerrado (C01, C02+M13, C03-list, C05-parcial, ESM) no se retoca.

**Tech Stack:** pnpm, TypeScript strict, vitest, Electron safeStorage, AI SDK (intacto), NativeVantaDB vía adapter.

**Res absueltas (no replanificar):** C01, C02+M13, C03-list (get+list unwrap), C05 typecheck, security tests mínimos, ESM lazy. Deuda viva: EGO-FIND-01 (dumps legacy).

**MCP por defecto en toda task:** `codegraph_explore` (blast radius antes de editar), `detect_changes`, `task_validate_scope`, `task_verify_cmd`, `check_index_coverage`. Skills base: SDP al dispatch + las fijadas por task.

## Protocolo C01/C02 (obligatorio en toda task — destilado de la ejecución real)

1. **Cuestionar la recomendación:** verificar en código + docs antes de aceptar el cómo del reporte. La fuente manda sobre el sketch.
2. **Lectura de verificación:** leer archivos implicados + grep de uso real + docs/backlog (relaciones, decisiones, compuertas) antes de decidir enfoque.
3. **HITL:** ninguna decisión no declarada se asume; o está en docs o se pregunta (contexto + opciones + recomendada).
4. **Blast radius (Regla 0):** inventario completo antes de la primera edición; divergencias se reportan, no se ocultan.
5. **TDD rojo→verde** en lógica nueva; tests que prueban el path real, no el mock.
6. **Dispatch con paquete de 10 bloques** (§6.f); SIN-FORMATO → RESUME.
7. **Verify mecánico del lead** (`verify_cmd`) + revisión del diff + secret-scan si toca keys + rebuild de `dist/` si el paquete lo usa; sin verify no hay commit.
8. **SARL** ante fallos (RESUME → RETRY → STRATEGY → ESCALATE); rate-limit = retry, no estrategia nueva.
9. **Divergencias y deuda** se registran (plan/state/Backlog), nunca se inventan ni se ocultan.
10. **Cierre:** `update_state` con SHA + recitation; push solo con orden explícita.

---

## ÉPICA F1 — Seguridad real (C04, C06, C07, C08, H31, M15, M17)

Relaciones Backlog: `SEC-03`, `SEC-04` (pendientes, no se cambian estados). Docs: `docs/engineering/integraciones.md:103-113` (Keychain, main-only), `AGENTS.md` §Seguridad, `docs/roadmap/roadmap.md` §Fase 11.

### Task 1: SafeStorageBackend real + flags honestos

- **Ruta:** ego-worker
- **Estado:** ⬜ PENDING
- **Contrato:** `pnpm --filter @ego/security test` PASS con backend real mockeado + `typecheck` exit 0

**Files:**
- Modify: `packages/security/src/CredentialManager.ts` (nuevo `SafeStorageBackend` con `import("electron")` dinámico y guarded: si no hay safeStorage disponible, `isAvailable()=false` explícito; `InMemoryCryptoBackend` marcado `@testOnly` con warning; `isHardwareProtected()` delega a `safeStorage.isEncryptionAvailable()` o `false`)
- Create/extend: `packages/security/test/CredentialManager.test.ts` (disponible/no-disponible, round-trip, hardware flag)
- Skills: `test-driven-development`, `doubt-driven-development`
- Verify: suite + typecheck. Prohibido: secretos en fixtures (usar `sk-test-*`).

### Task 2: Cableado del paquete + endurecimiento MCP

- **Ruta:** ego-arch
- **Estado:** ⬜ PENDING
- **Contrato:** `pnpm --filter @ego/security test` + `@ego/integrations test` PASS + `floor-guard.ps1` sin secretos

**Files:**
- Create: `packages/security/src/index.ts` (exporta CredentialManager + backends; cierra C04)
- Modify: `apps/desktop/src/main.ts` (delega cifrado a `@ego/security`, mantiene restore `gov/settings`; elimina duplicación solo donde sea 1:1)
- Modify: `packages/integrations/src/mcp/McpClient.ts` (allowlist de comandos, prohibir `shell:true`, approval para no firmados), `McpManager.ts` (`Result` explícito en vez de estado tragado, token vía Credential Manager, auditar `overrideExisting:true`)
- Modify: `packages/security/src/CredentialManager.ts` (HMAC + versión en export/import vault — M17)
- Skills: `doubt-driven-development`, `test-driven-development`
- Verify: suites + typecheck + secret-scan del diff. Relaciones: `SEC-03`, `SEC-04`, Fase-11.

---

## ÉPICA F2 — Memoria/knowledge restante (M12, H09, H10, H06, H07, H08, M10, M11, M14, M16, L08)

Relaciones Backlog: `KB-07`, `KB-08`, `KB-09`, `KB-10`, `KB-11`, `DOM-03`; `VDB-REQ-06`, `VDB-REQ-07`, `VDB-REQ-04/05` (solo lectura upstream).

### Task 3: Bitemporal completo + HybridSearch real

- **Ruta:** ego-worker
- **Estado:** ⬜ PENDING
- **Contrato:** `pnpm --filter @ego/knowledge test` PASS con `asOf` sobre 250+ registros + `historical` preservado

**Files:**
- Modify: `packages/knowledge/src/BitemporalQueries.ts` (paginación con cursor hasta agotar, preservar `temporalScope historical`, leer `state/is_latest` almacenado — M12)
- Modify: `packages/knowledge/src/HybridSearch.ts` (eliminar fallback silencioso o flag explícito + log; RRF multi-lista real o renombrar a re-rank; preservar score original — H09), `filters/CosineThresholdFilter.ts` (renombrar a ScoreThreshold + calibrar contra BM25 o normalizar — H10)
- Skills: `test-driven-development`
- Verify: suite + typecheck. Docs: actualizar KHOJ-03 donde cite el umbral.

### Task 4: Dominios: schema único + rehidratación + timeline

- **Ruta:** ego-worker
- **Estado:** ⬜ PENDING
- **Contrato:** suites `knowledge,domains,memory` en verde + test cold-reboot por dominio

**Files:**
- Modify: `packages/domains/src/knowledge/KnowledgeDomain.ts` (migrar a `Fact` canónico + `indexFact/adapter.put` — H06), `KnowledgeDomain/CrmDomain/ProductDomain` (load/hydrate desde `adapter.list()` al arrancar; search/get leen VantaDB — H07)
- Modify: `packages/memory/SessionTimelineRewind.ts` (save/loadTimeline vía adapter o documentar efímera — H08)
- Skills: `test-driven-development`
- Verify: suites + cold-reboot test por dominio. Relaciones: `DOM-03`, `KB-11`.

### Task 5: Graph/lifecycle + export/checksum + git/sidecar

- **Ruta:** ego-worker
- **Estado:** ⬜ PENDING
- **Contrato:** suites `knowledge,domains` en verde

**Files:**
- Modify: `ProjectMemoryGraph.ts` (paginar `explainArtifact`, `putMulti+flush` — M10), `FactLifecycle.ts` (desenvolver antes de reinsertar + auditoría — M11)
- Modify: `KnowledgeExport.ts` (checksum canónico + streaming — M14), `WorktreeManager.ts`/`EngineeringDomain.ts` (sanitizar paths/branch + approval HITL — M16), `PythonSidecarBridge.ts` (import.meta, timeout/kill, límite chunks — L08)
- Skills: `test-driven-development`, `doubt-driven-development` (M16)
- Verify: suites + typecheck.

---

### Task F2T6: Gateway memoria — getDb, deps, errores, workarounds

- **Ruta:** ego-worker
- **Estado:** ⬜ PENDING
- **Contrato:** suite `memory` en verde + `pnpm install --frozen-lockfile` limpio en `packages/memory`

**Files:**
- Modify: `packages/memory/EgoMemoryAdapter.ts` (`getDb()`: eliminar o handle read-only + auditar llamadores — H04; `list/delete/searchMulti`: propagar `Result` o log estructurado + test fallo inyectado — M07; citas `// Workaround: VDB-XXX` en put-fallback/cursor/graph/texto-vacío — M09; comentario auto-embed → BM25 puro — M06)
- Modify: `packages/memory/EgoMemoryLifecycle.ts:172` + `docs/engineering/vantadb-readiness-plan.md §2` (corregir auto-embed — M06)
- Modify: `packages/memory/SessionCheckpointPolicy.ts:40` (fail-closed coherente — M08)
- Modify: `packages/memory/package.json` (una dep canónica, fuera `file:`, bloquear wasm + smoke test init — H05/M05)
- Skills: `test-driven-development`, `doubt-driven-development` (H04/M07)
- Verify: suite + typecheck + install limpio. DoD gate 7: cada workaround con ID y registro verificado.
- Relaciones: `CORE-06`, `CORE-08`, `VDB-INC-01`, `VDB-BUG-01`.

## ÉPICA F3 — Core/decision/runtime (H01, H02, H03, M01, M03, M04, M02, L01, L02)
Relaciones Backlog: `DEC-02`, `DEC-03`, `DEC-05`, `DEC-08`, `CORE-03`. Docs: `docs/architecture/jev.md`, `vision-general.md` §Model Router.

### Task 6: Contratos de decisión unificados

- **Ruta:** ego-arch
- **Estado:** ⬜ PENDING
- **Contrato:** suites `decision,execution,runtime` en verde + test de coherencia registry

**Files:**
- Modify: tipos `AdmittedRunContext` (unificar o renombrar Decisión vs Ejecución — H01), `ApprovalDecision` (una fuente en `@ego/execution` — M01), tabla única dominio→subEgo (M03), evento `metrics.turn` al mapa canónico (H03), nombres canónicos de tools en IntentClassifier/DeterministicRules + test contra `registerNativeTools` (H02)
- Skills: `test-driven-development`
- Verify: suites + typecheck.

### Task 7: Higiene models/runtime

- **Ruta:** ego-worker
- **Estado:** ⬜ PENDING
- **Contrato:** suites `models,runtime,execution` en verde

**Files:**
- Modify: `ModelRouter.ts` (warn ante provider ausente — M04), `runtime/src/types.ts` (`ErrorHandler` tipado — M02), deps muertas (`@ego/models` en decision, zod sin uso — L01), `decision/tsconfig` unificar o documentar (L02)
- Skills: `test-driven-development`
- Verify: suites + typecheck.

---

## ÉPICA F4 — Tasks/engine/daily/recovery/ui (H11-H22, M18-M24)

Relaciones Backlog: `TASK-01`, `TASK-07`, `TASK-09`, `DS-01`, `DS-08`, `REC-*`, `CANV-03`.

### Task 8: Motor de tareas correcto

- **Ruta:** ego-engine
- **Estado:** ⬜ PENDING
- **Contrato:** suite `tasks` en verde + test de pause/resume real

**Files:**
- Modify: `WorkerTaskPool.ts` (workers reales o renombrar + timeout que libera slot sin doble conteo — H11/H12), `BackgroundEngine.ts` (pause≠cancelled, hook approval para triggers — H13/H22), `RunRecorder.ts` (`delete` tras persistir — H14), `ProactivityEngine.ts` (globs sin fallback, cron `*/step` canónico — M20/M21), `BackgroundEngine.ts:181` (M23)
- Skills: `test-driven-development`
- Verify: suite + typecheck.

### Task 9: Daily/recovery/ui-runtime

- **Ruta:** ego-worker
- **Estado:** ⬜ PENDING
- **Contrato:** suites `dailystate,recovery,ui-runtime` en verde

**Files:**
- Modify: `DailyStatePersistence.ts` (checksum fail-closed + alerta — H15), `DecisionsFeed.ts` (evento propio — H21), `DailyStateEngine/DecisionsFeed` (helper `parseActorId` común — M24), `recovery/*` (tipar adapter, paginar export, OpGate reset guard — H20/M22), `CanvasBridge.ts` (insert/delete o false — H16), `MockIPCBridge.ts` (modo strict + sin apiKey en claro + zod — H17/H18/H19), `MermaidRenderer.ts` (replaceAll + escape — M18/M19)
- Skills: `test-driven-development`, `doubt-driven-development` (H15/H20)
- Verify: suites + typecheck.

---

## ÉPICA F5 — Desktop (H23-H26, M25-M31, L13-L14)

Relaciones Backlog: `CORE-02`, `INT-02` (superseded), `DIST-01`, `DIST-12`. Docs: `AGENTS.md` §Seguridad/Electron.

### Task 10: Deps VantaDB + sandbox + IPC muerto

- **Ruta:** ego-desktop
- **Estado:** ⬜ PENDING
- **Contrato:** `pnpm --filter @ego/desktop typecheck` + tests IPC en verde + install reproducible en máquina limpia

**Files:**
- Modify: `apps/desktop/package.json` (eliminar `vantadb` WASM si sin import; versionar `vantadb-node`, eliminar `file:` — H23/H24; documentar requisito en readiness-plan), `FloatingWindowPrototype.ts` (`sandbox:true` + preload — H26), `main.ts`+`preload.ts`+`ego.ts` (puentear o eliminar handlers knowledge/decision — H25)
- Skills: `doubt-driven-development`
- Verify: typecheck + tests + `pnpm install --frozen-lockfile` en clon limpio.

### Task 11: Higiene desktop

- **Ruta:** ego-desktop
- **Estado:** ⬜ PENDING
- **Contrato:** typecheck + tests + `pnpm build` exit 0

**Files:**
- Modify: `ipc.ts` (contrato completo o derivado — M25), `preload.ts`+`Window.ego` (M26), `electron-builder.config.cjs` (assets — M27), docs vs electron-vite (M28: alinear docs), Electron ≥36 o ajustar engines (M29 con verificación native modules), renderer build script + tsconfigs (M30/M31)
- Skills: `test-driven-development`
- Verify: typecheck + tests + build.

---

## ÉPICA F6 — Docs/repo + lows (C09, C10, H27-H30, M32, L01-L14)

Relaciones: Backlog roadmap (SIN cambiar Estados; H28 formalización con owner), `AGENTS.md`, CI.

### Task 12: Repo y docs coherentes

- **Ruta:** ego-docs
- **Estado:** ⬜ PENDING
- **Contrato:** CI verde + 0 links rotos en planes + conteos/versiones del Backlog verificados

**Files:**
- Modify: workspace para `tests/` (C09: `tests/**` al workspace o mover a paquete + step CI), links `../../extractions/` en planes + extender `fix_links.py` (C10), `Preguntas y respuestas.txt` vs conteo (H27: restaurar o corregir), compuertas HERM/COUC (H28: cerrar o 🚫 con owner), `ci.yml` frozen+oxlint pin+e2e (H29), DIST-11/12 rewrite (H30), rutas inexistentes/IDs cruzados/scripts huérfanos/test:e2e/fichas (M32)
- Skills: `documentation-and-adrs`
- Verify: CI + `check-agents-refs.ps1` + grep de links. Puerta: H28 solo con owner (BLOQUEO si no responde).

### Task 13: Barrido lows + `any` justificados

- **Ruta:** ego-worker
- **Estado:** ⬜ PENDING
- **Contrato:** `pnpm typecheck` + suites tocadas en verde + 0 `any` sin justificación nueva

**Files:** L03 callId unicidad, L04 ZodLiteral/Date, L05 contextFactory, L06/L07 layout memory/tsconfig, L08 (si no cubierto en T5), L09 excepción contrato documentada, L10 `unknown`+narrowing + `getErrorParts`, L11 dep knowledge/models, L12 heartbeat atómico, L13 tsconfigs, L14 links `file:///`+SEC-06 gates+dots legacy+`obf:` aviso+dev script
- Skills: `test-driven-development`
- Verify: typecheck + suites + grep `any` con justificación.

=== RECITATION F1T1 ===
Campaign ID: 
Objetivo activo: 
Estado: completed
Última acción: Estado actualizado a COMPLETED
Resultado: SafeStorageBackend + flags honestos, 10/10 + typecheck. Commit 75f3691.
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===

=== RECITATION F1T2 ===
Campaign ID: 
Objetivo activo: 
Estado: completed
Última acción: Estado actualizado a COMPLETED
Resultado: Package cableado + MCP endurecido (35/35+20/20), floor verde, mock knowledge-ipc colateral arreglado. Commit 24e7277.
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===

=== RECITATION F2T3 ===
Campaign ID: 
Objetivo activo: 
Estado: completed
Última acción: Estado actualizado a COMPLETED
Resultado: Bitemporal cursor + rerank honesto + threshold, 50/50. Commit 850464d. Restricción F2T6: BitemporalQueries usa getDb() para cursor real.
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===

=== RECITATION F2T4 ===
Campaign ID: 
Objetivo activo: 
Estado: completed
Última acción: Estado actualizado a COMPLETED
Resultado: Schema canónico + hydrate + timeline, suites verdes. Commit 757ce32.
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===

=== RECITATION F2T5 ===
Campaign ID: 
Objetivo activo: 
Estado: completed
Última acción: Estado actualizado a COMPLETED
Resultado: 5 slices, suites 65/65 ambas. Commit 5f1116f.
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===

=== RECITATION F2T6 ===
Campaign ID: 
Objetivo activo: 
Estado: completed
Última acción: Estado actualizado a COMPLETED
Resultado: Gateway restringido + logs + fail-closed + guard deps, 74/74. Commit 8e2be47. Divergencia: file: retenida (sin internet para reemplazo).
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===

=== RECITATION F3T6 ===
Campaign ID: 
Objetivo activo: 
Estado: completed
Última acción: Estado actualizado a COMPLETED
Resultado: Contratos unificados, 36/36/49. Commit 2660da0. Deuda: lockfile sin regen (F3T7).
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===

=== RECITATION F3T7 ===
Campaign ID: 
Objetivo activo: 
Estado: in progress
Última acción: Estado actualizado a IN PROGRESS
Resultado: Inicio F3T7: higiene models/runtime + lockfile
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===
