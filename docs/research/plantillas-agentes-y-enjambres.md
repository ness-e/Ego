# Plantillas de agentes, roles, enjambres y sistemas de skills, plugins y marketplaces #

| Campo | Valor |
|---|---|
| Estado | Activo — Investigación técnica de estado del arte (no normativo) |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Alcance | Sistemas de plantilla, catálogo, publicación, versionado, detección e importación de definiciones de agente en el ecosistema 2026 |
| Método | Lectura directa de repositorios y documentación oficial + API de GitHub y `ungh.cc` para estrellas, fecha de push y licencia |
| Naturaleza | Vía 2 del protocolo de extracción — sólo investigación y propuesta; no implementa ni modifica el Backlog Maestro |

> **Nada de este documento es normativo.** `docs/research/` es material de referencia.
> Lo que gobierna el producto son [`docs/jerarquia-canonica.md`](../jerarquia-canonica.md),
> [`docs/product/principios-innegociables.md`](../product/principios-innegociables.md) y los ADR.
> Este informe **propone**; el owner **decide**.

---

## 1. Resumen ejecutivo ##

1. **Existe un estándar de facto para "skills" y otro para "contexto de repositorio", pero ninguno para "plantilla de
   agente completo".** El
   estándar Agent Skills (`SKILL.md`) define sólo *qué hacer* (instrucciones + recursos), no *quién es* el agente.
   `AGENTS.md` define contexto
   de repositorio, no identidad de agente. Nadie ha estandarizado el manifiesto completo de un agente (identidad + rol +
   herramientas +
   permisos + presupuesto + alma). Ese hueco es exactamente la oportunidad de Ego.
2. **Claude Code es hoy el estado del arte del sistema de plantillas** (subagents + skills + plugins + marketplaces +
   hooks + teams) y es el
   único con un modelo de marketplace con versionado, validación (`claude plugin validate`), allowlist/blocklist
   organizativa y "mods". Copiar
   su *modelo de datos*, no su *sintaxis YAML*.
3. **La convergencia real de 2026 es `SKILL.md`**: Claude Code, OpenCode, Gemini CLI, Qwen Code, Continue, Cursor, Codex
   y Cline leen skills
   desde directorios ajenos (`.claude/skills/`, `.agents/skills/`). Esto hace que un `SKILL.md` sea **la unidad portable
   real**, y que un
   importador de Ego deba leer skills de terceros aunque no pueda leer sus agentes.
4. **El modelo de enjambre que mejor se ha resuelto es el de Claude Code "agent teams"**: líder + compañeros que se
   comunican entre sí +
   lista de tareas compartida + propiedad exclusiva de ficheros. El team's config vive en
   `~/.claude/teams/{team-name}/config.json`, un
   artefacto en disco importable. Qwen Code replica el patrón con `Agent Team` + `Arena` (competencia) + `Herdr`
   (multi-CLI).
5. **El formato de rol más portable del mundo es el markdown con frontmatter YAML** (Claude Code `.claude/agents/*.md`,
   Gemini CLI
   `.gemini/agents/*.md`, Codex `agent-roles` en TOML, OpenCode `.opencode/agents/*.md`). La convergencia de campos
   es:
   `name`, `description`, `model`, `tools`, `permission(s)`, `maxTurns`/`max_turns`, `skills`, `memory`, `hooks`.
6. **Ego ya tiene el 60 % del modelo**: `SubEgoManifest` (Zod), `SubEgoSoul`, `SubEgoRegistry` (catálogo en VantaDB),
   `DOMAIN_TEMPLATES` y `OFFICIAL_SUBEGO_TEMPLATES` (catálogos en código), `SubEgoWorktree` (aislamiento),
   `DelegationRouter`/`DelegationTools`, `ExecutionManager` y el
   bus de hooks CFG-09.
   Eso hace que la fila de cada mecanismo equivalente sea **PARALELO**, no "nuevo".
7. **Lo que Ego NO tiene** (y es lo que este informe propone): un tipo `SubEgoTemplate` de primera clase, persistido,
   versionado y
   publicable; un exportador a Agent Skills / `AGENTS.md` / MCP; y — el hueco más grande — **un detector de definiciones
   de agente ya
   instaladas en la máquina del usuario**.
8. **El detector es la pieza de mayor valor y menor coste**: hoy el usuario de Ego ya tiene Claude Code, Cursor, Gemini
   CLI, OpenCode, Cline,
   Continue, Codex y Goose instalados con sus plantillas, y Ego no puede ver ninguna. Un `SubEgoImportScanner` de solo
   lectura que recorra
   ~12 rutas conocidas y traduzca a `SubEgoTemplate` es la funcionalidad de mayor retorno del conjunto.
9. **Los repos de catálogo ya resuelven el "multi-harness"**: `wshobson/agents` (41 202 estrellas, MIT) publica 92
   plugins con
   `.claude-plugin/`, `.codex-plugin/`, `.cursor-plugin/`, `.agents/plugins/` en paralelo. Es el patrón exacto que Ego
   necesita para
   publicar un Sub-Ego y que se instale en varias plataformas a la vez.
10. **Riesgo de licencia**: el ecosistema mezcla OSI (MIT/Apache-2.0) con copyleft fuerte (Cherry Studio AGPL-3.0) y
    source-available no OSI
    (Crush FSL-1.1, Dify Apache-2.0 modificado, n8n Sustainable Use, LobeChat Community License, Open WebUI con cláusula
    de marca,
    Claude Code propietario). **Ego sólo debe consumir catálogo de licencia verificada OSI** (MIT/Apache-2.0/BSD) o
    exigir atribución.
11. **Veredicto**: **ADOPTAR** el estándar Agent Skills como formato de "procedimiento" y el modelo de marketplace de
    Claude Code como
    modelo de "catálogo"; **ADAPTAR** el manifiesto de subagent de Claude Code y el de Gemini CLI al esquema canónico de
    Ego;
    **DESCARTAR** por ahora la semántica de "plugins con hooks" al estilo Claude Code (Ego ya tiene su propio bus de
    hooks CFG-09).
12. **Mapa a paquetes**: `packages/subegos` (plantilla + versionado + exportadores) y `packages/integrations` (scanner
    de importación)
    con apoyo de `packages/tools` (catálogo de tools/toolsets) y `packages/execution` (presupuestos).
13. **Deuda abierta para el owner**: (a) ¿el catálogo de Ego es local-only o se publica en un registro remoto como el
    MCP Registry?
    (b) ¿una plantilla importada conserva la licencia del origen? (c) ¿el modelo canónico es un tipo nuevo o una
    extensión del manifiesto?
14. La pregunta de diseño central: **plantilla = manifiesto sin instancia** (portable, versionable, publicable) frente a
    **manifiesto =
    instancia viva** (estado, memoria, aprobaciones). El informe recomienda **separar los dos tipos** y que
    `SubEgoTemplate` sea un
    subconjunto declarativo de `SubEgoManifest`.
15. **Prioridad sugerida**: el importador de definiciones existentes es la pieza que más valor entrega por unidad de
    esfuerzo, porque no
    requiere decidir la política de publicación remota.

---

## 2. Metodología ##

### 2.1 Qué se buscó ###

- Mecanismos de **definición de agente** (subagent, role, assistant, persona) en herramientas de terminal, IDE y web.
- Mecanismos de **catálogo y distribución** (marketplace, registry, plugin index, awesome-list).
- Mecanismos de **enjambre** (equipos, lideres, compañeros, competencia, jerarquía).
- **Estándares de formato** que cruzan varias herramientas y por tanto son portables.
- Mecanismos de **detección/importación**: qué se lee de disco en cada herramienta y en qué formato.

### 2.2 Cómo se verificó ###

| Tipo de evidencia | Herramienta | Uso |
|---|---|---|
| Estrellas, push, licencia, archivo, archivado | API `https://api.github.com/repos/<org>/<repo>` | Repos con few-shot y fecha de push exacta |
| Estrellas y push (contenedor sin límite) | `https://ungh.cc/repos/<org>/<repo>` | Repos por encima del límite de 60 req/h de la API |
| Licencia | Lectura directa de `LICENSE`, `LICENSE.md`, `LICENSE.txt` en `raw.githubusercontent.com` | Detección por texto (Apache-2.0, MIT, AGPL, FSL, BUSL, GPL, CC-BY) |
| Código y rutas concretas | Listado de árbol vía HTML de GitHub (`react-app.embeddedData`) + `raw.githubusercontent.com` | Ficheros concretos con `ruta` y, cuando se pudo, línea |
| Documentación oficial | Fetch de `code.claude.com/docs/**.md`, `opencode.ai/docs`, `agentskills.io/specification`, `geminicli.com`, `docs.cursor.com`, `docs.cline.bot`, `www.librechat.ai` | Especificaciones y tablas de campos |
| Repos del propio proyecto | Lectura directa | `packages/subegos/src/*`, `packages/integrations/src/skills/*` |
| Auditoría de verificación (2026-10-20) | API REST de GitHub + `raw.githubusercontent.com` + árbol local | Estrellas, push, licencia, lenguaje, archivado y rutas — ver la sección final |

### 2.3 Criterios de inclusión ###

- **Incluido**: mecanismo verificable en código o documentación oficial, con repositorio o URL oficial viva.
- **Marcado "no verificado"**: cualquier cifra, ruta o campo que no se pudo comprobar directamente. No se han estimado
  estrellas ni fechas.
- **Excluido**: frameworks de orquestación que no exponen un formato de agente importable (LangGraph se trata sólo como
  referencia de modelo
  de roles; CrewAI como referencia de plantilla de rol).

### 2.4 Leyenda de veredictos ###

| Veredicto | Significado |
|---|---|
| ADOPTAR | El mecanismo resuelve algo que Ego necesita y puede asumirse tal cual |
| ADAPTAR | El mecanismo resuelve algo que Ego necesita pero su forma concreta no encaja con la arquitectura de Ego |
| DESCARTAR | El mecanismo no aporta o colisiona con los principios innegociables de Ego |
| PARALELO | Ego ya tiene un mecanismo equivalente implementado; se documenta, no se propone |
| NO VERIFICADO | No se pudo comprobar en código ni documentación oficial |

---

## 3. Estado del arte por aplicación ##

### 3.1 Tabla comparativa global ###

| App | Mecanismo de agente | Formato de definición | Ubicación en disco | ¿Exportable? | Veredicto Ego |
|---|---|---|---|---|---|
| Claude Code | Subagents, skills, plugins, marketplaces, hooks, agent teams | YAML frontmatter + Markdown; `marketplace.json`; `plugin.json` | `~/.claude/agents/`, `.claude/agents/`, `~/.claude/skills/`, `~/.claude/plugins/` | Sí (archivos) | ADOPTAR (modelo) |
| OpenCode | Primary agents, subagents, plugins, commands, skills | JSON en `opencode.json` o YAML frontmatter en `agents/*.md` | `~/.config/opencode/`, `.opencode/` | Sí | ADOPTAR (formato skills) |
| Gemini CLI | Subagents, extensions, commands, skills, hooks, policy engine | YAML frontmatter en `.gemini/agents/*.md`; `gemini-extension.json` | `~/.gemini/`, `.gemini/` | Sí | ADAPTAR |
| Qwen Code | Subagents, forks, Agent Team, Arena, Herdr | YAML frontmatter + `executor` | `.qwen/`, `~/.qwen/` | Sí | ADOPTAR (modelo de fork/equipo) |
| Codex CLI | Agent roles, skills, plugins, worktrees, memories | TOML (roles) + `SKILL.md` | `~/.codex/`, `AGENTS.md` | Sí | ADAPTAR |
| Cline | Modes, rules, skills | Markdown + frontmatter | `.clinerules/`, `.cline/rules/`, `.cline/skills/` | Sí | DESCARTAR (modes) |
| Continue | Assistants, rules, skills, config YAML | YAML config + Markdown | `.continue/`, `~/.continue/` | Sí | ADAPTAR (reglas) |
| Goose | Recipes, subrecipes, extensions, `.goosehints` | YAML/JSON | `GOOSE_RECIPE_PATH`, `~/.config/goose/` | Sí | ADOPTAR (receta) |
| Cursor | Rules, skills, subagents, plugins, hooks, MCP | `.mdc` con frontmatter | `.cursor/rules/`, `~/.cursor/` | Sí | ADAPTAR |
| Aider | Repo map, `CONVENTIONS.md`, `.aider.conf.yml` | YAML + Markdown | raíz del repo, `~/.aider.conf.yml` | Parcial | DESCARTAR |
| Crush | Modos de agente por CLI | YAML | `crush.json` | Sí | NO VERIFICADO |
| Kilo Code | Derivado de Roo/OpenCode | Igual que OpenCode | `.kilocode/` | Sí | DESCARTAR (duplicado de OpenCode) |
| Roo Code | Modos y reglas | Markdown | `.roo/rules/` | Sí | DESCARTAR (repo archivado) |
| ChatGPT | GPTs, Actions, custom instructions, connectors, Apps SDK | JSON de Action (OpenAPI) + UI web | Servidor (no local) | No (API de administración) | ADAPTAR (concepto) |
| Claude Desktop | MCP, connectors, skills | `claude_desktop_config.json` | `~/Library/Application Support/Claude/`, `%APPDATA%\Claude\` | Sí | PARALELO (MCP en Ego) |
| LibreChat | Agents, MCP, skills, agents plugins | JSON/YAML de config + BD | `librechat.yaml`, MongoDB | Sí (config) | ADOPTAR (concepto) |
| AnythingLLM | Agents por workspace, agent skills | JSON en BD | BD (workspace.agentConfig) | Sí (JSON) | ADAPTAR |
| Open WebUI | Skills, functions, tools, pipes, apps | SQL + JS/Python | `backend/open_webui/models/skills.py` | Sí | ADOPTAR (modelo de skill) |
| Dify | Plugins (tool/model/agent-strategy), DSL de app | YAML/manifest + JSON DSL | `api/core/plugin/entities/plugin.py` | Sí | ADAPTAR |
| Flowise / Langflow | Flujos de agentes | JSON de flujo | BD de la instancia | Sí | DESCARTAR (modelo visual) |
| n8n | Nodos, workflows, sub-workflows | JSON de workflow | Instancia n8n | Sí | DESCARTAR |
| Jan | Extensiones (Cortex) | Manifiesto de extensión | `~/.jan/extensions/` | Sí | NO VERIFICADO |
| Cherry Studio | Asistentes, MCP, plugins | JSON en BD | App data dir | Sí | DESCARTAR (AGPL) |
| LobeChat | Agents y plugins federados | `index.json` de mercado | `lobehub/lobe-chat-agents` | Sí | ADOPTAR (patrón de índice) |

### 3.2 Fichas: herramientas de terminal ###

#### Claude Code ####

- **Definición de subagent**: fichero Markdown con frontmatter YAML. La tabla de campos oficial incluye `name`
  (obligatorio), `description`
  (obligatorio), `tools`, `disallowedTools`, `model`, `permissionMode`, `maxTurns`, `autoCompactWindow`, `skills`,
  `mcpServers`, `hooks`,
  `memory`, `background`, `omitClaudeMd`. Los campos multipalabra van en `camelCase`.
- **Jerarquía de ubicaciones** (prioridad descendente): managed settings → flag `--agents` → `.claude/agents/` →
  `~/.claude/agents/` →
  `agents/` de un plugin.
- **Plugin**: directorio con `.claude-plugin/plugin.json`. Campos verificados en
  `wshobson/agents/plugins/agent-teams/.claude-plugin/plugin.json`:
  `name`, `version`, `description`, `author{name,email}`, `license`.
- **Marketplace**: `.claude-plugin/marketplace.json` con `name`, `owner{name,email}`, `metadata{description,version}` y
  array `plugins`, cada
  entrada con `name`, `description` y `source`. El `source` puede ser una ruta relativa o un objeto con tipo (`github`,
  `git`, `npm`,
  `url`, `command`). Anthropic reserva nombres de marketplace oficiales y de la comunidad.
- **Equipo (agent teams)**: experimental, se activa con `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. Un sesión actúa de
  líder, los compañeros
  se comunican entre sí, comparten lista de tareas y cada uno puede hablar con el usuario. Artefacto en disco:
  `~/.claude/teams/{team-name}/config.json`.
