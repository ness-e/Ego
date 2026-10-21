# ADR 0011: STAB-14 — asimilación sin duplicar + descartes justificados #

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-16 |
| Estado | Aceptado |
| Nivel jerárquico | 4.Architecture (`docs/jerarquia-canonica.md`) |

## Contexto ##

Compuertas Opción B STAB-14 (`docs/extractions/*.md` + `docs/review/backlog-*.md`).
Varios patrones del contrato ya existían implementados y verificados en rutas
distintas a las nominales del contrato. Duplicarlos habría creado doble fuente
de verdad. Otros candidatos violan guardrails (`AGENTS.md` §4) o contradicen
decisiones de nivel superior.

Esta ADR es el **mapa canónico de asimilados y descartes** de la compuerta
STAB-14: qué patrón se reusa, dónde vive realmente, y qué patrón se descarta
con su fundamento.

## Alternativas consideradas ##

- **Asimilar (reutilizar la implementación existente tal cual)** — elegida para
  5 patrones. Evita doble fuente de verdad y hereda las suites ya verdes como
  evidencia mecánica.
- **Adaptar (reimplementar siguiendo el contrato nominal)** — elegida cuando la
  implementación existente no cubre el contrato. Coste: duplicación.
- **Descartar con fundamento** — elegida cuando el patrón viola un guardrail
  de `AGENTS.md` §4 o contamina el dominio del producto.
- **Dejar en limbo (sin veredicto)** — **descartada**: `AGENTS.md` §4 prohíbe
  dejar tareas en el limbo; toda compuerta cierra con asimilación, adaptación o
  descarte justificado.

## Decisión — ASIMILAR (no tocar, suites verdes re-verificadas) ##

- AttentionStateMachine → `packages/runtime/src/AttentionStateMachine.ts`
  (variante isla `hidden/compact/expanded/alert/hitl_approval` + `ISLA_TIMING`;
  NO se crea segunda FSM en dailystate; suite runtime 73/73).
- SafeConfigMutation + fingerprint CAS → **retirado el 2026-10-21** (A2-bis: era código
  muerto, sin caller de producción). El patrón vive **inline** en
  `packages/integrations/src/mcp/McpClient.ts:97,218,234-243` (compuerta COUC-10:
  recarga atómica con **rollback transaccional**).
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

- `docs/agent-ops/tasks/archive/STAB-14.md` (tabla Compuertas Opción B).
- Suites: runtime 73, execution 42, knowledge 67, tools 64, events 38, tasks 63, security 95.
- `AGENTS.md` §4 (Estado formal de descarte técnico).
