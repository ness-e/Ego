# Handoff — Ejecución en paralelo del Plan Reparación Integral (2026-10-14)

Plan: `docs/agent-ops/plans/2026-10-14-plan-reparacion-integral-frontend-backend.md` (Tasks 0–11 + verificación).
Decisiones del owner (30): vinculantes, en el plan §Decisiones — **NO re-preguntar lo ya decidido**. Solo Gate V (2 fallas mismo-error) pregunta.

## 1. Lecturas obligatorias (en orden, antes de tocar código)

1. `AGENTS.md` (raíz) — stack, guardrails, terminología Sub-Ego, comandos `pnpm`, prohibición `--force`, Regla Fase Completa.
2. El plan (arriba) COMPLETO — evidencia base + refutados (no re-abrir) + orden de ejecución.
3. `.agents/EGO-OPERATING-MANUAL.md` — índice de fuentes canónicas.
4. `.agents/task-system/prompts/pipeline-run.md` §6.f (dispatch 10 bloques), §7 (waves, MAX_CONCURRENT=3), §h-i (Gates + SARL), §8 (cierre).
5. `.agents/task-system/prompts/pipeline-full.md` §§1-3 (DISCOVERY con Regla 0 + Gate D, ACT con PLAN→ACT→VERIFY, RESULTADO §7).
6. `.agents/task-system/prompts/question-gates.md` — Gates D (antes de ACT) / V (2 fallas) / C (colaterales → `FIND-*`).
7. `.agents/task-system/prompts/subagent-recovery.md` — SARL: RESUME → RETRY → STRATEGY → ESCALATE.
8. Reglas del área por lazy-loading (`.agents/rules/README.md`): electron-ipc (Tasks 1-3), frontend-web (5-8), js-ecosystem (todas), namespaces-jev (4), vantadb-governance (4/9), git-workflow (cierre), definition-of-done (cierre).
9. Task file si existe: `docs/agent-ops/tasks/<ID>.md` — continuar desde el primer step ⬜, nunca rehacer ✅.

## 2. Skills (vía `skill` tool; IDs verificados en `.agents/skills/`)

- Base por tarea: `campaign-executor` (ciclo PLAN/ACT/VERIFY) + `progreso` (al cerrar) + `ponytail` (YAGNI ladder).
- Bug/cableado (Tasks 1-4, 8, 11): `systematic-debugging` — root cause antes de fix; 3 fixes fallidos → cuestionar arquitectura + Gate V.
- Lógica nueva (Tasks 2, 4, 6, 8): `test-driven-development` — failing test primero.
- Seguridad (Tasks 2 HITL/R10b, 3 R5/R8, 11 CSP/R10): `security-and-hardening`.
- Este plan ya está escrito: `writing-plans` solo si hay que re-planificar.

## 3. Herramientas y MCP (entorno OpenCode, Windows pwsh)

- Ficheros: `read` (leer), `edit` (cambios parciales, oldString exacto), `write` (crear), `grep`/`glob` (búsqueda; SIEMPRE después de code intelligence).
- Code intelligence (ANTES que grep): `codegraph_codegraph_explore` (blast radius + fuente), `codebase-memory-mcp_trace_path` (callers/callees), `codebase-memory-mcp_check_index_coverage` (cada archivo citado), `codebase-memory-mcp_detect_changes` (impacto), `codebase-memory-mcp_get_architecture` (contexto). Proyecto: `Ego`.
- `shell` (workdir repo): `pnpm --filter <pkg> typecheck|test`, `pnpm build`, `pnpm build:verify`. **pwsh: NO existe `head`; usar `Select-Object -First N`.**
- `subagent`: `explore` (research read-only: quick/medium) y `general` (ejecución). **MAX 2 en paralelo** (rate-limit tumba 10 en paralelo; los caídos a medias alucinan evidencia — solo vale `file:line` releído).
- `question`: Gate V y Gate C con el owner (opciones + `(Recomendado)` primero).
- `execute` → `tools["agent-system"]`: `catalog_list_agents`, `catalog_list_rules`, `campaign_discover_skills`, `campaign_health_status` (NO hay `campaign_get_next_task/update_task_state/verify_cmd` en este server — el plan file + task files son el estado).
- Playwright MCP (Task 7/10): snapshots + axe visual. VantaDB MCP: solo lectura memoria si hace falta.

## 4. Estructura de ejecución (waves, orden del plan)

Orden vinculante: 1 → 3 → 5 → 6 → 2 (+bloqueo) → 4 → 8 → 7 → 11 → 9 → 10. Task 0 = acción OWNER (no la ejecuta el agente).
Waves (archivos disjuntos verificados con codegraph; resto secuencial):
- W1: Task 1 (preload/ego.ts) + Task 3 (main/ipc) en paralelo (max 2).
- W2: Task 5 (css/main/provider/chat) + Task 4 (hooks/persistence/e2e) en paralelo.
- W3+: Task 6 → 2 → 8 → 7 → 11 → 9 → 10 secuenciales.
FAIL_MODE=stop (orden estricto AGENTS.md §6). 3 fails consecutivos → pausar + `question` al owner.
Por tarea: task file en `docs/agent-ops/tasks/T<N>.md` (Impacto Regla 0 antes del primer edit; steps ~100 líneas; Context Save Point) → ACT → VERIFY (typecheck + tests del paquete + `pnpm build` si toca renderer) → review por agente DISTINTO (segundo subagent o `reviewer`; sin veredicto no hay COMPLETED) → commit local Conventional Commits en inglés + ID (`feat:`/`fix:`/`chore:`/`docs:`) → **NUNCA push** → bloque RESULTADO (`✅/🟡/❌/⚠️`, STEPS_OK, PROXIMO_STEP, COMMIT_HASH, ARCHIVOS, VERIFY_CONTRATO, BLOQUEO, GATES_EVALUADOS, SKILLS_CARGADAS).
Checkpoint: `docs/agent-ops/state/pipeline-state.json` {plan, completed, failed, total, consecutiveFails, lastSync}.
Cierre campaña: `skill progreso` + retrospectiva Start/Stop/Continue + 1 mejora medible en el plan.

## 5. Prohibiciones duras

- NO `pnpm install/rebuild`, NO matar `node.exe`, NO tocar `.bin` (Task 0 = owner; EPERM/antivirus).
- NO `--force` push, NO push sin orden explícita (opencode.jsonc lo exige + AGENTS.md Regla 7).
- NO re-decidir las 30 decisiones; NO re-abrir refutados (§evidencia base); NO `any` nuevo; NO VantaDB en renderer; NO Next.js en desktop.
- NO prompts inline de 7 líneas a subagentes: siempre dispatch 10 bloques (TAREA, ARCHIVOS con `:línea`, DEPENDENCIAS, REFERENCIAS, SKILLS, HERRAMIENTAS+MCP, INV-CÓDIGO, INV-PROBLEMA, INV-INTERNET, VALIDACIÓN+CIERRE) + checklist pre-spawn (cero placeholders, WIP prohibido listado vía `git status`).

## 6. Prompt de apertura (pegar en la sesión nueva)

> Ejecuta el plan `docs/agent-ops/plans/2026-10-14-plan-reparacion-integral-frontend-backend.md` siguiendo el handoff `docs/agent-ops/plans/2026-10-14-handoff-ejecucion-paralela.md`. Lee AGENTS.md, el plan completo y pipeline-run.md §6-8 antes de actuar. Empieza por probes (git status limpio, index health, Task 0 pendiente del owner) y Wave 1 (Task 1 + Task 3 en paralelo, max 2 subagentes). Reporta RESULTADO por tarea y detente ante Gate V.
