# Plan A8 — Contraste con el documento maestro (22 secciones) y plan de cierre

**Agente:** A8 (sesión `ses_ea9e4f315ffeu3tvSJNKIJHi4q`) · **Persona:** `.opencode/agents/ego-arch.md`
**Zona exclusiva:** `docs/research/arquitectura-master-matrix.md` (nuevo), `docs/research/Arquitectura y Diseño de Sistemas para Plataformas y Agentes de IA.md`, `Arquitectura y Diseño de Sistemas para Plataformas y Agentes de IA.md` (raíz → eliminar), `docs/agent-ops/plans/2026-10-19-remediation-wave1/**` (coordinación)
**Prohibido:** `packages/**`, `apps/**`, `tests/**`, resto de `docs/**`

## Objetivo

Ser **el árbitro de la verdad** sobre el contraste entre el documento maestro de 22 secciones y el código de Ego, y producir el plan de cierre de la Ola 2. Tu entregable principal es **la matriz**, no código.

## Contexto crítico

El documento maestro **no es una especificación de Ego**: describe una plataforma cloud omnicanal con Tauri v2, daemon 24/7, PostgreSQL/pgvector/Qdrant, MicroVMs Firecracker, WebRTC, SSR y omnicanal de mensajería — la mayoría **descartada formalmente por `docs/adr/0011-stab14-asimilados-descartes.md`** y por los 10 principios innegociables.

**Medir "alineación" contra las 22 secciones completas infla la nota.** La cifra honesta tiene dos cortes: bruto (todo el doc) y adaptada (el subconjunto que Ego decidió adoptar). Tu estimación defendible: **~43 % bruto / ~57 % contra el alcance adaptado**. Las cifras previas (51 %, 68 %) son sobreestimaciones.

## Tareas

### T1 — Consolidar el documento maestro duplicado (`EGO-FIND-79`)
- `Arquitectura y Diseño de Sistemas para Plataformas y Agentes de IA.md` existe en **dos** sitios con **MD5 idéntico** (`9834F842683C71916BD25A22613C3BF5`): raíz del repo y `docs/research/`. Ambos **sin trackear** en git (`git log --all -- "*Arquitectura*"` → vacío).
- **Elimina la copia de la raíz** (conserva `docs/research/`). Es tu zona.
- Añade al inicio del documento conservado un **encabezado de estado**:
  ```
  > **Estado: research externo — NO normativo.**
  > Describe una plataforma cloud omnicanal (Tauri v2, daemon 24/7, Postgres/pgvector/Qdrant,
  > MicroVMs, omnicanal). Es material de referencia para contraste, NO una especificación de Ego.
  > Los requisitos en conflicto frontal con los principios innegociables de Ego están
  > formalmente descartados en `docs/adr/0011-stab14-asimilados-descartes.md`.
  > Matriz de contraste vigente: `docs/research/arquitectura-master-matrix.md`.
  ```
- No reescribas el contenido del documento maestro: es referencia externa. **Anótalo**, no lo reformatees.

### T2 — La matriz de 22 secciones (tu entregable principal)
Crea `docs/research/arquitectura-master-matrix.md` con una fila por sección:
| # | Sección | Estado | Evidencia (archivo:línea) | Conflicto con ADR-0011 | Tarea que lo cierra | Bloque |

Estados: `✅ Implementado` · `🟡 Parcial` · `❌ Ausente` · `🚫 Descartado por decisión` · `➖ No aplica (desktop local-first)`.

**Re-verifica el estado ACTUAL** (la ola está cambiando el código en paralelo; marca la fecha de verificación y usa `EGO-FIND-xx` para los que se estén cerrando):
1. Taxonomía de referentes → ➖ (descriptivo)
2. Componentes esenciales (Router/CoALA/Sandbox/MCP) → 🟡
3. Capacidades funcionales core (ReAct, self-healing, proactividad, fan-out) → 🟡
4. Integraciones y Skills (MCP, GitHub, PTY, watchers, omnicanal) → 🟡
5. UX/UI (Canvas dual, inspector, HITL, voz, daemon) → 🟡
6. Internal Tooling Suite (fs/git/terminal, browser, Python REPL, exportadores) → 🟡
7. Entregables de producción (PDF/DOCX/XLSX/PPTX) → ❌
8. Configuración, políticas y gobernanza (permisos, credenciales, secret proxy) → 🟡
9. System Design (6 capas) → 🟡
10. Multi-agente (5 patrones) → 🟡
11. Seguridad agéntica / inyecciones indirectas (dual-LLM, taint) → ❌ **la única ausente NO descartada**
12. Observabilidad / evals (OTel, benchmarks) → 🟡
13. Costes y latencia (prompt caching, model cascading) → 🟡
14. Sandboxes en la nube → 🚫
15. Distribución / empaquetado / monetización → 🟡
16. Roadmap en 4 fases → 🟡
17. UX research / IA de 3 zonas → 🟡
18. Identidad visual / OKLCH / tipografía → 🟡
19. Maquetación / responsive / microinteracciones → 🟡
20. Componentes / estado / routing (CRDT, deep linking) → 🟡
21. APIs tiempo real / seguridad frontend / 60-120 FPS → 🟡
22. Accesibilidad WCAG 2.2 / pirámide de tests → 🟡