- **Comandos**: los comandos personalizados se han fusionado con las skills: `.claude/commands/deploy.md` y
  `.claude/skills/deploy/SKILL.md` crean ambos `/deploy`.
- **Fichero clave**: `code.claude.com/docs/en/sub-agents.md` (tabla de frontmatter),
  `code.claude.com/docs/en/plugins/marketplace-reference.md` (esquema de `marketplace.json`),
  `code.claude.com/docs/en/claude-directory.md` (tabla de rutas).

#### OpenCode ####

- **Tipos**: *primary agents* (Build, Plan, más ocultos `compaction`, `title`, `summary`) y *subagents* (`general`,
  `explore`, `scout`).
- **Definición**: dos formas equivalentes. JSON en `opencode.json` bajo la clave `agent`, o Markdown con frontmatter en
  `~/.config/opencode/agents/` y `.opencode/agents/`. El nombre del fichero Markdown es el nombre del agente.
- **Campos**: `description` (obligatorio), `mode` (`primary`/`subagent`), `model`, `prompt` (apunta a un fichero con
  `{file:./x.txt}`),
  `permission{edit,shell,...}`, `temperature`, `steps` (antes `maxSteps`, deprecado), `disable`, `tools` (deprecado a
  favor de `permission`),
  `description`, `hidden`, `color`.
- **Orden de precedencia de config** (8 capas, la última gana): config remota `.well-known/opencode` →
  `~/.config/opencode/opencode.json` →
  `OPENCODE_CONFIG` → `opencode.json` del proyecto → directorios `.opencode/` → `OPENCODE_CONFIG_CONTENT` → config
  gestionada en macOS
  (`/Library/Application Support/opencode/`) → preferencias `.mobileconfig` por MDM.
- **Skills**: lee `SKILL.md` de `.opencode/skills/<name>/`, `~/.config/opencode/skills/<name>/`,
  **`.claude/skills/<name>/`**,
  **`~/.claude/skills/<name>/`**, **`.agents/skills/<name>/`** y **`~/.agents/skills/<name>/`**. Para proyectos sube
  desde el directorio
  actual hasta la raíz del worktree git.
- **Plugins**: `.opencode/plugins/` y `~/.config/opencode/plugins/` (ficheros JS/TS) o paquetes npm listados en
  `opencode.json` bajo
  `plugin`. Se cachean en `~/.cache/opencode/node_modules/`.
- **Fichero clave**: `packages/web/src/content/docs/agents.mdx` y `.../config.mdx` (rama `dev`), `.../skills.mdx`.

#### Gemini CLI ####

- **Subagents**: Markdown con frontmatter YAML en `.gemini/agents/*.md` (proyecto) y `~/.gemini/agents/*.md` (usuario).
  El cuerpo Markdown
  es el system prompt.
- **Campos**: `name` (obligatorio), `description` (obligatorio), `kind` (`local`/`remote`), `tools` (array con comodines
  `*`, `mcp_*`,
  `mcp_server_*`), `mcpServers` (servidores inline aislados), `model`, `temperature`, `max_turns` (por defecto 30),
  `timeout_mins` (por
  defecto 10).
- **Aislamiento**: contexto propio, tools declarados y **protección anti-recursión**: un subagent nunca puede llamar a
  otro subagent.
- **Built-ins**: `codebase_investigator`, `cli_help`, `generalist`, `browser_agent` (desactivado por defecto, requiere
  Chrome 144+).
  Se configuran en `settings.json` bajo `agents.overrides`.
- **Policy engine**: `policy.toml` con reglas `[[rules]]` y propiedad `subagent` para reglas específicas por subagent.
- **Estado de la plataforma**: la documentación avisa de que *Gemini CLI fue reemplazado por Antigravity CLI el
  18-06-2026*. Es una señal de
  que incluso un proyecto con 107 460 estrellas está expuesto a un cambio de plataforma: **el catálogo de Ego debe
  desacoplarse del vendor**.
- **Fichero clave**: `docs/core/subagents.md` en `google-gemini/gemini-cli`.

#### Qwen Code ####

- **Subagents**: frente a laxo. Además de subagents nombrados, soporta **forks** (`subagent_type: "fork"`) que heredan
  el contexto completo
  del padre y comparten el prefijo de prompt cache (ahorro declarado del 80 % de tokens con 3 forks en paralelo).
- **Restricción de herramientas**: `fork_tools` (array por invocación) y `fork_profile` (perfil nombrado en
  `.qwen/fork-profiles/<name>.md`,
  sólo proyecto, máximo 64 KiB, con `tools` obligatorio y `promptHint` opcional de 200 caracteres).
- **Ejecutores nativos**: `executor.kind: codex` (lanza `codex app-server --stdio`) y `executor.kind: acp` (lanza
  `claude-agent-acp`).
  El frontmatter declara `executor{kind,command,args}`, `background`.
- **Enjambre**: `experimental.agentTeam: true` o `QWEN_CODE_ENABLE_AGENT_TEAM=1`. El comando `/coordinate` reparte hasta
  tres flujos de trabajo
  independientes; los trabajadores son read-only y opcionalmente un escritor con worktree git propio; el líder conserva
  la autoridad de merge.
- **Arena**: varios modelos compiten en la misma tarea en worktrees aislados y gana uno (selección por calidad).
- **Herdr**: coordinación entre CLIs o sesiones de terminal remotas.
- **Fichero clave**: `docs/users/features/sub-agents.md` y `docs/users/features/multi-agent-coordination.md`.

#### Codex CLI ####

- **Agent roles**: crate Rust `codex-rs/agent-roles` con `src/agent_role_config.rs`, `src/discovery.rs`,
  `src/loader.rs`. El rol es un TOML
  con `name`, `description`, `nickname_candidates` y un `config` embebido que se aplana sobre `ConfigToml`
  (`#[serde(flatten)]`). El campo `description` es "documentación del rol orientada a humano usada en la guía del spawn
  tool".
- **Skills**: crate `codex-rs/skills` con `model.rs`, `parser.rs`, `selection.rs`, `loading.rs`, `mentions.rs`.
  `SkillMetadata` declara
  `name`, `description`, `short_description`, `interface`, `dependencies`, `policy` (con `allow_implicit_invocation`),
  `path_to_skills_md`,
  `scope`, `plugin_id`, `remote_plugin_id`.
- **Otros crates relevantes**: `codex-rs/core-plugins`, `codex-rs/plugin`, `codex-rs/collaboration-mode-templates`,
  `codex-rs/worktree`,
  `codex-rs/memories`, `codex-rs/agent-message-board-client`, `codex-rs/runtime-agent-instance`.
- **Licencia**: Apache-2.0 (código Rust). Permite studying and adapting con atribución.

#### Cline ####

- **Rules**: Markdown en `.clinerules/` o `.cline/rules/` (proyecto) y directorio global de Cline. Detecta
  automáticamente `.cursorrules`,
  `.windsurfrules`, `AGENTS.md` y `~/.agents/AGENTS.md`.
- **Estructura de repositorio**: el propio repo de Cline expone `.agents/skills/`, `.cline/skills/`, `.clinerules/` y
  `AGENTS.md` — es decir,
  Cline consume los mismos formatos que el resto del ecosistema.
- **Veredicto**: útil como **fuente de detección** (qué hay instalado) pero su modelo de *modes* es cerrado y no aporta
  a Ego.

#### Continue ####

- **Skills**: `core/config/markdown/loadMarkdownSkills.ts` implementa `loadMarkdownSkills` que combina los ficheros
  propios de Continue con
  **`.claude/skills/`** del workspace y global. El frontmatter se valida con `skillFrontmatterSchema = z.object({ name:
  z.string().min(1),
  description: z.string().min(1) })` — el mínimo del estándar Agent Skills.
- **Reglas**: `core/config/markdown/loadMarkdownRules.ts` y `loadCodebaseRules.ts`.
- **Config**: `core/config/` con `ConfigHandler.ts`, `types.ts`, `validation.ts`, y variantes JSON, YAML, Markdown y
  Profile.
- **Veredicto**: **confirmación independiente** de que el formato `SKILL.md` es el denominador común.

#### Goose ####

- **Recipes**: YAML (recomendado), YML o JSON. Ubicación: directorio actual o `GOOSE_RECIPE_PATH`; repositorio GitHub
  vía
  `GOOSE_RECIPE_GITHUB_REPO` (requiere `gh` autenticado).
- **Esquema de receta**: `description` (obligatorio), `title` (obligatorio), `instructions` **o** `prompt` (al menos
  uno; `prompt` obligatorio en
  modo headless), `activities` (burbujas clicables, sólo Desktop), `extensions` (array), `parameters` (array),
  `response` (esquema de
  salida estructurada), `retry` (con validación de éxito), `settings` (proveedor y modelo), `sub_recipes` (array),
  `version` (por defecto
  `1.0.0`).
- **Contexto**: `.goosehints` (el propio repo de Goose lo usa) y `AGENTS.md`/`CLAUDE.md`.
- **Veredicto**: la receta es el ancestro más cercano al concepto de "plantilla de Sub-Ego": instrucciones, extensiones,
  modelo y parámetros.

#### Cursor ####

- **Superficie documentada** (índice de `docs.cursor.com`): Plugins, Rules, Skills, Subagents, Hooks, MCP, más "Cloud
  Agents", "Apps",
  "Integrations", "Bugbot", "PR Routing & Approval" y "Agent Review".
- **Lectura relevante**: Cursor es hoy el cliente con **más superficie de personalización en un solo sitio** y con
  equipos que exigen
  configuración administrativa ("Teams & Enterprise").
- **Nota**: no se pudo extraer de forma fiable el esquema exacto de `.cursor/rules/*.mdc` desde la documentación
  renderizada en cliente
  durante esta investigación; se marca **NO VERIFICADO**.

#### Aider ####

- **Mecanismo**: `CONVENTIONS.md` (convención del repo) + `.aider.conf.yml` (configuración del par) + repo map por
  búsqueda de árbol.
- **Veredicto**: no hay identidad de agente ni catálogo. **DESCARTAR** como fuente de plantilla; sólo útil como fuente
  de *convenciones*.

### 3.3 Fichas: plataformas web y de chat ###

#### ChatGPT (GPTs, Actions, connectors, Apps SDK) ####

- **Modelo**: un GPT es un conjunto de *instrucciones* + *conocimiento* (ficheros) + *capacidades* (navegación web,
  intérprete de código,
  generación de imágenes) + *acciones* (OpenAPI) + conectores. Además, las *custom instructions* a nivel de cuenta.
- **Portabilidad**: la definición vive en el servidor y no se exporta como fichero. La única parte portable es el JSON
  de la Action
  (OpenAPI), que es un subconjunto de MCP.
- **Veredicto**: el concepto de GPT se parece a un `SubEgoTemplate` sin modelo ni presupuesto; la parte de valor
  transferible es la Action.

#### LibreChat ####

- **Agents**: "Agent Builder" en el panel lateral con `Avatar`, `Name`, `Description`, `Instructions` (system prompt),
  `Model`,
  `Conversation Starters` (hasta 4) y dos secciones: **Tools** y **Skills**, cada una con biblioteca buscable (Official
  / Tools / MCP /
  Actions), "Made by you" y "Favorites" (máximo 100 favoritos por usuario).
