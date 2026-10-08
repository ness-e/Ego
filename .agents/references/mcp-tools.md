# MCP Tools — Inventario canónico y reglas de uso

> **Fuente de verdad de servers:** `opencode.jsonc` (proyecto) + `%USERPROFILE%\.config\opencode\opencode.json` (global). Estado en vivo: `opencode mcp list`.
> **Última verificación:** 2026-09-28 — limpieza de MCPs de búsqueda: los 3 servidores vivos (`metasearch`, `websearch`, `argus`) se consolidaron en el **config global**; se eliminaron `metasearchmcp` (duplicado), `agent-search` (degradado) y `firecrawl` (sin key). Verificado funcionalmente con llamadas reales, no solo por declaración de config.
> 2026-09-27 — fix de discoverability para sub-agentes: `codegraph` y `codebase-memory-mcp` pasaron a **tools nativas** (`codemode: false` en `opencode.jsonc`). Antes vivían en Code Mode y los agentes no las veían → caían a grep.

## 1. Modos de acceso (OpenCode V2)

| Modo | Cómo se llama | Servers |
|---|---|---|
| **Nativo** | Llamada directa por nombre exacto: `codegraph_codegraph_explore(...)` — la tool aparece en el toolset del agente | `codegraph` · `codebase-memory-mcp` |
| **Code Mode** | Vía `execute`: `tools.<server>.<tool>(...)` (o `tools["<server>"]["<tool>"]`) | `campaign` · `notion` · `browser` · `Ego` · `metasearch` · `websearch` · `argus` · `opencode` · loop-goal |

Regla práctica: **si la tool está en tu toolset → llamala directo. Si no aparece → vive en Code Mode: usá `execute`.**
`codemode: false` en `opencode.jsonc` = tool nativa; `codemode: true` (default) = solo vía `execute`. Exponer nativo consume contexto del prompt — usarlo con moderación.

## 2. Búsqueda de código — orden OBLIGATORIO (antes de grep/read)

| # | Tool | Para qué |
|---|---|---|
| 1 | `codegraph_codegraph_explore(query)` | **PRIMERA opción**: source verbatim + call paths + blast radius en 1 llamada (Read-equivalent). |
| 2 | `codebase-memory-mcp_search_graph` | Búsqueda BM25/semántica sobre el grafo (todo el repo; bridge de vocabulario). |
| 3 | `codebase-memory-mcp_trace_path` | Callers/callees transitivos (inbound/outbound), data flow, cross-service. |
| 4 | `codebase-memory-mcp_get_code_snippet` | Source exacto de un símbolo (tras `search_graph`). |
| 5 | `codebase-memory-mcp_query_graph` | Cypher: multi-hop, complejidad, hot paths, ciclos, grafo "missed". |
| 6 | `codebase-memory-mcp_get_architecture` | Overview, clusters (Leiden), hotspots, boundaries, layers, cycles. |
| 7 | `codebase-memory-mcp_detect_changes` | Blast radius de un diff vs branch — pre-commit/PR. |
| 8 | `codebase-memory-mcp_search_code` | Grep aumentado por grafo (patrones textuales con ranking estructural). |
| 9 | `codebase-memory-mcp_index_status` / `check_index_coverage` | Health del índice / cobertura por archivo (antes de confiar en el grafo). |
| 10 | `grep` / `read` | **SOLO fallback**: configs, docs, archivos no indexados, o confirmar un detalle puntual. |

- Project id codebase-memory: `C-Users-Eros-Ego-Proyect-Ego`.
- Al usar cualquiera de estas tools → cargar la skill `codebase-memory` (mantenimiento automático de ambos grafos).

## 3. Inventario — tools NATIVAS (llamada directa)

**codegraph (1):**
- `codegraph_codegraph_explore` — source + call paths + blast radius; Read-equivalent (confiar, no re-verificar con grep).

**codebase-memory-mcp (15)** — prefijo `codebase-memory-mcp_`:
- `search_graph` · `trace_path` · `get_code_snippet` · `get_architecture` · `query_graph` · `search_code` · `detect_changes` · `index_status` · `check_index_coverage` · `get_graph_schema` · `index_repository` · `ingest_traces` · `list_projects` · `manage_adr` · `delete_project`

## 4. Inventario — Code Mode (via `execute` → `tools.<server>.<tool>`)