### T3 — Re-verificar las 23 afirmaciones del informe previo
Tu auditoría anterior validó/refutó 23 afirmaciones. **Re-verifica las que la ola está tocando** y registra el cambio de estado:
- GraphRAG: el `adapter.get()` es real (✅ `1532e38`), pero el **descubrimiento de la arista** sigue heurístico (metadata+regex) → A2 lo arregla (T4).
- DreamConsolidator: paginación real ✅, pero **la clase no se instancia** → A3 lo cablea (T10).
- ContextCompaction: **código muerto** → A2 lo cablea (T1).
- Chat virtualizado: `Virtualizer` + `MessageByIndex` → **crash reproducido** → A4 lo arregla (T1).
- `<select>` nativos: 7 vivos → A4 (T5).
- 44 px: parcial → A4 (T5).
- HybridSearch/MMR: decorativo → A2 (T3).
- Sanitizador: 7 regex y **no neutraliza lo que detecta** → A2 (T5).
- `query_vector: []`: **workaround upstream registrado** (`VDB-REQ-02`), no un bug → mantenlo como tal.
- God files: `main.ts` 5 401 y `ego-chat.tsx` 2 067 → A4 (T11).
- Terminal: solo denylist → A3 (T3).
- Secret proxy: el token real viaja al subproceso MCP → A3 (T3).
- `ZeroContextKernel`: **vive en `packages/execution/`, no en `packages/tools/src/sandbox/`** → corrige la afirmación.
- "Select usa Radix": **FALSO** → es custom; A4 decide.
- "Se eliminaron los selects nativos": **FALSO**.
- "44px aplicado": **FALSO**.
- E2E: 12 de 13 specs skipados → A7 (T4).
- DIST-04/06/09: siguen pendientes (bloqueo owner).

### T4 — Brechas nuevas: confirma o refuta
Verifica estas 13 brechas que tu auditoría previa detectó y nadie ha mencionado:
B1 crash del chat · B2 compactación muerta · B3 dream muerto · B4 E2E muerta · B5 6 hallazgos AA vivos · B6 el sanitizador no neutraliza lo que detecta · B7 dream trunca en silencio · B8 7 selects nativos · B9 sin DOMPurify/CSP `img-src` · B10 sin `cache_control` · B11 sin `expand_tools` · B12 sin time-travel en el checkpointer · B13 sin `@container`/`prefers-contrast`.
- Para cada una: `Confirmada` / `Refutada` / `Parcial` + evidencia **actual** + qué agente la cierra.

### T5 — Conflictos documento ↔ principios/ADR
Tabla explícita de qué requisitos del documento **están formalmente descartados** (Tauri, daemon, omnicanal, Postgres/Neo4j/Qdrant, MicroVM, LangGraph/Temporal/Pydantic-AI/LiteLLM, SSR/RSC, SQLite-WASM en renderer, nivel 4 de permisos, sandboxes cloud) y cuáles **NO lo están** y por tanto son brecha real (dual-LLM + taint §11.2, secret proxy §8.3, DOMPurify+CSP §21.2, sandbox real §2.3).

### T6 — Plan de cierre: Ola 2 (Bloque E)
Produce la lista priorizada de lo que queda tras la Ola 1, con:
- Capacidad, sección del doc, evidencia de que sigue ausente, esfuerzo, dependencia.
- Orden recomendado respetando `AGENTS.md` §6 (progresión estricta por fases) y el principio de "una fase completa antes de la siguiente".
- **Distingue**: (a) lo que es deuda técnica de Ego (arreglar ya), (b) lo que exige capacidad nueva (una fase propia con su ficha de extracción), (c) lo que está descartado y no vuelve.

### T7 — Coordinar el contrato de la ola
- Eres el **guardián del contrato** `docs/agent-ops/plans/2026-10-19-remediation-wave1/README.md`: si un agente reporta en su handoff que necesita un fichero fuera de su zona, **recíbelo y reasígnalo** (tú puedes editar `docs/agent-ops/plans/**`).
- Al final de la ola, produce `docs/agent-ops/plans/2026-10-19-remediation-wave1/VERDICT.md` con: matriz final, qué se cerró, qué queda, y la lista consolidada de commits pendientes (el orquestador commitea).

## DoD específico

- `docs/research/arquitectura-master-matrix.md` existe con las 22 filas, cada una con evidencia `archivo:línea` verificable y fecha de verificación.
- La copia de la raíz del documento maestro está eliminada; la de `docs/research/` tiene el encabezado de estado.
- 0 afirmaciones sin re-verificar: cada una marcada `Confirmada` / `Refutada` / `Parcial` con evidencia actual.
- El contraste con ADR-0011 está explícito (qué es brecha y qué es decisión).
- `VERDICT.md` con la matriz final y la lista de commits pendientes.

## Handoff

`docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A8.md`
Incluye: la matriz final y las reasignaciones de ficheros entre agentes.
