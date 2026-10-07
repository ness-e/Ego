# Intel de repos — qué extraer

| Campo | Valor |
| --- | --- |
| Estado | Revisable — URLs verificadas oct-2026 |
| Owner | ness-e |
| Fecha | 2026-10-05 |
| Clones locales | `repos-referencia/` (helmor, khoj, hermes-agent, openclaw, career-ops, deepseek-harness) |

| Repo | Qué extraer |
|---|---|
| rohitg00/awesome-claude-design | `DESIGN.md` por familia + remix recipes; fija monocromo |
| nexu-io/html-anything | Patrón MD→HTML, picker surfaces, export HTML/PNG |
| donnemartin/system-design-primer | Plantillas tradeoff/diagramas para sync/memoria |
| mui/base-ui | Primitivas headless accesibles; estilizar en B/N |
| vercel-labs/agent-skills | Formato `SKILL.md` + reglas react/web/writing |
| assistant-ui/assistant-ui | Thread/Composer/Message/ThreadList + Tool-UI/GenUI/MCP/runtimes |
| obra/superpowers | brainstorm→spec→plan→TDD→subagentes |
| open-webui/open-webui | Memoria persistente, Notes full-context, RAG híbrido, Automations, plugins Pipe/Filter/Tool |
| x1xhlol/system-prompts... | Corpus system-prompts/tool-schemas |
| github/spec-kit | SDD constitution→converge en `.specify/` |
| Leonxlnx/taste-skill | Gate anti-slop |
| lobehub/lobehub | Modelo sesión/topic, agent-market, RAG/TTS/plugins |
| Panniantong/Agent-Reach | Fetch search+read limpio, YouTube-subs, anti-403 |
| shareAI-lab/learn-claude-code | Harness = loop+tools+sandbox; modelo=driver |
| thedaviddias/Front-End-Checklist | 386 reglas QA + MCP server |
| D4Vinci/Scrapling | Scraper anti-bot + Skill para ingesta |
| OpenAI Dots | Referencia externa: patrón de tareas persistentes. Ego utiliza su propia arquitectura de Background Activity & Proactivity. |

## Veredicto assistant-ui

Estilizados para arrancar (`Thread`, `Composer`), primitivas para tool-UI custom
(aprobaciones, visor memoria, renders MCP). No reimplementar Thread/Composer.

## Extracción de clones locales (verificado en `repos-referencia/`)

- **hermes-agent** (gemelo de stack: Electron 40 + React 19 + assistant-ui): `apps/shared` (JSON-RPC gateway + contrato OpenRPC), `apps/desktop/electron` (preload, backend lifecycle, data-paths), `apps/desktop/src` (chat/composer/session stores), `agent/memory_provider.py` + `memory_manager.py` (ABC memoria), `hermes_state_*.py` (sesiones/mensajes/FTS en SQLite).
- **khoj**: `processor/embeddings.py` (gte-small local), `search_type/text_search.py` (coseno+umbral), `text_to_entries.py` (chunks 256 + dedupe), `routers/helpers.py` (search_documents, extract_facts, ai_update_memories), UI chat Next (history/message/input).
- **openclaw**: gateway local + UI cliente WS tonta; `admitted-run-context.ts`; `agent-harness-runtime.ts`; memoria Markdown + SQLite Kysely; proyección de sesión + UI optimista.
- **helmor** (Tauri+React, agentes paralelos): `terminal-output-scheduler.ts` (coalescencia PTY), `use-ui-sync-bridge` (sin listen ad-hoc).
- **career-ops**: `DATA_CONTRACT.md` (User vs System) + escrituras atómicas con lock (plantilla cuarentena).
- **deepseek-harness**: sesiones versionadas, ids opacos, migraciones sin borrado (base supersede).