**campaign (38):** `campaign_analyze_task` · `campaign_backlog_dedup` · `campaign_budget_consume` · `campaign_budget_reset` · `campaign_budget_status` · `campaign_classify_workflow` · `campaign_detect_task_type` · `campaign_discover_skills` · `campaign_discover_skills_v2` · `campaign_emit_event` · `campaign_enforce_state` · `campaign_eval_summary` · `campaign_get_active_model` · `campaign_get_next_task` · `campaign_get_state_allowed_tools` · `campaign_get_task_detail` · `campaign_get_workflow` · `campaign_health_status` · `campaign_load_skills` · `campaign_memory_read` · `campaign_memory_write` · `campaign_model_list` · `campaign_model_traits` · `campaign_mom_escalate` · `campaign_plan_lock_info` · `campaign_reconstruct_context` · `campaign_run_sandboxed` · `campaign_session_track` · `campaign_set_model` · `campaign_stalled_tasks` · `campaign_state_snapshot` · `campaign_update_task_state` · `campaign_validate_action` · `campaign_validate_bash_write` · `campaign_validate_command` · `campaign_validate_output` · `campaign_validate_scope` · `campaign_verify_cmd`

**Ego (87):** `audit_text_index` · `bulk_import_file` · `bulk_import_stream` · `capabilities` · `code_callees` · `code_callers` · `code_explore` · `code_files` · `code_impact` · `code_node` · `code_search` · `code_status` · `collection_delete` · `collection_list` · `collection_stats` · `compact_layout` · `compact_wal` · `context_assemble` · `delete_axiom` · `dream_consolidate` · `dream_discard` · `dream_list` · `dream_load` · `dream_promote` · `embed_texts` · `export` · `flush` · `generate_snippet` · `get_node_neighbors` · `graph_degree_centrality` · `graph_is_dag` · `graph_page_rank` · `graph_topological_sort` · `graph_traverse` · `import` · `inject_context` · `list_snapshots` · `memory_delete` · `memory_delete_by_filter` · `memory_get` · `memory_list` · `memory_list_namespaces` · `memory_put` · `memory_put_batch` · `memory_recall` · `memory_search` · `memory_supersede` · `memory_versions` · `purge_expired` · `query_iql` · `read_axioms` · `rebuild_index` · `rehydrate` · `remove_edge` · `repair_text_index` · `scene_edit` · `scene_list` · `scene_query` · `scene_read` · `scene_write` · `search_memory` · `search_multi` · `search_semantic` · `search_with_method` · `skill_create` · `skill_extract` · `skill_files_write` · `skill_list` · `skill_patch` · `skill_update` · `skill_view` · `snapshot_create` · `snapshot_restore` · `thread_create` · `thread_delete` · `thread_get` · `thread_list` · `thread_purge_expired` · `thread_send` · `vacuum` · `wiki_graph` · `wiki_ingest` · `wiki_ingest_status` · `wiki_list` · `wiki_read` · `wiki_search` · `write_axiom`

**notion (45):** `notion-ai-search` · `notion-check-mcp-next-steps` · `notion-convert-page-to-skill` · `notion-create-attachment` · `notion-create-comment` · `notion-create-database` · `notion-create-file-upload` · `notion-create-folder` · `notion-create-pages` · `notion-create-view` · `notion-download-attachment` · `notion-download-skill` · `notion-duplicate-page` · `notion-fetch` · `notion-get-async-task` · `notion-get-comments` · `notion-get-session-status` · `notion-get-teams` · `notion-get-tool-access` · `notion-get-users` · `notion-list-favorite-pages` · `notion-list-private-pages` · `notion-list-recent-pages` · `notion-list-session-events` · `notion-list-shared-pages` · `notion-move-pages` · `notion-query-data-sources` · `notion-query-meeting-notes` · `notion-query-multiple-data-sources` · `notion-query-sessions` · `notion-read-session-event` · `notion-search` · `notion-search-agents` · `notion-search-sessions` · `notion-search-skills` · `notion-send-message-to-session` · `notion-show-advanced-analysis-next-steps` · `notion-spawn-session` · `notion-stop-session` · `notion-update-data-source` · `notion-update-folder` · `notion-update-page` · `notion-update-view` · `notion-upload-skill` · `notion-wait-session`

