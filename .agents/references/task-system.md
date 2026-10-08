# Task System Integration

A single shared reference for how every Ego agent integrates with the task-system and MCP servers. Previously duplicated verbatim as §7 in each `.agents/agents/ego-*.md` — consolidated here (P19/R10) so the task-system contract lives in one place. Each agent's `§7` is now a one-line pointer to this file.

## Task System

- **Prompts activos:** `.agents/task-system/prompts/` — plan.md, task.md, iter-loop-tools.md
- **MCP tools:** `campaign_get_next_task`, `campaign_verify_cmd`, `campaign_discover_skills_v2`, `campaign_detect_task_type`, `campaign_validate_command`, `campaign_enforce_state` (30+ tools via campaign-server.mjs)
- **State machine:** C0 en `.agents/task-system/prompts/iter-loop-tools.md` (PLAN→ACT→VERIFY→COLLATERAL→EVALUATE→REVIEW→ACCEPT→CLOSE)
- **Workflows por tipo:** `.agents/task-system/workflows/bug-fix.json`, `feature-add.json`, `refactor.json`, `research.json`, `nine-second-saloon.json`
- **Enforcement:** `.agents/task-system/config/state-tools.mjs` — per-state tool allow/deny + pre-call checks
- **Sesión:** `campaign_session_track` (MCP) para tracking multi-iteración

## MCP Servers — tabla canónica

La tabla canónica es la de **ego-lead** (P19/R10). Corrige el drift previo donde agentes marcaban los mismos servers con ✅/❌ distintos (p. ej. ego-chaos marcaba metasearch ✅ vs ego-audit ❌ — la canónica es ✅). El enforcement real de cada agente vive en su bloque `permission:` del frontmatter, alineado con esta tabla (P19/R9).

| Server | ¿Usar? | Propósito |
|--------|--------|-----------|
| **codegraph** | ✅ | Code intelligence — resolver símbolos, call paths, blast radius (tool nativa `codegraph_codegraph_explore`) |
| **codebase-memory-mcp** | ✅ | Code intelligence — grafo semántico, arquitectura, impacto, complejidad (tools nativas `codebase-memory-mcp_*`; inventario: `.agents/references/mcp-tools.md`) |
| **campaign** | ✅ | Task system — get_next_task, update_task_state, verify_cmd |
| **cargo-mcp** | ❌ | Rust build/test (no relevante — lead orquesta, no compila) |
| **rust-analyzer-mcp** | ❌ | LSP (no relevante para lead) |
| **metasearch** | ✅ | Web search multi-provider |
| **argus** | ✅ | URL content extraction + recovery |
| **playwright** | ❌ | Browser automation (no relevante para este agente) |
| **pencil** | ❌ | Design editor (no relevante para este agente) |
| **discord** | ❌ | Social integration (no relevante para este agente) |
| **lottiefiles-creator** | ❌ | Lottie animation (no relevante para este agente) |

> **Nota:** OpenCode no soporta filtrado nativo de MCP por agente. Usa solo los servidores marcados como ✅; ignora (no invoques) los marcados como ❌ para ahorrar contexto.

## Excepciones por agente (permission blocks, R9)

La tabla canónica es la referencia general. Las excepciones reales, ya aplicadas en cada bloque `permission:`:

| Agente | cargo-mcp | rust-analyzer-mcp | metasearch | argus | pencil |
|--------|:---------:|:-----------------:|:-------------:|:-----:|:------:|
| ego-lead | ❌ | ❌ | ✅ | ✅ | ❌ |
| ego-worker | ✅ | ✅ | ✅ | ❌ | ❌ |
| ego-arch | ✅ | ✅ | ✅ | ✅ | ❌ |
| ego-review | ✅ | ✅ | ✅ | ✅ | ❌ |
| ego-audit | ✅ | ✅ | ❌ | ❌ | ❌ |
| ego-docs | ❌ | ❌ | ✅ | ✅ | ✅ (if designing) |
| ego-engine | ✅ | ✅ | ❌ | ❌ | ❌ |
| ego-tuner | ✅ | ✅ | ❌ | ❌ | ❌ |
| ego-chaos | ✅ | ❌ | ✅ | ❌ | ❌ |

playwright, discord y lottiefiles-creator están ❌ (deny) en los 9 agentes. Los servers ❌ con `allow` explícito previo fueron cambiados a `deny` (R9); los no listados en el permission block quedan bloqueados por el default de subagent.