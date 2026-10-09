# Ego — Manual de Operación del Sistema (ÍNDICE)

> ⚠️ **DEPRECATED COMO FUENTE DE DETALLE (2026-08-23).** Este documento duplicaba
> ~60% del contenido vivo y divergía de las fuentes canónicas. Ahora es un
> **índice**: cada sección apunta a su fuente única de verdad. No agregues
> detalle acá — editá la fuente canónica.

## Fuentes canónicas por tema

| Tema | Fuente única de verdad |
|------|------------------------|
| Reglas del proyecto, AI Guardian (Reglas 1-11), ritual de sesión, MCP servers, path resolution | `AGENTS.md` (raíz) |
| Ciclo de vida de tarea, plan/task file format, recitation, budget, SARL (resumen) | `.agents/skills/campaign-executor/SKILL.md` |
| North star + reglas invariantes del executor | `.agents/skills/campaign-executor/RULES.md` |
| Ejecución de UNA tarea completa (canónico) | `.agents/task-system/prompts/pipeline-full.md` |
| Orquestación multi-tarea / waves paralelas | `.agents/task-system/prompts/pipeline-run.md` |
| Loop de 1 iteración + state machine C0 (prosa) | `.agents/task-system/prompts/iter-loop-tools.md` |
| Creación de plan desde backlog (triage, pre-mortem, Cynefin) | `.agents/task-system/prompts/plan.md` |
| Formato canónico de filas de backlog (10 columnas) | `.agents/references/backlog-format.md` |
| Question Gates HITL (P/D/V/C) + spec-driven guiado | `.agents/task-system/prompts/question-gates.md` + `prompts/spec-template.md` |
| Recuperación de sub-agentes (RESUME/RETRY/STRATEGY/ESCALATE) | `.agents/task-system/prompts/subagent-recovery.md` |
| State machine C0 enforcement (código, fuente #1) | `.agents/task-system/config/state-tools.mjs` |
| Presupuestos (números únicos) | `BUDGET_LIMITS` en `.agents/task-system/mcp/ego-workflow-server.mjs` |
| Skills: catálogo y carga | `SKILLS-MANIFEST.md` (raíz) + `references/skills-engineering.md` |
| Agents: roles, tabla de límites de tools por rol | `AGENTS.md` § Límites de herramientas por rol |
| MCP servers activos/deshabilitados | `AGENTS.md` § MCP Servers Disponibles + `opencode.jsonc` |
| Inventario completo de MCP tools (por server; nativas vs Code Mode) | `.agents/references/mcp-tools.md` |
| Reglas normativas por área de código (lazy-loading) | `.agents/rules/README.md` + archivo del área |
| Stack técnico y entorno de ejecución | `docs/engineering/stack-tecnico.md` |
| DoD por nivel (task/commit/release) | `.agents/references/definition-of-done.md` |

## Flujos rápidos (resumen de bolsillo)

```
Desarrollo diario:   skill progreso → git status → codegraph → code → verify_changed → commit
Feature completa:    workflow_pipeline plan docs/roadmap/roadmap.md → Gate P → workflow_pipeline run
Bug:                 skill systematic-debugging → repro → fix → verify → commit
Pre-push:            task_verify_cmd "pnpm lint" → push
Una tarea:           workflow_pipeline task <ID> → pipeline-full.md → RESULTADO block
```

## Historial

El contenido detallado anterior (v1) vive en el respaldo `.agents-backup-20261005`
por si necesitás recuperar alguna sección. En Ego la fuente canónica es `AGENTS.md` y `.agents/`.