**browser (45):** `back` · `check` · `click` · `console` · `cpu.analyze` · `cpu.start` · `cpu.stop` · `dialog` · `drag` · `evaluate` · `files.drop` · `files.get` · `files.list` · `files.upload` · `fill` · `fill_form` · `find` · `forward` · `frames` · `heap.compare` · `heap.object` · `heap.query` · `heap.snapshot` · `heap.summary` · `hover` · `lighthouse` · `navigate` · `network.get` · `network.list` · `press` · `preview` · `reload` · `screenshot` · `scroll` · `select` · `snapshot` · `stop` · `tabs.close` · `tabs.focus` · `tabs.list` · `tabs.open` · `trace.analyze` · `trace.start` · `trace.stop` · `wait`

**argus (13):** `argus_paths` · `build_research_pack` (param `topic`) · `capture_site` · `cookie_health` · `expand_links` · `extract_content` · `recover_dead_article` · `recover_url` · `search_budgets` · `search_health` · `search_web` · `test_provider` · `valyu_answer`
> Su valor real es **`extract_content`** (URL → markdown vía jina/playwright) y **`recover_url`** (Wayback).
> `search_web` está crippled: de 14 providers solo `yahoo` y `github` responden; brave/serper/tavily/exa
> están `DISABLED (config)` y duckduckgo en `MISSING KEY` — los budgets que reporta `search_budgets`
> (brave 2000, serper 2500, tavily 1000, exa 1000) no son gastables hasta habilitar esos providers.

**metasearch (14)** — server canónico de búsqueda, config global:
`compare_engines` · `list_providers` · `provider_health` · `search_academic` · `search_bio` · `search_code` · `search_finance` · `search_github` · `search_google` · `search_images` · `search_news` · `search_social` · `search_videos` · `search_web`
> Keyless, ~1700 providers (web, GitHub, crates, npm, PyPI, arXiv, CrossRef, news, imágenes, video).
> Cubre todo lo que el viejo `metasearchmcp` (7 tools) cubría — ese era un duplicado del mismo paquete.

**websearch (6)** — config global, prefijo `websearch_`:
`search` (multi-engine: DuckDuckGO, Bing, Brave, Startpage, Sogou, Baidu, CSDN, Juejin; `searchMode`: auto|request|playwright) · `fetchWebContent` (URL → markdown, con readability + links) · `fetchCsdnArticle` · `fetchGithubReadme` · `fetchJuejinArticle` · `fetchLinuxDoArticle`
> Capa keyless de arranque. `fetchWebContent` cubre en un 70% lo que hacía falta firecrawl.

**Removidos 2026-09-28:** `agent-search` (6/9 adapters en `bot_challenge`; resultados residuales de wikipedia/wiby) · `firecrawl` (sin `FIRECRAWL_API_KEY` → todas las tools devuelven `Anonymous keyless access is unavailable`) · `metasearchmcp` (duplicado de `metasearch`).

**opencode (5):** `list_mcp_resources` · `models` · `read_mcp_resource` · `session_move` · `session_rename`

## 5. Cuándo usar cada grupo

- **code search (código del repo)** → §2. Nunca grep-loop si codegraph responde.
- **web research** → cascada del skill `coordinated-web-search`: websearch (keyless) → metasearch (multi-provider) → argus (`extract_content` / `recover_url`).
- **task system** → `campaign_*` (estado de tareas, verify, skills, budgets). Ver `.agents/references/task-system.md`.
- **memoria persistente / wiki / threads** → `Ego_*` (política recall-first del skill `Ego`).
- **verificación visual / browser real** → `browser_*` (screenshots, lighthouse, network, heap).
- **documentación compartida** → `notion_*`.
- **sesiones/modelos** → `opencode_*`.

## 6. Mantenimiento

- Cambió un server en `opencode.jsonc` → actualizar este archivo (mismo commit).
- Regenerar inventario: `opencode mcp list` + en `execute`: `search({namespace:"<server>"})` por server.
- Deshabilitados por default (no cargan tools): `cargo-mcp`, `rust-analyzer-mcp`, `rust-mcp-server`, `semgrep`, `lottiefiles-creator` (Rust → terminal; ver `.agents/AGENTS.md` §Rust MCP Servers).
- **Remotos `enabled: false`:** `tavily` y `exa`. Búsqueda para LLMs y búsqueda semántica respectivamente; ambos exigen API key. **No los actives como servers sueltos** — ya están integrados como providers dentro de `argus` (con budget tracking + fusión RRF). Habilítalos en la config de argus.