- **Agent Plugins** (experimental): empaquetan Skills de despliegue y servidores MCP en paquetes cargados al arrancar.
- **Persistencia**: en base de datos, no en ficheros → exportabilidad de configuración pero no de definiciones de
  agente.

#### AnythingLLM ####

- **Agentes por workspace** con `agentConfig` almacenado en la base de datos.
- **Agent Skills**: modelo `server/models/agentSkillWhitelist.js` con `AgentSkillWhitelist.get/add/remove` sobre
  `system_settings`
  (etiqueta `whitelisted_agent_skills`, o `user_<id>_whitelisted_agent_skills` en multi-usuario).
- **Veredicto**: el patrón de *whitelist* de skills por usuario es el control de gobernanza más simple y más portable de
  todo el ecosistema.

#### Open WebUI ####

- **Modelo de datos verificado** en `backend/open_webui/models/skills.py`: tabla `skill` con `id`, `user_id`, `name`,
  `description`, `content`,
  `data` (JSON), `version_id`, `meta` (JSON con `i18n` y `tags`), `is_active`, `updated_at`, `created_at`.
- **Otros modelos**: `functions.py`, `tools.py`, `prompts.py`, `automations.py`, `skill_history.py`, `tool_history.py`,
  `apps.py`.
- **Veredicto**: `version_id` + `meta.tags` es un modelo de versionado de skill más maduro que el de Claude Code, y
  merece comparación.

#### Dify ####

- **Plugin**: `api/core/plugin/entities/plugin.py` define `PluginDeclaration` con
  `Plugins{tools,models,endpoints,datasources,triggers}`,
  `Meta{minimum_dify_version,version}`, `PluginResourceRequirements` (memoria y permisos por categoría: `tool`, `model`
  con sub-flags
  `llm/text_embedding/rerank/tts/speech2text/moderation`, `node`, `endpoint`, `storage` con tamaño 1 KiB–1 GiB).
- **Categorías de plugin**: `Tool`, `Model`, `Extension`, `AgentStrategy`, `Datasource`, `Trigger`.
- **Origen de instalación**: `Github`, `Marketplace`, `Package`, `Remote`.
- **Veredicto**: el bloque de *permisos declarativos por recurso* es más fino que el `tools[]` plano de Claude Code y
  encaja bien con el modelo
  de permisos de Ego (namespace read/write + toolsets).

#### LobeChat ####

- **Patrón de índice federado**: `lobehub/lobe-chat-agents` (1 239 estrellas, MIT) publica un `index.json` que la
  aplicación consume para
  descubrir agentes; `lobehub/lobe-chat-plugins` (300 estrellas, MIT) hace lo mismo con plugins.
- **Posicionamiento actual**: "Chief Agent Operator" — organizar agentes en operaciones 7×24 contratando, programando y
  supervisando.
- **Veredicto**: el **patrón de índice centralizado** (un `index.json` que describe el catálogo) es exactamente lo que
  necesita un catálogo
  de Sub-Egos federado y es trivial de implementar.

#### Cherry Studio ####

- **Superficie**: "AI productivity studio con smart chat, agentes autónomos y 300+ asistentes".
- **Licencia**: **AGPL-3.0** → copyleft fuerte. **No integrable ni redistribuible** dentro de un producto Apache-2.0 sin
  consecuencias.

---

## 4. Formatos y esquemas ##

### 4.1 Tabla de formatos ###

| Formato | Campos | Especificación | ¿Traducible a Ego? | Veredicto |
|---|---|---|---|---|
| `SKILL.md` (Agent Skills) | `name` (req.), `description` (req.), `license`, `compatibility`, `metadata{}`, `allowed-tools` | `agentskills.io/specification` | Sí, como `SubEgoTemplate` parcial | ADOPTAR |
| `AGENTS.md` | Markdown libre por secciones | `agents.md` (60 k+ proyectos) | Sí, como contexto de proyecto | ADOPTAR (contexto) |
| Subagent Claude Code | `name`, `description`, `tools`, `disallowedTools`, `model`, `permissionMode`, `maxTurns`, `autoCompactWindow`, `skills`, `mcpServers`, `hooks`, `memory`, `background`, `omitClaudeMd` | `code.claude.com/docs/en/sub-agents.md` | Sí, casi 1:1 al `SubEgoManifest` | ADOPTAR |
| Agent Gemini CLI | `name`, `description`, `kind`, `tools[]`, `mcpServers{}`, `model`, `temperature`, `max_turns`, `timeout_mins` | `docs/core/subagents.md` | Sí, 1:1 | ADOPTAR |
| Agent OpenCode | `description`, `mode`, `model`, `prompt`, `permission{}`, `temperature`, `steps`, `disable`, `tools` | `packages/web/src/content/docs/agents.mdx` | Sí, 1:1 | ADOPTAR |
| Agent Codex (role TOML) | `name`, `description`, `nickname_candidates[]`, `config` (TOML aplanado) | `codex-rs/agent-roles/src/agent_role_config.rs` | Sí, con adaptación de aplanado | ADOPTAR |
| `marketplace.json` | `name`, `owner{}`, `metadata{}`, `plugins[]{name,description,source}` | `code.claude.com/docs/en/plugins/marketplace-reference.md` | Sí | ADOPTAR |
| `plugin.json` | `name`, `version`, `description`, `author{}`, `license` | `wshobson/agents/plugins/*/.claude-plugin/plugin.json` | Sí | ADOPTAR |
| Receta Goose | `title`, `description`, `instructions`/`prompt`, `activities[]`, `extensions[]`, `parameters[]`, `response{}`, `retry{}`, `settings{}`, `sub_recipes[]`, `version` | `documentation/docs/guides/recipes/recipe-reference.md` | Sí, el más completo | ADOPTAR |
| `server.json` (MCP) | `name`, `description`, `title`, `version`, `repository{}`, `websiteUrl`, `packages[]{registryType,identifier,version,transport,environmentVariables}`, `_meta{}` | `docs/reference/server-json/generic-server-json.md` | Sí, como subconjunto de herramientas | ADOPTAR |
| `gemini-extension.json` | Manifiesto de extensión Gemini CLI | `docs/extensions/reference.md` | Sí | ADOPTAR |
| Plugin Dify | `Plugins{tools,models,endpoints,datasources,triggers}`, `Meta{version,minimum_dify_version}`, permisos por recurso | `api/core/plugin/entities/plugin.py` | Sí | ADOPTAR |
| Agent Card (A2A) | `AgentCard` como mensaje protobuf canónico | `a2aproject/A2A` → `specification/a2a.proto` | Parcial (es un *contrato de red*, no una plantilla) | ADOPTAR (interoperabilidad) |
| Assistant GPT (ChatGPT) | Instrucciones + ficheros + capacidades + Actions (OpenAPI) | help.openai.com | Parcial | DESCARTAR (no portable) |
| `SubEgoManifest` (Ego) | `id`, `name`, `role`, `description`, `systemPrompt`, `responsibilities[]`, `capabilities[]`, `tools[]`, `permissions[]`, `namespaces{}`, `behavior{}`, `autonomy`, `budget{}`, `trigger`, `soul{}`, `character{}`, `state`, `creator` | `packages/subegos/src/SubEgoManifest.ts` | Es el destino | PARALELO |
| `DomainTemplate` (Ego) | `templateId`, `name`, `role`, `description`, `instructions`, responsabilidades/capacidades/tools/namespaces/permissions recomendadas, `behavior{}`, `autonomy`, `defaultBudget{}` | `packages/subegos/src/templates/domainTemplates.ts` | Es el ancestro del catálogo | PARALELO |

### 4.2 Detalle de los formatos clave ###

#### Agent Skills (`SKILL.md`) — el estándar que hay que adoptar ####

Fuente: `agentskills.io/specification` (la especificación canónica ya no reside en `anthropics/skills`, cuyo
`spec/agent-skills-spec.md` es sólo un puntero de 87 bytes).

- **Estructura de directorio**: `skill-name/SKILL.md` (obligatorio), `scripts/` (opcional), `references/` (opcional),
  `assets/` (opcional).
- **Frontmatter**:
  - `name` — obligatorio, 1–64 caracteres, sólo `[a-z0-9-]`, sin guiones al inicio/final ni consecutivos, **debe
    coincidir con el nombre del
    directorio padre**.
  - `description` — obligatorio, 1–1024 caracteres, describe *qué hace* y *cuándo usarlo*.
  - `license` — opcional, nombre de licencia o referencia a fichero incluyendo.
  - `compatibility` — opcional, 1–500 caracteres, requisitos de entorno.
  - `metadata` — opcional, mapa `string → string` libre.
  - `allowed-tools` — opcional, lista separada por espacios de tools pre-aprobadas (**experimental**).
- **Progressive disclosure**: el agente carga el `SKILL.md` completo al activarlo y los ficheros de `references/` bajo
  demanda. Es la razón
  principal por la que una skill es barata en contexto y una skill no es un agente.
- **Implicación para Ego**: una skill **no** es un Sub-Ego. Falta identidad, herramientas, permisos, presupuesto,
  autonomy y alma. La
  traducción correcta es `SKILL.md → SubEgoTemplate` con `kind: "skill"` y sólo el campo `instructions` poblado; el
  resto se rellena por
  defecto o por el usuario.

#### Frontmatter de subagent de Claude Code — el modelo de datos a adoptar ####

Fuente: `code.claude.com/docs/en/sub-agents.md`, tabla "Frontmatter reference". Sólo `name` y `description` son
obligatorios. Campos
relevantes para Ego:

| Campo Claude Code | Equivalente en `SubEgoManifest` | Nota de traducción |
|---|---|---|
| `name` | `name` + `id` | El ID de Ego es `ego.<slug>` y opaco; se deriva del nombre |
| `description` | `description` | Texto libre, ≤256 caracteres en Claude Code |
| `tools` | `tools[]` | Claude Code usa lista separada por comas; Ego usa array |
| `disallowedTools` | `permissions[]` (negativa) | Ego prefiere allow-list: se traduce a la diferencia |
| `model` | `metadata.model` | Falta en Ego: hay `SubEgoProfile` con `model`, pero no en el manifiesto |
| `permissionMode` | `autonomy` | `default`→`supervised`, `acceptEdits`/`auto`→`semi-autonomous`, `bypassPermissions`→`autonomous` |
| `maxTurns` | `budget.maxTokensPerCall` (aproximación) | No hay equivalente directo; candidato a `budget.maxTurns` |
| `skills` | `capabilities[]` | Pre-carga de skills en el contexto del subagent |
| `mcpServers` | `tools[]` + `permissions[]` | Servidores MCP inline por agente |
| `hooks` | — | Ego ya tiene bus de hooks global (CFG-09); **no** añadir hooks por plantilla |
| `memory` | `namespaces{}` | `user`/`project`/`local` ≈ ámbito de escritura de memoria |
| `background` | — | Sin equivalente en Ego (concurrencia la decide el Execution Manager) |

#### Manifiesto de marketplace de Claude Code ####

Fuente: `anthropics/skills/.claude-plugin/marketplace.json` (leído directamente) y
`code.claude.com/docs/en/plugins/marketplace-reference.md`. Estructura verificada:

```json
{
  "name": "anthropic-agent-skills",
  "owner": { "name": "Keith Lazuka", "email": "klazuka@anthropic.com" },
  "metadata": { "description": "Anthropic example skills", "version": "1.0.0" },
  "plugins": [
    {
      "name": "example-skills",
      "description": "...",
      "source": "./",
      "strict": false,
      "skills": ["./skills/algorithmic-art", "./skills/brand-guidelines"]
    }
  ]
}
```

Puntos clave: el `source` se resuelve **desde la raíz del marketplace**, no desde `.claude-plugin/`; el nombre del
marketplace debe ser
único por usuario; hay nombres reservados (oficiales, de comunidad y de directorio de plugins); una clave desconocida se
**ignora en
silencio** (el validador la marca como warning) — Ego no debe repetir ese comportamiento: un importador debe fallar
cerrado.

#### Receta Goose — el esquema más completo ####

Fuente: `block/goose/documentation/docs/guides/recipes/recipe-reference.md`. Es el único formato que cubre de una vez
instrucciones + extensiones + modelo + parámetros + salida estructurada + reintento + sub-recetas + versionado. Es el
mejor punto de partida
para el esquema canónico de `SubEgoTemplate` de Ego.

#### `server.json` del MCP Registry ####

Fuente: `modelcontextprotocol/registry/docs/reference/server-json/generic-server-json.md`. Campos: `name` (con
reverse-DNS, del tipo
`io.modelcontextprotocol.anonymous/brave-search`), `description`, `title`, `version`, `websiteUrl`,
`repository{url,source,subfolder}`,
`packages[]{registryType,registryBaseUrl,identifier,version,transport{type},environmentVariables[]{name,description,isRe
quired,isSecret}}` y
`_meta` con espacio de nombres inverso (`io.modelcontextprotocol.registry/publisher-provided`). El `server.schema.json`
se publica versionado
(`https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json`).

**Lectura para Ego**: MCP Registry resuelve el *catálogo de herramientas*, no el de agentes. Es un complemento, no un
sustituto. Ego ya tiene
el `ToolRegistry`; lo que falta es el catálogo de *identidades de agente*.

#### Agent Card de A2A ####

Fuente: `a2aproject/A2A/docs/specification.md`. El `AgentCard` es un mensaje del modelo de datos canónico (Layer 1) y se
expone vía la
operación abstracta "Get Agent Card" (Layer 2) con *bindings* JSON-RPC, gRPC y HTTP/REST (Layer 3). La fuente normativa
única es
`specification/a2a.proto`. **No es un formato de plantilla**: describe cómo *descubrir* un agente remoto, no cómo
*definir* uno local.

