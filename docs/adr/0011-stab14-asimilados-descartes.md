# ADR 0011: STAB-14 — patrones asimilados sin duplicar + descartes justificados #

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-16 |
| Estado | Aceptado |
| Nivel jerárquico | 4.Architecture (`docs/jerarquia-canonica.md`) |

## Contexto ##

Compuertas Opción B STAB-14 (`docs/extractions/*.md` + `docs/review/backlog-*.md`).
Varios patrones del contrato ya existían implementados y verificados en rutas
distintas a las nominales del contrato. Duplicarlos habría creado doble fuente
de verdad. Otros candidatos violan guardrails (`AGENTS.md` §4).

## Decisión — ASIMILAR (no tocar, suites verdes re-verificadas) ##

- AttentionStateMachine → `packages/runtime/src/AttentionStateMachine.ts`
  (variante isla `hidden/compact/expanded/alert/hitl_approval` + `ISLA_TIMING`;
  NO se crea segunda FSM en dailystate; suite runtime 73/73).
- SafeConfigMutation + fingerprint CAS → `packages/execution/src/SafeConfigMutation.ts`
  (`fingerprintOriginal/New` + `confirm` + anti-race en disco; suite execution 42/42).
- AdaptiveChunker 256/overlap/`headingPath`/SHA-256/dedup →
  `packages/knowledge/src/ingest/AdaptiveChunker.ts` (ruta `ingest/`, no `chunking/`;
  suite knowledge 67/67).
- FileLockManager wx+backoff×1.5+PID+stale →
  `packages/tools/src/native/fs/FileLockManager.ts` (suite tools 64/64).
- NetPolicy SSRF canónico → `packages/tools/src/native/security/NetPolicy.ts`
  (verificado; ADR-0010 añade solo la frontera en security).

## Decisión — DESCARTAR (🚫 con fundamento, backlog-format §3) ##

- 🚫 Python/SQLite/FastAPI/pgvector/embeddings Python — guardrail AGENTS §4
  (runtime Node 22 + VantaDB nativo); solo algoritmos reimplementados en TS.
- 🚫 ATS/empleos/CVs/schemas career-ops — contaminación de dominio ajeno.
- 🚫 Scrapers/telecom/voz externa — fuera del alcance SOC.
- 🚫 Tauri/Bun/SwiftUI/HookServer runtime/notch — desktop es Electron 33.
- 🚫 Sockets WS internos coucou bridge — EventBus + IPC tipado son la vía.
- 🚫 `ActivityItem.payloadRef` como símbolo nuevo — no existe `ActivityItem`;
  el `payloadRef` vive en `ChangeSet` (ADR-0009, ponytail).

## Consecuencias ##

- Positivas: cero duplicación; suites preexistentes como evidencia mecánica.
- Negativas: rutas reales difieren de las nominales del contrato
  (`ingest/` vs `chunking/`, `execution/` vs `integrations/`, `runtime/` vs
  `dailystate/`) — esta ADR es el mapa canónico.
- Riesgos: deuda typecheck `noUncheckedIndexedAccess` preexistente en
  `tasks/ProactivityEngine/TaskCheckpoint`, `security/ToolPermissions`,
  `tools/ChangeSetService/GitParser/NetPolicy` (archivos no tocados por
  STAB-14; ningún error en archivos nuevos) → FIND follow-up, no bloquea
  (tests verdes en 6 paquetes).

## Referencias ##

- `docs/agent-ops/tasks/STAB-14.md` (tabla Compuertas Opción B).
- Suites: runtime 73, execution 42, knowledge 67, tools 64, events 38, tasks 63, security 95.