---

## 5. Catálogos y marketplaces ##

| Repositorio | URL | Estrellas (2026-10-20) | Último push | Licencia | Uso real |
|---|---|---|---|---|---|
| anthropics/claude-plugins-official | [https://github.com/anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) | 43 265 | 2026-10-20 | Apache-2.0 | Directorio oficial gestionado por Anthropic |
| anthropics/claude-plugins-community | [https://github.com/anthropics/claude-plugins-community](https://github.com/anthropics/claude-plugins-community) | 4 698 | 2026-10-20 | Apache-2.0 | Espejo de solo lectura del marketplace comunitario |
| wshobson/agents | [https://github.com/wshobson/agents](https://github.com/wshobson/agents) | 41 202 | 2026-10-19 | MIT | Marketplace multi-harness: 92 plugins, 202 agentes, 185 skills |
| github/awesome-copilot | [https://github.com/github/awesome-copilot](https://github.com/github/awesome-copilot) | 40 207 | 2026-10-19 | MIT | 222 `*.agent.md` + skills + instrucciones + hooks |
| VoltAgent/awesome-agent-skills | [https://github.com/VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) | 36 035 | 2026-10-19 | MIT | 1 000+ skills de equipos oficiales y comunidad |
| punkpeye/awesome-mcp-servers | [https://github.com/punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) | 96 640 | 2026-10-18 | MIT | Directorio de servidores MCP |
| modelcontextprotocol/servers | [https://github.com/modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) | 91 397 | 2026-10-19 | MIT → Apache-2.0 (transición) | Servidores MCP de referencia |
| modelcontextprotocol/registry | [https://github.com/modelcontextprotocol/registry](https://github.com/modelcontextprotocol/registry) | 7 382 | 2026-10-14 | MIT → Apache-2.0 (transición) | Servicio de registro de servidores MCP |
| obra/superpowers-marketplace | [https://github.com/obra/superpowers-marketplace](https://github.com/obra/superpowers-marketplace) | 1 302 | 2026-10-10 | MIT | Marketplace curado de plugins Claude Code |
| lobehub/lobe-chat-agents | [https://github.com/lobehub/lobe-chat-agents](https://github.com/lobehub/lobe-chat-agents) | 1 239 | 2026-10-15 | MIT | Índice federado de agentes de LobeChat |
| lobehub/lobe-chat-plugins | [https://github.com/lobehub/lobe-chat-plugins](https://github.com/lobehub/lobe-chat-plugins) | 300 | 2026-10-15 | MIT | Índice federado de plugins de LobeChat |
| github/spec-kit | [https://github.com/github/spec-kit](https://github.com/github/spec-kit) | 142 012 | 2026-10-19 | MIT | Plantillas de proceso (spec-driven), no de agente |

### 5.1 El patrón multi-harness (el que Ego debe imitar) ###

`wshobson/agents` es el repositorio de referencia para publicar un mismo asset en varias plataformas. Estructura
verificada en la raíz:

- `.claude-plugin/` — marketplace y manifiestos de plugin para Claude Code.
- `.cursor-plugin/` — marketplace y manifiestos para Cursor.
- `.cursor/rules/` — reglas para Cursor.
- `.agents/plugins/` — formato genérico entre agentes (`marketplace.json`).
- `.codex-plugin/` — **no está en la raíz**: existe dentro de cada plugin
  (`plugins/<nombre>/.codex-plugin/plugin.json`), verificado en 104 rutas.
- `plugins/` — 92 directorios de plugin (verificados: `agent-teams`, `code-reviewer`-family, `security-compliance`,
  `tdd-workflows`,
  `agent-orchestration`, `startup-business-analyst`, `seo-technical-optimization`…).
- Cada plugin declara `plugins/<nombre>/.claude-plugin/plugin.json` con `name`, `version`, `description`,
  `author{name,email}`, `license`,
  y las entradas del marketplace añaden `category`, `homepage`.
- `plugins/agent-teams/` contiene a la vez `.claude-plugin/`, `.codex-plugin/`, `agents/`, `commands/` y `skills/` — es
  decir, **un plugin es
  un contenedor con varios tipos de componente**, no un fichero.

**Conclusión de diseño para Ego**: un `SubEgoTemplate` publicable debe poder materializarse en varios "harnesses" de
destino. La analogía
directa es: `SubEgoTemplate` (canónico, portable) → renderizadores → `SKILL.md` / `AGENTS.md` / `plugin.json` /
`server.json` /
`.gemini/agents/*.md`.

### 5.2 Roles de empresa y equipos (plantillas "CEO/CTO/CFO/Designer/QA") ###

Verificado en `github/awesome-copilot` (222 agentes en `agents/*.agent.md`):

- **RolesLeadership**: `gem-orchestrator` (líder de equipo con `mode: primary`, `disable-model-invocation: true`,
  `user-invocable: true`, `argument-hint`), `plan`, `planner`, `prd`, `critical-thinking`, `devils-advocate`, `mentor`,
  `gem-designer`, `gem-reviewer`, `gem-researcher`, `gem-implementer`, `gem-planner`, `gem-skill-creator`,
  `custom-agent-foundry`,
  `declarative-agents-architect`, `agent-governance-reviewer`, `quality-playbook`, `implementation-plan`,
  `specification`,
  `principal-software-engineer`, `project-architecture-planner`, `task-planner`, `task-researcher`, `qa-subagent`,
  `swe-subagent`,
  `ai-team-dev`, `ai-team-producer`, `ai-team-qa`, `se-product-manager-advisor`, `se-security-reviewer`,
  `se-system-architecture-reviewer`,
  `se-ux-ui-designer`, `se-technical-writer`, `se-responsible-ai-code`, `accessibility`, `doublecheck`, `debug`,
  `janitor`, `modernization`.
- **Formato de un agente** (leído de `agents/devils-advocate.agent.md`):

```yaml
---
description: "I play the devil's advocate to challenge and stress-test your ideas by finding flaws, risks, and edge cases"
name: 'Devils Advocate'
tools: ['read', 'search', 'web']
---
```

El cuerpo Markdown define el comportamiento, incluidos elementos conversacionales explícitos ("Sólo una objeción a la
vez", "End Game").

- **Veredicto**: el conjunto "Devil's advocate / Doublecheck / Critical thinking" es el patrón más valuable para Ego
  porque encaja con el
  `skepticismLevel` del `SubEgoSoul` y con el concepto de **Especialista temporal** ya descrito en
  `docs/architecture/agentes.md`.

---

## 6. Modelos de enjambre y roles ##

| Modelo | Cómo se expresa | Patrón para Sub-Ego | Veredicto |
|---|---|---|---|
| Subagente que reporta | Subagent con contexto propio que devuelve un resumen al padre | `SubEgo` con `trigger: manual` + `delegation` delega y vuelve | PARALELO (Ego ya lo tiene) |
| Fork (contexto heredado) | Qwen Code: fork hereda el historial y el prefijo de prompt cache del padre | Sub-Ego "temporal" que hereda el contexto del turno | ADOPTAR |
| Team leader + compañeros | Claude Code agent teams: líder + compañeros que se hablan + lista de tareas compartida | Meta-Ego como líder + Sub-Egos como compañeros, `Orchestration Bus` | ADOPTAR |
| Competencia / arena | Qwen Code Arena: varios modelos en worktrees aislados, gana uno | Sub-Egos candidatos evaluados por el Decision Router | ADOPTAR (ligero) |
| Ownership exclusivo de ficheros | `wshobson/agents` team-lead: un propietario por fichero + contratos de interfaz | `SubEgoWorktree` + `namespaces.write` por instancia | ADOPTAR |
| Cadena de roles (crew) | CrewAI: `Agent{role, goal, backstory}` + `Task{description,expected_output}` + `Crew{process}` | Plantilla de equipo con roles y tareas tipadas | ADAPTAR (sólo el vocabulario) |
| Grafo de tareas | Codex `agent-message-board-client`, `codex-rs/task-*`, wshobson `TaskCreate/TaskGet/TaskUpdate` | Lista de tareas en `gov/` con `blockedBy`/`blocks` | ADOPTAR |
| Revisor adversarial | `devils-advocate.agent.md`, `critical-thinking.agent.md`, `doublecheck.agent.md` | Sub-Ego con `soul.temperament.skepticismLevel: "high"` | ADOPTAR |
| Jerarquía CEO/CTO/CFO | `gem-orchestrator` con fases y `.gem-team.yaml` de configuración | Equipo de Sub-Egos con un `SubEgoTemplate` "coordinador" | DESCARTAR como taxonomía fija |
| Roles rotativos | `nickname_candidates` de Codex; `nickname` en OpenCode | Alias de invocación del mismo Sub-Ego | ADOPTAR (cosmetico) |
| Múltiples CLI / sesiones | Qwen Code `Herdr`: coordinar CLIs o sesiones de terminal remotas | Fuera del core de Ego | DESCARTAR |

### 6.1 El modelo de equipo de Claude Code en detalle (el mejor ejemplo) ###

Fuente: `code.claude.com/docs/en/agent-teams.md` y el artefacto en disco
`~/.claude/teams/{team-name}/config.json` (referenciado en `wshobson/agents/plugins/agent-teams/agents/team-lead.md`).

| Eje | Subagents | Agent teams |
|---|---|---|
| Contexto | Ventana propia; el resultado vuelve al llamante | Ventana propia; totalmente independiente |
| Comunicación | Devuelven un resultado; los nombrados por el padre pueden mensajearse | Los compañeros se;messagean entre sí directamente |
| Coordinación | El agente principal gestiona todo el trabajo | Auto-coordinación por mensajes + lista de tareas compartida |
| Coste de tokens | Menor: los resultados se resumen al contexto principal | Mayor: cada compañero es una instancia completa |
| Uso ideal | Tareas focalizadas donde sólo importa el resultado | Trabajo complejo que exige discusión y colaboración |

Reglas de ownership extraídas de `team-lead.md`: **un propietario por fichero**, **límites explícitos** en la
descripción de la tarea,
**contratos de interfaz** en las fronteras y los ficheros compartidos los posee el líder. Ciclo de vida del equipo:
*Spawn → Assign →
Monitor → Collect → Synthesize → Shutdown → Cleanup*.

### 6.2 El modelo de roles de CrewAI (vocabulario útil) ###

Fuente: `crewAIInc/crewAI` (59 901 estrellas, MIT). `lib/crewai/src/crewai/` contiene `agent/`, `agents/`, `crews/`,
`tasks/`, `a2a/`,
`skills/`, `mcp/`, `memory/`, `knowledge/`, `security/`. El vocabulario canónico de un rol es *role* + *goal* +
*backstory* más *tools* y
*allow_delegation*. **Ego no debe adoptar la taxonomía de "roles de película"** (analista, investigador, escritor,
gerente): `docs/architecture/agentes.md`
ya fijó que Ego no tiene un catálogo rígido de roles.

### 6.3 El modelo de roles de Codex (el más formal) ###

Fuente: `openai/codex/codex-rs/agent-roles/src/agent_role_config.rs`. Un rol de Codex tiene tres campos propios y un
resto aplanado:

- `name` — obligatorio, no vacío.
- `description` — "documentación del rol orientada a humano usada en la guía del spawn tool"; requerida para roles de
  usuario.
- `nickname_candidates[]` — apodos candidatos para los agentes lanzados con ese rol.
- `config` — TOML aplanado sobre `ConfigToml` (`#[serde(flatten)]`), es decir, **el rol es una capa de configuración**,
  no un objeto cerrado.

Este patrón de "el rol es una capa de configuración que se compone con el resto" es el más elegante para Ego y encaja
con la idea de
`SubEgoProfile` (planner/reviewer/researcher/builder) ya implementada en `packages/subegos/src/SubEgoRegistry.ts`.

---

## 7. Diseño de referencia para Ego ##

### 7.1 Esquema canónico de plantilla de Sub-Ego ###

**Principio rector**: una plantilla es un **manifiesto declarativo, portable y versionable**, distinto del manifiesto de
una **instancia
viva**. Se propone un tipo nuevo, `SubEgoTemplate`, que es un *subconjunto* de `SubEgoManifest` más los campos que sólo
tienen sentido en
una plantilla.

```ts
export interface SubEgoTemplate {
  /** Identidad del catálogo: `tpl.<dominio>.<slug>` (opaco, DSEK-03) */
  templateId: string;

  /** Metadatos de publicación */
  meta: {
    name: string;                 // nombre legible
    description: string;          // cuándo usarlo (base del routing del Decision Router)
    version: string;              // semver de la plantilla
    author: string;
    license: string;              // SPDX: "Apache-2.0" | "MIT" | ...
    homepage?: string;
    tags: string[];
    domain: string;               // dominio funcional (Engineering, Product, …)
    /** Plantillas de las que deriva: para trazar linaje y herencias */
    extends?: string[];
  };

  /** Cuerpo declarativo: la plantilla NO tiene estado ni memoria */
  role: string;
  responsibilities: string[];
  capabilities: string[];
  instructions: string;           // system prompt (soul + prompt fundidos)

  /** Superficie de herramientas y permisos (léase con SubEgoProfile) */
  toolsets: string[];             // toolsets MCP canónicos, no nombres sueltos
  toolOverrides?: string[];       // excepciones puntuales
  permissions: string[];          // p.ej. "memory:read", "fs:write:workspace"
  namespaces: { read: string[]; write: string[] };

  /** Gobierno operativo */
  autonomy: "supervised" | "semi-autonomous" | "autonomous";
  budget: { maxTokensPerCall: number; maxDailyCostUsd: number; requiresApprovalAboveUsd: number };
  modelHint?: { preferred?: string; fallback?: string };   // alias de Model Router
  profile?: "planner" | "reviewer" | "researcher" | "builder";

  /** Alma: el mismo contrato que SubEgoSoul, pero en forma declarativa */
  soul?: SubEgoSoul;

  /** Anidamiento y enjambre */
  swarm?: {
    role: "worker" | "reviewer" | "adversary" | "orchestrator";
    peers?: string[];             // templateIds con los que puede colaborar
    canDelegateTo?: string[];     // subconjunto de peers con permiso delegate:*
    maxDelegationDepth?: number;
  };

  /** Recursos adjuntos (materialized en disco al instanciar) */
  assets?: { kind: "skill" | "rule" | "script" | "template"; path: string }[];
}
```

**Campos que Ego ya tiene y NO hay que duplicar**: `id`, `state`, `creator`, `createdAtMs`, `updatedAtMs`, `metadata` —
son de instancia, no
de plantilla.

**Traducción a `SubEgoManifest` al instanciar** (regla única, sin excepciones):

| Campo de plantilla | Campo del manifiesto | Regla |
|---|---|---|
| `meta.name` | `name` | + `createSubEgoId()` |
| `meta.description` | `description` | literal |
| `role` | `role` | literal |
| `instructions` | `systemPrompt` | literal |
| `responsibilities` | `responsibilities` | literal |
| `capabilities` | `capabilities` | literal |
| `toolsets` + `toolOverrides` | `tools` | expandido contra el `ToolCatalogLike` real |
| `permissions` | `permissions` | literal |
| `namespaces` | `namespaces` | unido a los defaults `egos/<id>/*` y `quarantine/pending` |
| `autonomy` | `autonomy` | literal (default `supervised`) |
| `budget` | `budget` | literal (default 4000 / 2.0 USD / 0.5 USD) |
| `soul` | `soul` | literal |
| `profile` / `modelHint` | `metadata.profile` / `metadata.modelHint` | se resuelve en runtime contra el Model Router |
| `swarm` | `metadata.swarm` | el ACL real vive en `permissions` (`delegate:<id>`) |
| `assets` | materializado en disco | se copia al directorio de la instancia |

### 7.2 Catálogo, versionado y publicación ###

**Propuesta — tres niveles, sin servidor obligatorio**:

1. **Catálogo local embebido** (por defecto): los catálogos `DOMAIN_TEMPLATES`
   (`packages/subegos/src/templates/domainTemplates.ts`) y `OFFICIAL_SUBEGO_TEMPLATES`
   (`packages/domains/src/templates/officialSubEgoTemplates.ts`) se elevan a `SubEgoTemplate` con `templateId`,
   `meta.version` y `meta.license`. Es un cambio de tipo, no de arquitectura.
2. **Registro por proyecto en VantaDB** (`gov/sub_egos_templates/<templateId>`): instancias de plantilla instaladas en
   el proyecto, con su
   versión resuelta y su procedencia (`source: "builtin" | "local" | "imported" | "remote"`). **Reutiliza el patrón de
   `SubEgoRegistry`**
   (namespace, filtros por `domain`/`tags`/`tools`/`capabilities`/`state`/`creator`, validación Zod fail-closed,
   protección de sistema).
3. **Índice federado** (opcional, futuro): un `index.json` con el patrón de `lobehub/lobe-chat-agents` y el
   `marketplace.json` de Claude Code.
   Un índice es un fichero; se puede leer de disco, de un repo git o de una URL. Nada obliga a un servicio.

**Versionado**:

- Semver sobre la **plantilla**, no sobre la instancia. Instanciar una plantilla congela la versión resuelta en el
  manifiesto.
- El campo `metadata.templateId` + `metadata.templateVersion` en el manifiesto permite saber de dónde salió una
  instancia y migrarla.
- Actualizar una plantilla **no** muta instancias existentes; la instancia sólo cambia si el usuario lo acepta
  explícitamente (regla coherente
  con "Evolución post-creación" de `docs/architecture/agentes.md`).
- El `version_id` de Open WebUI (`backend/open_webui/models/skills.py`) y el `version` de `marketplace.json` son los dos
  precedentes
  útiles; Ego puede usar semver + `contentHash` (SHA-256 del `instructions` normalizado) para detectar deriva.

**Publicación**:

- Exportadores: `SKILL.md` (Agent Skills), `AGENTS.md`, `.gemini/agents/<nombre>.md`, `.opencode/agents/<nombre>.md`,
  `.claude/agents/<nombre>.md`, `plugin.json` + `marketplace.json`, `server.json` (para un Sub-Ego que sea sólo un
  servidor MCP).
- **No** se publica código ejecutable en el marketplace de Ego: las skills que traigan `scripts/` se empaquetan como
  assets y se auditan con
  el `SkillLinter` ya existente.
- Cada plantilla publicada lleva `meta.license` y `meta.author`. Un importador debe **rechazar** (fail-closed) cualquier
  plantilla cuya
  licencia no sea compatible con la política de Ego (Apache-2.0).

### 7.3 Detección e importación de definiciones ya instaladas ###

**Principio**: el detector es **de solo lectura**, **opt-in** (el usuario lo lanza explícitamente desde el panel de
Sub-Egos), **fail-closed**
y **nunca muta** la configuración de terceros. Produce una **previsualización** (lista de candidatos con su traducción a
`SubEgoTemplate`) y el usuario elige qué importar. Es el mismo patrón de gobernanza que exige la aprobación previa de
instanciación en
`docs/architecture/agentes.md`.

**Algoritmo**:

1. Para cada app conocida, resolver las rutas candidatas por SO (tabla 7.4).
2. Listar los ficheros de definición (`.md`, `.toml`, `.json`) y validar el formato con el parser de la app.
3. Traducir a `SubEgoTemplate` con un *traductor por app* (tabla 7.5).
4. Marcar el resultado como `lossy` con la lista de campos que no se pueden representar en el modelo de Ego.
5. Mostrar la previsualización agrupada por app, con el aviso de licencia y de fuente.
6. El usuario selecciona; Ego crea un `SubEgoTemplate` con `meta.source = "imported:<app>"` y lo registra en
   `gov/sub_egos_templates/<templateId>`.

**Tabla de rutas de configuración por app** (verificadas en repositorio o documentación salvo marcado):

| App | Ruta de configuración | Qué se lee | Formato de salida | Automático o manual |
|---|---|---|---|---|
| Claude Code | `~/.claude/agents/*.md` (global) | Subagents definidos por el usuario | `SubEgoTemplate` | Automático (read-only) |
| Claude Code | `.claude/agents/*.md` (proyecto) | Subagents del proyecto | `SubEgoTemplate` | Automático |
| Claude Code | `~/.claude/skills/<n>/SKILL.md`, `.claude/skills/<n>/SKILL.md` | Skills | `SubEgoTemplate` (kind skill) | Automático |
| Claude Code | `~/.claude/commands/*.md` | Comandos (= skills de fichero único) | `SubEgoTemplate` (kind skill) | Automático |
| Claude Code | `~/.claude/plugins/` + `installed_plugins.json` | Plugins y marketplaces instalados | Índice de plugins | Automático |
| Claude Code | `~/.claude/teams/<team>/config.json` | Equipos configurados | Plantilla de equipo | Automático |
| Claude Code | `~/.claude/settings.json`, `.claude/settings.json` | Permisos, hooks, env | Config de gobiernanza | Automático |
| OpenCode | `~/.config/opencode/agents/*.md`, `.opencode/agents/*.md` | Primary agents y subagents | `SubEgoTemplate` | Automático |
| OpenCode | `~/.config/opencode/opencode.json`, `opencode.json` | Bloque `agent` | `SubEgoTemplate` | Automático |
| OpenCode | `~/.config/opencode/skills/`, `.opencode/skills/` | Skills propias | `SubEgoTemplate` (kind skill) | Automático |
| OpenCode | `~/.claude/skills/`, `~/.agents/skills/` | Skills de Claude/estándar | `SubEgoTemplate` (kind skill) | Automático |
| OpenCode | `~/.config/opencode/plugins/`, `.opencode/plugins/` | Plugins JS/TS | Índice (no importable a plantilla) | Manual |
| Gemini CLI | `~/.gemini/agents/*.md`, `.gemini/agents/*.md` | Subagents | `SubEgoTemplate` | Automático |
| Gemini CLI | `~/.gemini/extensions/`, `.gemini/extensions/` | Extensiones (`gemini-extension.json`) | Índice de herramientas | Automático |
| Gemini CLI | `~/.gemini/settings.json`, `.gemini/settings.json` | `agents.overrides`, permisos | Ajustes de instancia | Manual |
| Gemini CLI | `GEMINI.md`, `GEMINI.local.md` | Contexto de proyecto | Contexto (no plantilla) | Automático |
| Qwen Code | `.qwen/fork-profiles/<n>.md` | Perfiles de fork | `SubEgoTemplate` (restricción de tools) | Automático |
| Qwen Code | `.qwen/agents/*.md` | Subagents nombrados | `SubEgoTemplate` | Automático — **ruta inferida** por herencia de Gemini CLI, no verificada en código |
| Codex CLI | `~/.codex/config.toml` | Config y roles | `SubEgoTemplate` | Automático |
| Codex CLI | `~/.codex/agents/*.toml` | Agent roles (crate `codex-rs/agent-roles`) | `SubEgoTemplate` | Automático — **ruta exacta NO VERIFICADA**, sólo el crate |
| Codex CLI | `AGENTS.md` | Contexto de proyecto | Contexto (no plantilla) | Automático |
| Cline | `.clinerules/`, `.cline/rules/`, `~/.clinerules/` | Reglas | Contexto (no plantilla) | Automático |
| Cline | `.cline/skills/`, `.agents/skills/` | Skills | `SubEgoTemplate` (kind skill) | Automático |
| Continue | `.continue/skills/<n>/SKILL.md`, `~/.continue/skills/` | Skills propias | `SubEgoTemplate` (kind skill) | Automático |
| Continue | `.continue/rules/`, `~/.continue/rules/` | Reglas | Contexto | Automático |
| Continue | `config.yaml` / `assistants/*.md` | Asistentes markdown | `SubEgoTemplate` parcial | Manual |
| Goose | `GOOSE_RECIPE_PATH` (dirs), receta `.yaml`/`.json` | Recetas | `SubEgoTemplate` (el mapeo más rico) | Manual |
| Goose | `~/.config/goose/config.yaml` | Extensiones y proveedores | Índice de herramientas | Automático |
| Cursor | `.cursor/rules/*.mdc`, `~/.cursor/rules/` | Reglas | Contexto | Automático — esquema **NO VERIFICADO** |
| Cursor | `.cursor/skills/`, `.cursor/agents/` | Skills y subagents | `SubEgoTemplate` | Automático — rutas **NO VERIFICADAS** |
| Aider | `CONVENTIONS.md`, `.aider.conf.yml` | Convenciones y config | Contexto | Automático |
| ChatGPT | — (servidor) | GPTs del usuario vía API | `SubEgoTemplate` parcial | Manual (API) |
| Claude Desktop | `claude_desktop_config.json` | Servidores MCP | Índice de herramientas | Automático |
| LibreChat | `librechat.yaml` / `librechat-config-yaml` | Config de agentes y MCP | Índice | Automático |
| AnythingLLM | Base de datos (`workspace.agentConfig`, `system_settings.agentSkillWhitelist`) | Agentes y skills | `SubEgoTemplate` | Manual (export de BD) |
| Open WebUI | Base de datos (`skill`, `function`, `tool`) | Skills, functions y tools | `SubEgoTemplate` (kind skill) | Manual (export de BD) |
| Dify | Instancia Dify (plugin daemon) | Plugins y agentes | Índice | Manual (API) |

**Tabla 7.5 — traductores** (de formato de terceros a `SubEgoTemplate`):

| Origen | Traducción | Campos que se pierden |
|---|---|---|
| Claude Code subagent | Directa, campo a campo | `hooks` (Ego usa el bus global), `background` (lo decide el Execution Manager) |
| Gemini CLI subagent | Directa | `kind: remote` (no hay subagent remoto en Ego P0), `timeout_mins` → `budget` aproximado |
| OpenCode agent (JSON o MD) | Directa | `permission{}` por clave → `permissions[]` aplanada, `steps` → `budget.maxTurns` (nuevo campo) |
| Codex role TOML | Directa + aplanado del `config` | Semántica exacta de `ConfigToml` (muchos campos no tienen equivalente) |
| Goose recipe | Directa (la más rica) | `activities` (UI), `retry` (lo aporta el Execution Manager) |
| `SKILL.md` | `kind: skill`, `instructions` = cuerpo Markdown | Toda la identidad de agente: `tools`, permisos, budget, autonomy |
| `AGENTS.md` / reglas | Contexto de proyecto, **no** una plantilla | Todo salvo el texto |
| Marketplace `marketplace.json` | Índice de plantillas | `strict`, `source` remoto, política organizativa |
| `server.json` (MCP) | Subconjunto de `toolsets` + `permissions` | Todo lo que no sea herramienta |

### 7.4 Paralelos con lo ya implementado en Ego ###

| Mecanismo de la industria | Equivalente en Ego | Estado |
|---|---|---|
| `SubEgoManifest` de Claude Code | `packages/subegos/src/SubEgoManifest.ts` (Zod, `id` opaco `ego.*`) | PARALELO |
| `SubEgoSoul` (alma) | `packages/subegos/src/SubEgoSoul.ts` + `docs/architecture/subego-soul.md` | PARALELO |
| Registro/catálogo de agentes | `packages/subegos/src/SubEgoRegistry.ts` (VantaDB `gov/sub_egos`) | PARALELO |
| Catálogo de plantillas por dominio | `packages/subegos/src/templates/domainTemplates.ts` (`DOMAIN_TEMPLATES`) | PARALELO — pero en código, sin versión ni licencia |
| Plantillas oficiales por dominio funcional | `packages/domains/src/templates/officialSubEgoTemplates.ts` (`OFFICIAL_SUBEGO_TEMPLATES`, DOM-06/COUC-10) | PARALELO — mismo `DomainTemplate`, sin versión ni licencia |
| Perfiles de rol (planner/reviewer/researcher/builder) | `DEFAULT_SUBEGO_PROFILES` en `SubEgoRegistry.ts` | PARALELO — el más cercano al `role` de Codex |
| Aislamiento por worktree | `packages/subegos/src/SubEgoWorktree.ts` | PARALELO |
| Delegación entre agentes | `packages/subegos/src/DelegationTools.ts`, `DelegationRouter.ts`, `DelegationRuntime.ts` | PARALELO |
| Concurrencia y cuotas | `packages/execution/src/ExecutionManager.ts` | PARALELO |
| Hooks de ciclo de vida | Bus de eventos + `configureHooks()` (`packages/events/src/EventBus.ts:284`, CFG-09) | PARALELO — sustituye a los hooks por plugin. Ojo: `configureHooks()` no tiene caller de producción (`GOOS-04`), los hooks se evalúan pero nunca se configuran |
| Escaneo y lint de skills | `packages/integrations/src/skills/SkillScanner.ts` + `SkillLinter.ts` | PARALELO (parcial: sólo `.ego/skills` y `~/.ego/skills`) |
| Plataforma de skills (SKILL.md) | `SkillScanner.inspectSkillDirectory()` acepta `SKILL.md`, `skill.md`, `skill.json`, `manifest.json` | PARALELO parcial |
| Instanciación y prompts | `packages/subegos/src/SubEgoFactory.ts`, `PromptAssembly.ts`, `SubEgoBudget.ts` | PARALELO |
| Equipo / enjambre | `docs/architecture/agentes.md` §"Orquestación" + Orchestration Bus | PARALELO |

**Lo que NO existe en Ego y este informe propone**:

1. `SubEgoTemplate` como tipo de primera clase (separado de la instancia).
2. Versionado y `license` en las plantillas del catálogo.
3. Un `SubEgoImportScanner` que recorra las rutas de la tabla 7.4.
4. Exportadores a `SKILL.md`, `AGENTS.md` y formatos de terceros.
5. Un índice de catálogo federado (`index.json` / `marketplace.json`).

---

## 8. Trade-offs y riesgos ##

| Riesgo | Descripción | Mitigación propuesta |
|---|---|---|
| **Bifurcación del estándar** | Si Ego define su propio formato de skill, se rompe la convergencia | Adoptar `SKILL.md` verbatim; añadir campos propios sólo bajo `metadata` |
| **Explosión de superficie** | Cada app añade un parser más que mantener | Un traductor por app, aislado, con tabla de soporte explícita |
| **Importar permisos excesivos** | Una skill importada puede traer `allowed-tools` o `toolsets` agresivos | Importar **siempre** con `autonomy: "supervised"` y budget por defecto; el usuario amplía |
| **Conflicto de IDs** | `createSubEgoId()` deriva de `name`; dos apps pueden proponer el mismo nombre | Prefijar por origen (`ego.imp.claude.reviewer`) y pedir confirmación en colisión |
| **Ejecución de código ajeno** | Un `SKILL.md` puede incluir `scripts/` ejecutables | Reutilizar `SkillLinter` (`DANGEROUS_PATTERNS`) y exigir revisión humana de todo script importado |
| **Prompt injection en descripciones** | La `description` de un agente ajeno dirige el routing del Decision Router | Validar longitud y saneado; marcar `description` importada como no confiable para auto-routing |
| **Deriva de formato** | Los formatos de terceros cambian rápido (Claude Code ya versiona campos por v2.1.x) | Tolerancia a campos desconocidos + `schemaVersion` propio + tests de contrato por app |
| **Licencias no compatibles** | AGPL (Cherry Studio), FSL (Crush), source-available (Claude Code, Dify, n8n, LobeChat) | Catálogo de Ego: sólo OSI (MIT/Apache-2.0/BSD) o atribución; rechazo fail-closed |
| **Sobrecarga de contexto** | Importar 200 agentes de `awesome-copilot` satura el router | Importación selectiva; el catálogo se indexa por `description`, no se inyecta completo |
| **Doble fuente de verdad** | El usuario edita `~/.claude/agents/x.md` y Ego tiene una copia | Marcar `source: "imported"` y ofrecer **re-escaneo**, no sincronización bidireccional |
| **Falsa paridad con los enjambres** | El equipo de Claude Code usa sesiones completas, no subagentes | Modelar el equipo de Ego como N Sub-Egos coordinados por el Meta-Ego, sin prometer paridad de coste |
| **Coste de tokens del enjambre** | Los equipos multi-instancia multiplican el gasto | Aplicar el "Principio de concurrencia justificada" ya vigente en `docs/architecture/agentes.md` |
| **Regla de una sola instancia** | Un `SubEgoManifest` con `state` y `creator` no es publicable | Separar `SubEgoTemplate` de `SubEgoManifest` es la mitigación |

---

## 9. Recomendación para Ego ##

### 9.1 Veredictos por elemento ###

| Elemento | Veredicto | Fundamento |
|---|---|---|
| `SKILL.md` (Agent Skills) como formato de procedimiento | **ADOPTAR** | Estándar oficial con 4 implementaciones que ya se leen entre sí (Claude, OpenCode, Continue, Cline). Es el mínimo denominador común real. |
| Modelo de marketplace de Claude Code (`marketplace.json` + `plugin.json`) | **ADOPTAR** | Resuelve versionado, autoría, licencia, categorización y resolución de rutas relativas. `wshobson/agents` demuestra que es portable multi-harness. |
| Esquema de subagent de Claude Code | **ADOPTAR** (como base del `SubEgoTemplate`) | Es el más completo del ecosistema y mapea casi 1:1 con `SubEgoManifest`. |
| Esquema de receta de Goose | **ADOPTAR** (para equipos y parámetros) | Único formato con parámetros, salida estructurada, reintento y sub-recetas. Complementa al de Claude Code, no lo sustituye. |
| `Agent Card` de A2A | **ADOPTAR** (sólo interop) | Define descubrimiento de agentes remotos; no sirve como formato de plantilla local. |
| Plugins con hooks al estilo Claude Code | **DESCARTAR** | Ego ya tiene el bus de hooks fail-closed (CFG-09). Duplicar hooks por plugin rompe la gobernanza centralizada. |
| Plugins con ejecución de código (estilo OpenCode) | **DESCARTAR** | El runtime de Ego es TypeScript estricto y sin plugin loader; cargar JS de terceros rompe el modelo de seguridad y de tipos. |
| Modos cerrados (Cline, Crush) | **DESCARTAR** | No son portables ni composables. |
| Taxonomía fija de roles de "película" (CrewAI) | **DESCARTAR** | `docs/architecture/agentes.md` ya fijó explícitamente que Ego NO tiene un catálogo rígido de roles. |
| Flujos visuales (Dify, Flowise, Langflow, n8n) | **DESCARTAR** | Colisionan con el runtime propio y con la prohibición de frameworks externos en el núcleo. |
| `AGENTS.md` como mecanismo de plantilla | **DESCARTAR** como plantilla; **ADOPTAR** como contexto | No define identidad de agente. Es el formato de contexto de proyecto. |
| Enjambre tipo Claude Code "agent teams" | **ADOPTAR** como patrón de equipo | Encaja con el Orchestration Bus y el Meta-Ego ya especificados. |
| Enjambre tipo CrewAI (roles + tareas) | **ADOPTAR** sólo el vocabulario (`expected_output`) | `docs/architecture/agentes.md` ya usa `delegate(task, input, expected_output)`. |
| Detección e importación de definiciones existentes | **ADOPTAR** — máxima prioridad | Es la brecha más grande de valor de Ego y no depende de decisiones de política remota. |

### 9.2 Mapa a paquetes y fases ###

**Propuesta de fases (el owner decide el encaje en el Backlog Maestro; este informe no lo modifica):**

| Fase | Paquete | Entregable | Dependencia |
|---|---|---|---|
| A. Modelo | `packages/subegos` | Tipo `SubEgoTemplate` (Zod) + `SubEgoTemplateSchema` + `templateToManifest()` | Ninguna |
| B. Catálogo | `packages/subegos` + `packages/domains` | `DOMAIN_TEMPLATES` y `OFFICIAL_SUBEGO_TEMPLATES` migrados a `SubEgoTemplate` con `meta.version` y `meta.license`; registro `gov/sub_egos_templates` reutilizando el patrón de `SubEgoRegistry` | A |
| C. Exportadores | `packages/subegos/src/export/` | `toAgentSkill()`, `toAgentsMd()`, `toGeminiAgent()`, `toOpenCodeAgent()`, `toClaudeSubagent()`, `toMarketplaceJson()` | A |
| D. Importador | `packages/integrations/src/agentImport/` | `SubEgoImportScanner` (rutas de la tabla 7.4) + traductores por app + previsualización | A, B |
| E. Seguridad | `packages/integrations/src/skills/SkillLinter.ts` | Extender el linter a los formatos de agente importados (no sólo skills) | D |
| F. Índice federado | `packages/subegos/src/catalog/` | `index.json` de catálogo local; lector de `marketplace.json` remoto | B, C |

**Nota de guardrails**: esta propuesta **no** introduce ninguna dependencia externa, **no** toca `packages/models/`,
**no** añade frameworks de
agentes al core, **no** accede a VantaDB fuera de `EgoMemoryAdapter` y **no** ejecuta código de terceros sin pasar por
`SkillLinter` +
aprobación humana. Es compatible con los 10 principios innegociables.

### 9.3 Por qué el importador es lo primero ###

1. Es la única parte del conjunto que entrega valor **sin** decidir la política de publicación remota.
2. Consume directamente el `SkillScanner`/`SkillLinter` ya implementados, que hoy sólo buscan en `.ego/skills` y
   `~/.ego/skills`.
3. Es reversible: importar no modifica nada del sistema de terceros; desimportar es borrar un registro en VantaDB.
4. Valida el modelo `SubEgoTemplate` con casos reales y heterogéneos antes de que se use para publicar.
5. Genera el catálogo propio de Ego a partir de lo que el usuario ya tiene, lo que ataca de frente el arranque en frío
   del catálogo.

---

## 10. Deuda abierta y preguntas para el owner ##

| # | Pregunta | Contexto técnico | Opciones | Recomendación |
|---|---|---|---|---|
| 1 | ¿El catálogo de plantillas de Ego es local-only o se publica en un registro remoto? | Un registro remoto exige decidir identidad, firma, moderación y RGPD del `description` de cada plantilla | (a) sólo local + `index.json` exportable; (b) registro remoto estilo MCP Registry; (c) híbrido | **(a) Local + exportable** en primera iteración |
| 2 | ¿Una plantilla importada conserva la licencia del original? | Sin esto, Ego podría re-licenciar material AGPL o source-available | (a) conservar siempre; (b) exigir SPDX OSI y re-licenciar; (c) rechazo total de no-OSI | **(a) Conservar siempre** + mostrar aviso visible |
| 3 | ¿`SubEgoTemplate` es un tipo nuevo o un `SubEgoManifest` con campos opcionales? | Un tipo nuevo garantiza que la plantilla no arrastra estado; uno solo reduce el código | (a) tipo nuevo con subtipo de manifiesto; (b) campos opcionales en el manifiesto | **(a)** — evita que una plantilla "herede" `state: "active"` |
| 4 | ¿El `role` de Codex (capa de configuración aplanada) es el modelo, o una `enum` cerrada? | Una `enum` es más validable; una capa es más flexible | (a) `enum` de dominios de `docs/architecture/dominios-funcionales.md`; (b) string libre con validación de longitud | **(b) string libre validado**, con `domain` separado |
| 5 | ¿Los "equipos" son una primera clase en Ego o una composición de Sub-Egos? | Un equipo persistido simplifica el modelo de tarea compartida pero añade un objeto nuevo | (a) composición efímera; (b) `SubEgoTeam` persistido con lista de tareas | **(a)** primero; (b) sólo si el uso lo justifica |
| 6 | ¿Se importan también *plugins* (con código) o sólo *agentes* y *skills*? | Importar código de terceros es un salto de riesgo grande | (a) sólo agentes y skills; (b) también plugins auditados | **(a)** en primera iteración |
| 7 | ¿El catálogo remoto de Ego publica `SubEgoTemplate` o sólo *referencias* a plantillas de terceros? | Publicar de terceros implicaría redistribuir material con licencias ajenas | (a) publicar sólo plantillas propias; (b) publicar referencias (URL + versión) | **(b) referencias** |
| 8 | ¿Dónde vive el catálogo por defecto, en `packages/subegos/src/templates/` o en un asset descargable? | El código empaquetado no se puede actualizar sin reinstalar | (a) código; (b) asset versionado en el repo; (c) mixto (base en código + extras descargables) | **(c) mixto** |
| 9 | ¿La importación exige confirmación por elemento o por lote? | Lotes grandes → riesgo de aprobar de más; por elemento → fricción | (a) por elemento; (b) por lote con lista previa; (c) ambos | **(c)** con la lista previa siempre |
| 10 | ¿Se implementa `budget.maxTurns` (nuevo) o se sigue aproximando con `maxTokensPerCall`? | `maxTurns` es un límite de coordinación, no de coste; traducirlo a tokens es incorrecto | (a) añadir `maxTurns`; (b) no traducirlo y marcar la pérdida | **(a)** añadir `maxTurns` al manifiesto |

### 10.1 Verificaciones pendientes explícitamente ###

- Ruta exacta de los "agent roles" de Codex en disco (`~/.codex/agents/` **NO VERIFICADO**; sólo se verificó el crate
  `codex-rs/agent-roles`).
- Esquema de `.cursor/rules/*.mdc` y rutas de skills/subagents de Cursor (**NO VERIFICADO**: la documentación de Cursor
  se renderiza en
  cliente y no fue extraíble de forma fiable en esta sesión).
- Ruta de subagents nombrados de Qwen Code (`.qwen/agents/`) — **inferida** por herencia de Gemini CLI, no verificada en
  código.
- Campos exactos del manifiesto de extensión de Gemini CLI (`gemini-extension.json`) — **NO VERIFICADO** en esta sesión.
- Mecanismo de "custom GPT" de ChatGPT y su API de administración — **NO VERIFICADO** (la documentación de OpenAI
  devolvió 403).
- Licencia del código Python de `microsoft/autogen`: el `LICENSE` de la raíz es **CC-BY-4.0** (documentación) y el
  `LICENSE-CODE` es **MIT** (código). Ambos verificados por lectura directa.

---

## Anexo A — Resumen de evidencia ##

### A.1 Repositorios verificados ###

Estrellas y fecha de push consultadas el 2026-10-20 vía `api.github.com` y `ungh.cc`; licencia detectada leyendo el
fichero `LICENSE*` en
`raw.githubusercontent.com`.

| Repositorio | Estrellas | Último push | Licencia | Nota |
|---|---|---|---|---|
| n8n-io/n8n | 208 095 | 2026-10-20 | Sustainable Use License (fair-code, no OSI) | Source-available |
| sst/opencode | 218 183 | 2026-10-20 | MIT | — |
| anthropics/skills | 182 334 | 2026-10-09 | Sin `LICENSE` raíz; skills docx/pdf/pptx/xlsx source-available (Anthropic) | Mezcla |
| github/spec-kit | 142 012 | 2026-10-19 | MIT | — |
| openai/codex | 130 005 | 2026-10-20 | Apache-2.0 | — |
| langgenius/dify | 158 980 | 2026-10-20 | Apache-2.0 **modificado** (no OSI) | Source-available |
| langflow-ai/langflow | 155 859 | 2026-10-20 | MIT | — |
| open-webui/open-webui | 156 230 | 2026-10-19 | BSD-3 con cláusula de marca (Open WebUI License) | Atribución + restricción de marca |
| anthropics/claude-code | 152 812 | 2026-10-19 | Propietario (© Anthropic PBC) | **No reutilizable** |
| google-gemini/gemini-cli | 107 460 | 2026-10-20 | Apache-2.0 | Sustituido por Antigravity CLI el 2026-06-18 |
| microsoft/ai-agents-for-beginners | 77 496 | 2026-10-18 | MIT | Material educativo |
| cline/cline | 70 587 | 2026-10-20 | Apache-2.0 | — |
| Mintplex-Labs/anything-llm | 67 343 | 2026-10-20 | MIT | — |
| microsoft/autogen | 61 495 | 2026-10-16 | CC-BY-4.0 en raíz + `LICENSE-CODE` MIT | Licencia del código Python verificada |
| crewAIInc/crewAI | 59 901 | 2026-10-20 | MIT | — |
| block/goose | 55 457 | 2026-10-20 | Apache-2.0 | Lenguaje principal: Rust |
| FlowiseAI/Flowise | 55 512 | 2026-08-13 | `LICENSE.md` mixto por sección (API: `NOASSERTION`) | **Archivado e inactivo desde 2026-08-13** |
| CherryHQ/cherry-studio | 52 780 | 2026-10-20 | **AGPL-3.0** | Copyleft fuerte — excluir |
| Aider-AI/aider | 49 652 | 2026-05-22 | Apache-2.0 | — |
| LibreChat-AI/LibreChat | 46 041 | 2026-10-20 | MIT | — |
| janhq/jan | 45 019 | 2026-10-20 | Apache-2.0 con cabecera no estándar (API: `NOASSERTION`) | — |
| langchain-ai/langgraph | 43 554 | 2026-10-19 | MIT | — |
| anthropics/claude-plugins-official | 43 265 | 2026-10-20 | Apache-2.0 | — |
| wshobson/agents | 41 202 | 2026-10-19 | MIT | Marketplace multi-harness (92 plugins, 202 agentes, 185 skills) |
| github/awesome-copilot | 40 207 | 2026-10-19 | MIT | 222 agentes |
| continuedev/continue | 36 271 | 2026-10-19 | Apache-2.0 | — |
| VoltAgent/awesome-agent-skills | 36 035 | 2026-10-19 | MIT | 1 000+ skills |
| charmbracelet/crush | 28 719 | 2026-10-20 | **FSL-1.1-MIT** (API: `NOASSERTION`) | Copyleft con retraso — excluir |
| QwenLM/qwen-code | 28 591 | 2026-10-20 | Apache-2.0 | — |
| Kilo-Org/kilocode | 27 662 | 2026-10-20 | MIT | Derivado de Roo/OpenCode |
| a2aproject/A2A | 26 219 | 2026-10-19 | Apache-2.0 | — |
| RooCodeInc/Roo-Code | 24 276 | 2026-05-15 | Apache-2.0 | **ARQUIVADO** desde 2026-05-15 |
| punkpeye/awesome-mcp-servers | 96 640 | 2026-10-18 | MIT | — |
| modelcontextprotocol/servers | 91 397 | 2026-10-19 | MIT → Apache-2.0 (transición declarada) | — |
| anthropics/claude-plugins-community | 4 698 | 2026-10-20 | Apache-2.0 | Espejo de solo lectura |
| modelcontextprotocol/registry | 7 382 | 2026-10-14 | MIT → Apache-2.0 (transición declarada) | — |
| anthropics/claude-agent-sdk-python | 8 304 | 2026-10-19 | MIT | — |
| lobehub/lobe-chat | 83 352 | 2026-10-20 | LobeHub Community License (source-available) | Atribución + condiciones |
| lobehub/lobe-chat-agents | 1 239 | 2026-10-15 | MIT | Índice federado |
| obra/superpowers-marketplace | 1 302 | 2026-10-10 | MIT | — |
| lobehub/lobe-chat-plugins | 300 | 2026-10-15 | MIT | Índice federado |

### A.2 Ficheros concretos leídos ###

| Ruta | Qué contiene |
|---|---|
| `anthropics/skills/.claude-plugin/marketplace.json` | Ejemplo real de `marketplace.json` con `plugins[].skills[]` |
| `anthropics/skills/spec/agent-skills-spec.md` | Puntero de 87 bytes a `agentskills.io/specification` |
| `anthropics/skills/template/SKILL.md` | Plantilla mínima de skill (`name` + `description`) |
| `anthropics/skills/skills/docx/LICENSE.txt` | Licencia source-available de las skills de documentos |
| `sst/opencode` → `packages/web/src/content/docs/agents.mdx` | Formato de agente OpenCode (JSON y Markdown) |
| `sst/opencode` → `packages/web/src/content/docs/config.mdx` | 8 capas de precedencia de configuración |
| `sst/opencode` → `packages/web/src/content/docs/skills.mdx` | Rutas de descubrimiento de skills (incluye `.claude/` y `.agents/`) |
| `google-gemini/gemini-cli` → `docs/core/subagents.md` | Esquema de subagent Gemini CLI, aislamiento, política |
| `google-gemini/gemini-cli` → `docs/cli/skills.md`, `docs/cli/creating-skills.md` | Skills en Gemini CLI |
| `QwenLM/qwen-code` → `docs/users/features/sub-agents.md` | Subagents, forks, `fork_tools`, `fork_profile`, `executor` |
| `QwenLM/qwen-code` → `docs/users/features/multi-agent-coordination.md` | Agent Team, Arena, Herdr |
| `openai/codex` → `codex-rs/agent-roles/src/agent_role_config.rs` | Esquema del rol Codex (`name`, `description`, `nickname_candidates`, `config` aplanado) |
| `openai/codex` → `codex-rs/skills/src/model.rs` | `SkillMetadata` de Codex con `scope`, `policy`, `plugin_id` |
| `openai/codex` → `codex-rs/` (listado) | Crates `agent-roles`, `skills`, `core-plugins`, `collaboration-mode-templates`, `worktree`, `memories` |
| `block/goose` → `documentation/docs/guides/recipes/recipe-reference.md` | Esquema completo de receta Goose |
| `continuedev/continue` → `core/config/markdown/loadMarkdownSkills.ts` | Descubrimiento de skills, incluida `.claude/skills/` |
| `modelcontextprotocol/registry` → `docs/reference/server-json/generic-server-json.md` | Esquema `server.json` |
| `a2aproject/A2A` → `docs/specification.md` | Capas del protocolo y `AgentCard` |
| `langgenius/dify` → `api/core/plugin/entities/plugin.py` | `PluginDeclaration`, permisos por recurso, categorías |
| `open-webui/open-webui` → `backend/open_webui/models/skills.py` | Esquema de tabla `skill` con `version_id` y `meta.tags` |
| `Mintplex-Labs/anything-llm` → `server/models/agentSkillWhitelist.js` | Whitelist de skills por usuario |
| `wshobson/agents` → `.claude-plugin/marketplace.json` | Marketplace real con 92 plugins |
| `wshobson/agents` → `plugins/agent-teams/.claude-plugin/plugin.json` | `plugin.json` real |
| `wshobson/agents` → `plugins/agent-teams/agents/team-lead.md` | Modelo de equipo: ownership, tareas, ciclo de vida, `~/.claude/teams/<team>/config.json` |
| `github/awesome-copilot` → `agents/devils-advocate.agent.md` | Formato de agente adversarial |
| `github/awesome-copilot` → `agents/gem-orchestrator.agent.md` | Formato de agente orquestador con fases |

### A.3 Documentación oficial consultada ###

| URL | Qué se extrajo |
|---|---|
| `https://agentskills.io/specification` | Especificación completa de `SKILL.md` |
| `https://code.claude.com/docs/en/sub-agents.md` | Tabla de frontmatter y jerarquía de ubicaciones |
| `https://code.claude.com/docs/en/agent-teams.md` | Modelo de equipo y comparación con subagents |
| `https://code.claude.com/docs/en/plugins/marketplace-reference.md` | Esquema de `marketplace.json` y nombres reservados |
| `https://code.claude.com/docs/en/claude-directory.md` | Tabla completa de ficheros y ubicaciones |
| `https://code.claude.com/docs/en/skills.md` | Fusión comandos↔skills yPaths de skills |
| `https://opencode.ai/docs/agents/`, `/docs/config/`, `/docs/skills/`, `/docs/plugins/` | Agentes, configuración, skills y plugins |
| `https://agents.md` | Formato `AGENTS.md` y lista de agentes compatibles |
| `https://docs.cline.bot/features/cline-rules` | Tipos de reglas y rutas |
| `https://docs.cursor.com/context/rules` (índice de navegación) | Superficie de personalización de Cursor |
| `https://www.librechat.ai/docs/features/agents` | Agent Builder, Tools, Skills y Agent Plugins |
| `https://geminicli.com/docs/extensions/` (índice) | Estado de Gemini CLI y su catálogo de features |
| `https://docs.cline.bot/features/cline-rules` | Reglas cross-tool |

---

## Anexo B — Glosario de equivalencias ##

| Concepto industrial | Concepto Ego | Nota |
|---|---|---|
| Subagent / subagent definition | `SubEgoManifest` | Instancia viva |
| Agent template / role file | `SubEgoTemplate` (**propuesto**) | Portátil, versionable |
| Skill | Skill (`SKILL.md`) | Procedimiento invocable; **no** es un agente |
| Plugin / marketplace | `SubEgoTemplate` + índice | Publicable |
| Subagent team / crew | Composición del Meta-Ego + `SubEgo`s | Ya descrito en `docs/architecture/agentes.md` |
| Agent card (A2A) | Contrato de descubrimiento remoto | No es plantilla local |
| Profile (modelo + sandbox + toolsets) | `SubEgoProfile` (`planner`/`reviewer`/`researcher`/`builder`) | Ya implementado |
| Hooks de plugin | Bus de eventos + `configureHooks()` (CFG-09) | Ya implementado |
| Worktree de teammate | `SubEgoWorktree` | Ya implementado |
| Delegation / task | `delegate(task, input, expected_output)` | Ya implementado |

---

## Verificación de datos (2026-10-20) ##

Auditoría independiente de este informe. Cada repositorio se reconsultó en
`GET /repos/{owner}/{repo}` de la API REST de GitHub el 2026-10-20 y se
compararon `stargazers_count`, `pushed_at`, `license.spdx_id`, `language` y
`archived`. Las licencias dudosas (`NOASSERTION`) se resolvieron leyendo el
fichero de licencia en `raw.githubusercontent.com`. Los recuentos de ficheros se
verificaron con el árbol Git (`/git/trees/HEAD?recursive=1`). Las rutas
marcadas como NO VERIFICADO en §10.1 se mantienen como tales: no se sustituye
ninguna cifra por una estimación.

| Dato verificado | Valor declarado | Valor real | Fuente | Estado |
| --- | --- | --- | --- | --- |
| `anthropics/claude-plugins-official` — estrellas | 43 102 | 43 265 | API `stargazers_count` | Corregido |
| `anthropics/claude-plugins-official` — último push | 2026-10-19 | 2026-10-20 | API `pushed_at` | Corregido |
| `anthropics/claude-plugins-community` — último push | 2026-10-19 | 2026-10-20 | API `pushed_at` | Corregido |
| `wshobson/agents` — estrellas | 41 150 | 41 202 | API `stargazers_count` | Corregido |
| `wshobson/agents` — número de skills | 181 | 185 | árbol `git/trees?recursive=1` | Corregido |
| `wshobson/agents` — número de plugins | 92 | 92 | árbol `git/trees?recursive=1` | Correcto |
| `wshobson/agents` — número de agentes | 202 | 202 | árbol `git/trees?recursive=1` | Correcto |
| `wshobson/agents` — `.codex-plugin/` | en la raíz del repo | sólo dentro de cada plugin (104 rutas) | árbol `git/trees?recursive=1` | Corregido |
| `github/awesome-copilot` — estrellas | 40 185 | 40 207 | API `stargazers_count` | Corregido |
| `github/awesome-copilot` — último push | 2026-10-16 | 2026-10-19 | API `pushed_at` | Corregido |
| `github/awesome-copilot` — número de `agents/*.agent.md` | ~230 | 222 | árbol `git/trees?recursive=1` | Corregido |
| `VoltAgent/awesome-agent-skills` — estrellas | 36 033 | 36 035 | API `stargazers_count` | Corregido |
| `punkpeye/awesome-mcp-servers` — estrellas | 96 631 | 96 640 | API `stargazers_count` | Corregido |
| `modelcontextprotocol/servers` — estrellas | 91 361 | 91 397 | API `stargazers_count` | Corregido |
| `modelcontextprotocol/servers` — licencia | MIT → Apache-2.0 | transición declarada en el `LICENSE`; la API devuelve `NOASSERTION` | `LICENSE` | Correcto |
| `modelcontextprotocol/registry` — estrellas | 7 382 | 7 382 | API `stargazers_count` | Correcto |
| `obra/superpowers-marketplace` — estrellas | 1 302 | 1 302 | API `stargazers_count` | Correcto |
| `lobehub/lobe-chat-agents` — estrellas | 1 239 | 1 239 | API `stargazers_count` | Correcto |
| `lobehub/lobe-chat-plugins` — estrellas | 300 | 300 | API `stargazers_count` | Correcto |
| `github/spec-kit` — estrellas | 141 994 | 142 012 | API `stargazers_count` | Corregido · unificado con `backoffice-empresa-personal.md` (142 011) |
| `n8n-io/n8n` — estrellas | 208 014 | 208 095 | API `stargazers_count` | Corregido · unificado con `backoffice-empresa-personal.md` (208 093) y `automatizacion-y-agentes-ejecucion.md` (208 093) |
| `n8n-io/n8n` — último push | 2026-10-19 | 2026-10-20 | API `pushed_at` | Corregido |
| `n8n-io/n8n` — licencia | Sustainable Use License | Sustainable Use License en `LICENSE.md`; API `NOASSERTION` | `LICENSE.md` | Correcto |
| `sst/opencode` — estrellas | 217 702 | 218 183 | API `stargazers_count` | Corregido |
| `sst/opencode` — último push | 2026-10-19 | 2026-10-20 | API `pushed_at` | Corregido |
| `anthropics/skills` — estrellas | 182 267 | 182 334 | API `stargazers_count` | Corregido |
| `anthropics/skills` — licencia de la raíz | sin `LICENSE` | sin fichero de licencia en la raíz (`LICENSE` y `LICENSE.md` dan 404) | `raw` | Correcto |
| `openai/codex` — estrellas | 129 996 | 130 005 | API `stargazers_count` | Corregido |
| `openai/codex` — licencia | Apache-2.0 | Apache-2.0 | API `spdx_id` | Correcto |
| `langgenius/dify` — estrellas | 158 951 | 158 980 | API `stargazers_count` | Corregido · unificado con `automatizacion-y-agentes-ejecucion.md` (158 976) |
| `langflow-ai/langflow` — estrellas | 155 851 | 155 859 | API `stargazers_count` | Corregido · unificado con `automatizacion-y-agentes-ejecucion.md` (155 859) |
| `open-webui/open-webui` — estrellas | 156 214 | 156 230 | API `stargazers_count` | Corregido · unificado con `automatizacion-y-agentes-ejecucion.md` (156 230) |
| `open-webui/open-webui` — licencia | BSD-3 con marca | Open WebUI License (BSD-3 con cláusula de marca) | `LICENSE` | Correcto |
| `anthropics/claude-code` — estrellas | 152 642 | 152 812 | API `stargazers_count` | Corregido · unificado con `orquestacion-multiagente.md` (152 804) |
| `google-gemini/gemini-cli` — estrellas | 107 458 | 107 460 | API `stargazers_count` | Corregido |
| `google-gemini/gemini-cli` — último push | 2026-10-19 | 2026-10-20 | API `pushed_at` | Corregido |
| `microsoft/ai-agents-for-beginners` — licencia | No verificada | MIT | API `spdx_id` | Corregido |
| `cline/cline` — estrellas | 70 565 | 70 587 | API `stargazers_count` | Corregido |
| `cline/cline` — último push | 2026-10-19 | 2026-10-20 | API `pushed_at` | Corregido |
| `Mintplex-Labs/anything-llm` — estrellas | 67 330 | 67 343 | API `stargazers_count` | Corregido · unificado con `automatizacion-y-agentes-ejecucion.md` (67 343) |
| `microsoft/autogen` — estrellas | 61 492 | 61 495 | API `stargazers_count` | Corregido · unificado con `orquestacion-multiagente.md` (61 495) |
| `microsoft/autogen` — licencia del código Python | no verificada | MIT (`LICENSE-CODE`); la raíz es CC-BY-4.0 | `LICENSE-CODE` | Corregido |
| `crewAIInc/crewAI` — estrellas | 59 890 | 59 901 | API `stargazers_count` | Corregido · unificado con `orquestacion-multiagente.md` y `automatizacion-y-agentes-ejecucion.md` |
| `block/goose` — estrellas | 55 435 | 55 457 | API `stargazers_count` | Corregido |
| `block/goose` — último push | 2026-10-19 | 2026-10-20 | API `pushed_at` | Corregido |
| `FlowiseAI/Flowise` — estrellas | 55 513 | 55 512 | API `stargazers_count` | Corregido |
| `FlowiseAI/Flowise` — estado | inactivo desde 2026-08-13 | `archived: true`, último push 2026-08-13 | API `archived` | Corregido |
| `CherryHQ/cherry-studio` — estrellas | 52 771 | 52 780 | API `stargazers_count` | Corregido |
| `Aider-AI/aider` — estrellas | 49 648 | 49 652 | API `stargazers_count` | Corregido |
| `LibreChat-AI/LibreChat` — estrellas | 46 027 | 46 041 | API `stargazers_count` | Corregido · unificado con `automatizacion-y-agentes-ejecucion.md` (46 039) |
| `janhq/jan` — estrellas | 45 020 | 45 019 | API `stargazers_count` | Corregido |
| `janhq/jan` — licencia | Apache-2.0 | Apache-2.0 en el `LICENSE`; la API devuelve `NOASSERTION` por cabecera no estándar | `LICENSE` | Corregido |
| `langchain-ai/langgraph` — estrellas | 43 554 | 43 554 | API `stargazers_count` | Correcto |
| `continuedev/continue` — estrellas | 36 257 | 36 271 | API `stargazers_count` | Corregido |
| `continuedev/continue` — último push | 2026-10-18 | 2026-10-19 | API `pushed_at` | Corregido |
| `charmbracelet/crush` — estrellas | 28 711 | 28 719 | API `stargazers_count` | Corregido |
| `charmbracelet/crush` — licencia | FSL-1.1-MIT | FSL-1.1-MIT en `LICENSE.md`; la API devuelve `NOASSERTION` | `LICENSE.md` | Correcto |
| `QwenLM/qwen-code` — estrellas | 28 586 | 28 591 | API `stargazers_count` | Corregido |
| `QwenLM/qwen-code` — último push | 2026-10-19 | 2026-10-20 | API `pushed_at` | Corregido |
| `Kilo-Org/kilocode` — estrellas | 27 664 | 27 662 | API `stargazers_count` | Corregido |
| `a2aproject/A2A` — estrellas | 26 218 | 26 219 | API `stargazers_count` | Corregido · unificado con `orquestacion-multiagente.md` (26 217) |
| `RooCodeInc/Roo-Code` — archivado | ARQUIVADO desde 2026-05-15 | `archived: true`, último push 2026-05-15 | API `archived` | Correcto |
| `anthropics/claude-agent-sdk-python` — estrellas | 8 300 | 8 304 | API `stargazers_count` | Corregido |
| `anthropics/claude-agent-sdk-python` — licencia | No verificada | MIT | API `spdx_id` | Corregido |
| `lobehub/lobe-chat` — estrellas | 83 342 | 83 352 | API `stargazers_count` | Corregido · unificado con `automatizacion-y-agentes-ejecucion.md` (83 352) |
| Ficheros de `anthropics/skills` (`.claude-plugin/marketplace.json`, `spec/agent-skills-spec.md`, `template/SKILL.md`, `skills/docx/LICENSE.txt`) | declarados | los 4 existen; el puntero `agent-skills-spec.md` mide 87 bytes | `raw.githubusercontent.com` | Correcto |
| Ficheros de `sst/opencode` (`packages/web/src/content/docs/{agents,config,skills}.mdx`) | declarados | los 3 existen | clonado local | Correcto |
| Ficheros de `google-gemini/gemini-cli` (`docs/core/subagents.md`, `docs/cli/skills.md`, `docs/cli/creating-skills.md`) | declarados | los 3 existen | clonado local | Correcto |
| Ficheros de `QwenLM/qwen-code` (`docs/users/features/sub-agents.md`, `docs/users/features/multi-agent-coordination.md`) | declarados | los 2 existen | clonado local | Correcto |
| `openai/codex` — `codex-rs/agent-roles/src/agent_role_config.rs` | `name`, `description`, `nickname_candidates` y `config` aplanado | los 4 campos existen; `#[serde(flatten)]` en la línea 26 | clonado local | Correcto |
| `openai/codex` — ficheros de `codex-rs/skills` (`model.rs`, `parser.rs`, `selection.rs`, `loading.rs`, `mentions.rs`) | declarados | los 5 existen | clonado local | Correcto |
| `openai/codex` — crates (`agent-roles`, `skills`, `core-plugins`, `plugin`, `collaboration-mode-templates`, `worktree`, `memories`, `agent-message-board-client`, `runtime-agent-instance`) | declarados | los 9 existen | clonado local | Correcto |
| `block/goose` — `documentation/docs/guides/recipes/recipe-reference.md` | declarado | existe | clonado local | Correcto |
| `continuedev/continue` — `core/config/markdown/loadMarkdownSkills.ts`, `loadMarkdownRules.ts`, `loadCodebaseRules.ts` | declarados | los 3 existen; `skillFrontmatterSchema` en `loadMarkdownSkills.ts:13` | clonado local | Correcto |
| Ficheros de terceros (`modelcontextprotocol/registry`, `a2aproject/A2A`, `langgenius/dify`, `open-webui/open-webui`, `Mintplex-Labs/anything-llm`, `wshobson/agents`, `github/awesome-copilot`) | declarados | los 14 existen | `raw.githubusercontent.com` | Correcto |
| `packages/events/src/EventBus.ts:284` — `configureHooks()` | bus de hooks implementado | existe, pero **sin caller de producción** (`GOOS-04`): los hooks se evalúan y nunca se configuran | lectura local | Corregido |
| Rutas de `packages/subegos/src/*`, `packages/integrations/src/skills/*`, `packages/execution/src/*`, `packages/tools/src/*` | declaradas | todas existen (`SubEgoManifest.ts`, `SubEgoSoul.ts`, `SubEgoRegistry.ts`, `SubEgoWorktree.ts`, `templates/domainTemplates.ts`, `DelegationRouter.ts`, `DelegationTools.ts`, `DelegationRuntime.ts`, `SubEgoFactory.ts`, `SkillScanner.ts`, `SkillLinter.ts`, `ExecutionManager.ts`, `ToolRegistry.ts`) | árbol local | Correcto |
| Rutas en disco de formatos de terceros (`~/.codex/agents/`, `.cursor/rules/*.mdc`, `.cursor/skills/`, `.qwen/agents/`) | marcadas NO VERIFICADO en §10.1 | sin verificar | — | No verificado (2026-10-20) |
| Campos de `gemini-extension.json` y API de administración de GPTs de ChatGPT | marcadas NO VERIFICADO en §10.1 | sin verificar | — | No verificado (2026-10-20) |
| Documentación web citada (`code.claude.com/docs/**.md`, `agentskills.io/specification`, `opencode.ai/docs`, `geminicli.com`, `docs.cursor.com`, `docs.cline.bot`, `www.librechat.ai`) | citada | no re-verificada en esta auditoría | — | No verificado (2026-10-20) |

Notas de la auditoría:

- Ningún repositorio citado en §5 y en el Anexo A.1 resultó inexistente. Todos
  existen y todas las licencias declaradas se confirman leyendo el fichero de
  licencia; en tres casos (`janhq/jan`, `charmbracelet/crush`,
  `modelcontextprotocol/servers`) la API devuelve `NOASSERTION` pero el
  `LICENSE` es el declarado.
- Las diferencias de una o dos estrellas son deriva en vivo entre la consulta
  original y la de auditoría, no un error de dato.
- Los ficheros de repos que no están clonados en `repos-referencia/` se
  comprobaron por HTTP sobre `raw.githubusercontent.com`, sin verificar el
  número de línea.

**Recuento**: 77 cifras verificadas · 52 corregidas · 3 marcadas "no
verificado".
