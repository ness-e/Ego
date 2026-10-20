# Compatibilidad de integraciones MCP, skills, plugins y conectores #

| Campo | Valor |
| --- | --- |
| Estado | Activo — investigación de estado del arte, no normativo |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Alcance | Reutilizar el ecosistema de integraciones ya existente sin reescribirlo |
| Fuentes primarias | 12 repos clonados en `repos-referencia/` + API de GitHub + spec MCP viva |
| Licencia del informe | Apache 2.0 (misma que Ego) |

> Documento de investigación. No introduce tareas al Backlog ni implementa nada.
> La arquitectura de integraciones ya decidida vive en
> [`docs/engineering/integraciones.md`](../engineering/integraciones.md) y este
> informe **no la contradice**: la analiza, identifica huecos reales y propone
> cómo ampliar el ecosistema reutilizando lo que ya existe.

---

## 1. Resumen ejecutivo ##

Ego no debe construir un ecosistema de integraciones propio: debe **importar** el
de los demás. La evidencia es que hoy existen tres estándares abiertos y ya
adoptados masivamente que cubren casi todo lo que Ego necesita:

1. **MCP** es el estándar de facto para servidores de herramientas (91 k estrellas
   en `modelcontextprotocol/servers`, 96 k en `punkpeye/awesome-mcp-servers`).
   Ego ya lo consume y lo emite; el trabajo pendiente es de **versión y cobertura**,
   no de arquitectura.
2. **Agent Skills** (`SKILL.md`) es un estándar abierto de instrucciones
   empaquetadas, con 50+ clientes declarados en `agentskills.io` (Claude Code,
   Cursor, Codex, Gemini CLI, OpenCode, Goose, Copilot, VS Code...). Es portable
   tal cual.
3. **AGENTS.md** es Markdown libre para reglas de repo, usado en 60 k+ repos y
   gobernado ya por la Agentic AI Foundation (Linux Foundation).

La estrategia recomendada es una **capa de importación en dos capas**:

- **MCP** para todo lo que expone *herramientas*: se reutilizan tal cual, con un
  traductor de configuración de ~200 líneas por familia de formato.
- **Agent Skills + AGENTS.md** para todo lo que expone *conocimiento procedural*:
  son Markdown, se importan copiando directorios, sin traducción semántica.

El precedente más valioso del ecosistema es `codex-rs/external-agent-migration`:
Codex ya resuelve exactamente este problema (detectar configs de Claude Code y
Cursor, traducirlos, migrarlos) y su diseño es directamente extrapolable a Ego.

El hueco más urgente de Ego no está en la importación sino en el **cliente MCP**:
`McpClient` está fijado a la revisión `2024-11-05` del protocolo, dos eras por
detrás de la revisión vigente `2026-07-28`, y **anuncia capacidades que no
cumple** (`roots`). Eso degrada a los servidores oficiales antes de importar nada.

---

## 2. Metodología ##

### 2.1 Alcance de la inspección local ###

Se inspeccionaron directamente, en `repos-referencia/`, los repos clonados:
`hermes-agent`, `opencode`, `mcp-servers`, `cline`, `continue`, `goose`,
`gemini-cli`, `qwen-code`, `codex`. Para cada uno se buscaron las **constantes
de ruta** y los **puntos de parseo**, no la documentación secundaria.

Criterio de evidencia aceptado en este informe:

- `ruta:línea` apunta a código clonado y verificado en esta sesión.
- Una ruta no verificada en local se marca explícitamente como
  **no verificada** y se indica cómo verificarla.
- Toda cifra de estrellas, fecha de push o licencia procede de
  `api.github.com/repos/<org>/<repo>` consultada el 2026-10-20.

### 2.2 Verificación remota ###

Se consultó la API pública de GitHub para 41 repos. Cuando un repo devolvió
`404` se buscó su nombre real vía `GET /search/repositories` (así se corrigieron
`mcpo` → `open-webui/mcpo`, `mcp-proxy` → `sparfenyuk/mcp-proxy` y
`mcp-router` → `mcp-router/mcp-router`). Tres repos han cambiado de nombre
desde la redacción y se corrigen aquí: `jlowin/fastmcp` → `PrefectHQ/fastmcp`,
`stripe/agent-toolkit` → `stripe/ai` y `anthropics/claude-agent-sdk` →
`anthropics/claude-agent-sdk-typescript`.

Se consultó la especificación MCP viva en
`modelcontextprotocol/modelcontextprotocol@main` (`docs/specification/2026-07-28/`),
el esquema del registro en `modelcontextprotocol/registry@main`
(`docs/reference/server-json/generic-server-json.md`) y el estándar Agent Skills
en `agentskills.io/specification`.

### 2.3 Límites de esta investigación ###

- No se ejecutó ningún servidor MCP real ni se midió el comportamiento de
  servidores de terceros: el análisis es de contrato y de código.
- Las rutas de las apps web (Dify, Flowise, Langflow, n8n, ActivePieces,
  Windmill, LobeChat, LibreChat, AnythingLLM, Open WebUI, Jan, Cherry Studio) se
  declaran **no importables**: su configuración vive en la base de datos del
  servidor o en el perfil interno de la app, no en un fichero local canónico.
- `docs/engineering/integraciones.md` se trata como **decidido**. Ninguna
  propuesta de este informe lo contradice.

---

## 3. Inventario de formatos y rutas ##

Leyenda de veredictos: **Directo** (mismo formato, importable sin traducción
semántica) · **Traducible** (formato distinto, traducción mecánica) ·
**Parcial** (se importa parte) · **No** (sin vía local).

### 3.1 Claude Code y Claude Desktop ###

| App | Objeto | Formato | Ruta exacta de config | Clave o archivo | Importable | Veredicto |
| --- | --- | --- | --- | --- | --- | --- |
| Claude Desktop | Servidores MCP | JSON | macOS `~/Library/Application Support/Claude/claude_desktop_config.json`; Win `%APPDATA%\Claude\claude_desktop_config.json`; Linux `~/.config/Claude/claude_desktop_config.json` | `mcpServers` | Sí | Traducible |
| Claude Code | MCP por proyecto | JSON | `<proyecto>/.mcp.json` | `mcpServers` | Sí | Traducible |
| Claude Code | MCP por usuario | JSON | `~/.claude.json` | `mcpServers` + `projects[<ruta>].mcpServers` | Sí | Traducible |
| Claude Code | Ajustes y hooks | JSON | `~/.claude/settings.json`, `<proyecto>/.claude/settings.json` | `hooks`, `enabledMcpjsonServers`, `disabledMcpjsonServers` | Sí | Traducible |
| Claude Code | Ajustes locales | JSON | `~/.claude/settings.local.json` | merge sobre `settings.json` | Sí | Traducible |
| Claude Code | Marketplaces de plugins | JSON | `~/.claude/plugins/known_marketplaces.json` | `installLocation`, `source` | Sí | Traducible |
| Claude Code | Manifiesto de plugin | JSON | `<plugin>/.claude-plugin/plugin.json` | `name`, `version` | Sí | Traducible |
| Claude Code | Catálogo de marketplace | JSON | `<raíz>/.claude-plugin/marketplace.json` | `name`, `owner`, `plugins[]` | Sí | Traducible |
| Claude Code | Skills | Markdown | `~/.claude/skills/<id>/SKILL.md`, `<proyecto>/.claude/skills/<id>/SKILL.md` | frontmatter | Sí | Directo |
| Claude Code | Subagentes | Markdown | `~/.claude/agents/<id>.md`, `<proyecto>/.claude/agents/<id>.md` | frontmatter | Sí | Traducible |
| Claude Code | Comandos slash | Markdown | `~/.claude/commands/<id>.md`, `<proyecto>/.claude/commands/<id>.md` | frontmatter | Sí | Traducible |
| Claude Code | Reglas de repo | Markdown | `CLAUDE.md`, `<proyecto>/.claude/CLAUDE.md` | cuerpo Markdown | Sí | Directo |

### 3.2 OpenCode ###

| App | Objeto | Formato | Ruta exacta de config | Clave o archivo | Importable | Veredicto |
| --- | --- | --- | --- | --- | --- | --- |
| OpenCode | Config global | JSONC | `~/.config/opencode/opencode.json(c)` | raíz | Sí | Traducible |
| OpenCode | Config de sistema | JSONC | macOS `/Library/Application Support/opencode`; Win `%ProgramData%\opencode`; Linux `/etc/opencode` | `opencode.json(c)` | Sí | Traducible |
| OpenCode | Config de proyecto | JSONC | `<proyecto>/opencode.json(c)` o `<proyecto>/.opencode/opencode.json(c)` | raíz | Sí | Traducible |
| OpenCode | Servidores MCP | JSONC | dentro de `opencode.json(c)` | `mcp.servers.<id>` con `type: local\|remote` | Sí | Traducible |
| OpenCode | Skills | Markdown | `~/.config/opencode/skills/<id>/SKILL.md`, `<proyecto>/.opencode/skills/<id>/SKILL.md` | frontmatter | Sí | Directo |
| OpenCode | Skills de terceros | Markdown | `~/.claude/skills/<id>/SKILL.md`, `~/.agents/skills/<id>/SKILL.md` | frontmatter | Sí | Directo |
| OpenCode | Agentes | Markdown | `~/.config/opencode/agents/<id>.md`, `<proyecto>/.opencode/agents/<id>.md` | frontmatter | Sí | Traducible |
| OpenCode | Comandos | Markdown | `~/.config/opencode/commands/<id>.md`, `<proyecto>/.opencode/commands/<id>.md` | frontmatter | Sí | Traducible |
| OpenCode | Plugins | TypeScript | `~/.config/opencode/plugins/`, `<proyecto>/.opencode/plugins/` | `export default Plugin.define({ id, setup })` | No | No |
| OpenCode | Reglas | Markdown | `~/.config/opencode/AGENTS.md` | cuerpo Markdown | Sí | Directo |

OpenCode comparte territorio con Ego en el lado TypeScript, y su formato de
skills es **idéntico** al estándar Agent Skills, con dos extensiones propias:
`metadata.opencode/autoinvoke` y `disable-model-invocation`.

### 3.3 Codex ###

| App | Objeto | Formato | Ruta exacta de config | Clave o archivo | Importable | Veredicto |
| --- | --- | --- | --- | --- | --- | --- |
| Codex | Config global | TOML | `~/.codex/config.toml` | `mcp_servers.<id>` | Sí | Traducible |
| Codex | Config de proyecto | TOML | `<proyecto>/.codex/config.toml` | `mcp_servers.<id>` | Sí | Traducible |
| Codex | Hooks | JSON | `~/.codex/hooks.json`, `<proyecto>/.codex/hooks.json` | mapa de eventos | Sí | Traducible |
| Codex | Subagentes | Markdown | `~/.codex/agents/`, `<proyecto>/.codex/agents/` | frontmatter a TOML | Sí | Traducible |
| Codex | Skills (destino) | Markdown | `~/.agents/skills/`, `<proyecto>/.agents/skills/` | `SKILL.md` | Sí | Directo |
| Codex | Instrucciones | Markdown | `~/.codex/AGENTS.md`, `<proyecto>/AGENTS.md` | cuerpo Markdown | Sí | Directo |
| Codex | Importador de terceros | código | `codex-rs/external-agent-migration/` | — | Sí | Traducible |

Codex es la referencia canónica de este informe: su crate
`external-agent-migration` implementa **exactamente** el pipeline que Ego
necesita y su diseño es el modelo a extrapolar.

### 3.4 Cursor ###

| App | Objeto | Formato | Ruta exacta de config | Clave o archivo | Importable | Veredicto |
| --- | --- | --- | --- | --- | --- | --- |
| Cursor | MCP de usuario | JSON | `~/.cursor/cli-config.json` | `mcpServers` | Sí | Traducible |
| Cursor | MCP de proyecto | JSON | `<proyecto>/.cursor/cli.json` | `mcpServers` | Sí | Traducible |
| Cursor | MCP (formato dedicado) | JSON | `<proyecto>/.cursor/mcp.json` | `mcpServers` | Sí | Traducible |
| Cursor | Hooks | JSON | `<proyecto>/.cursor/hooks.json` | mapa de eventos | Sí | Traducible |
| Cursor | Reglas legacy | Markdown | `<proyecto>/.cursorrules` | cuerpo Markdown | Sí | Directo |
| Cursor | Skills | Markdown | `~/.cursor/skills/`, `<proyecto>/.cursor/skills/` | `SKILL.md` | Sí | Directo |

### 3.5 Gemini CLI y Qwen Code ###

| App | Objeto | Formato | Ruta exacta de config | Clave o archivo | Importable | Veredicto |
| --- | --- | --- | --- | --- | --- | --- |
| Gemini CLI | Ajustes globales | JSON | `~/.gemini/settings.json` | raíz | Sí | Traducible |
| Gemini CLI | Ajustes de proyecto | JSON | `<proyecto>/.gemini/settings.json` | raíz | Sí | Traducible |
| Gemini CLI | Ajustes de sistema | JSON | macOS `/Library/Application Support/GeminiCli/settings.json`; Win `C:\ProgramData\gemini-cli\settings.json`; Linux `/etc/gemini-cli/settings.json` | raíz | Sí | Traducible |
| Gemini CLI | Comandos | Markdown | `~/.gemini/commands/`, `<proyecto>/.gemini/commands/` | frontmatter | Sí | Traducible |
| Gemini CLI | Skills | Markdown | `~/.gemini/skills/`, `<proyecto>/.gemini/skills/` | `SKILL.md` | Sí | Directo |
| Gemini CLI | Agentes | Markdown | `~/.gemini/agents/`, `<proyecto>/.gemini/agents/` | frontmatter | Sí | Traducible |
| Gemini CLI | Políticas | JSON | `~/.gemini/policies/`, `<dir de sistema>/policies/` | — | Parcial | Traducible |
| Qwen Code | Ajustes | JSON | `~/.qwen/settings.json` (o `$QWEN_HOME`) | raíz | Sí | Traducible |
| Qwen Code | Comandos, skills, agentes | Markdown | `<proyecto>/.qwen/{commands,skills,agents}/` | frontmatter | Sí | Traducible |
| Qwen Code | Reglas | Markdown | `<proyecto>/.qwen/rules/` | glob de exclusión configurable | Sí | Traducible |

### 3.6 Cline, Continue, Goose y Hermes Agent ###

| App | Objeto | Formato | Ruta exacta de config | Clave o archivo | Importable | Veredicto |
| --- | --- | --- | --- | --- | --- | --- |
| Cline | MCP (VS Code) | JSON | `~/.cline/data/settings/cline_mcp_settings.json` (o `$CLINE_MCP_SETTINGS_PATH`) | `mcpServers` | Sí | Traducible |
| Cline | MCP (SDK) | JSON | `<proyecto>/.cline/mcp-servers.json` | `mcpServers` | Sí | Traducible |
| Cline | Plugins | JSON | `<proyecto>/.cline/plugins/`, `~/.cline/plugins/` | `plugin.json` | Sí | Traducible |
| Cline | Plugins de agente | JSON | `~/.agents/plugins/*` | `plugin.json` + `skills/` + `mcp.json` | Sí | Traducible |
| Cline | Agentes | Markdown | `~/.cline/agents/`, `<proyecto>/.cline/agents/` | frontmatter | Sí | Traducible |
| Cline | Reglas y skills | Markdown | `<proyecto>/.clinerules/`, `<proyecto>/.clinerules/skills/` | frontmatter | Sí | Traducible |
| Continue | Config global | YAML | `~/.continue/config.yaml` | `mcpServers` (lista) | Sí | Traducible |
| Continue | Agentes | Markdown | `<proyecto>/.continue/agents/*.md` | frontmatter | Sí | Traducible |
| Continue | Reglas | Markdown | `<proyecto>/.continue/rules/*.md` | cuerpo Markdown | Sí | Directo |
| Goose | Config global | YAML | `~/.config/goose/config.yaml` | raíz | Sí | Traducible |
| Goose | Hooks | JSON | `~/.config/goose/settings.json` | mapa de eventos | Sí | Traducible |
| Goose | Skills | Markdown | `~/.agents/skills/<id>/SKILL.md` | `SKILL.md` | Sí | Directo |
| Goose | Skills de terceros | Markdown | `~/.claude/skills/`, `<proyecto>/.claude/skills/` | `SKILL.md` | Sí | Directo |
| Goose | Skills de proyecto | Markdown | `<proyecto>/.agents/skills/`, `.goose/skills/` | `SKILL.md` | Sí | Directo |
| Goose | Subagentes | Markdown | `~/.agents/agents/`, `~/.goose/agents/`, `~/.claude/agents/`, `~/.config/goose/agents/` | frontmatter | Sí | Traducible |
| Goose | Memoria | JSONL | `~/.config/goose/memory/`, `<proyecto>/.goose/memory/` | — | Parcial | No |
| Hermes Agent | Config global | YAML | `~/.hermes/config.yaml` (o `$HERMES_HOME`) | `mcp_servers` | Sí | Traducible |
| Hermes Agent | MCP de proyecto | JSON | `<proyecto>/.mcp.json` | `mcpServers` | Sí | Traducible |
| Hermes Agent | Skills | Markdown | `~/.hermes/skills/`, `<repo>/skills/` | `SKILL.md` | Sí | Directo |
| Hermes Agent | Plugins | Python | `<repo>/plugins/`, `hermes_cli/plugins*.py` | código Python | No | No |

### 3.7 Apps de chat y workflow (servidor) ###

| App | Objeto | Formato | Ruta exacta de config | Clave o archivo | Importable | Veredicto |
| --- | --- | --- | --- | --- | --- | --- |
| Dify | Herramientas MCP | YAML en BD | no hay fichero local canónico | — | No | No |
| Flowise | Herramientas MCP | JSON en BD | no hay fichero local canónico | — | No | No |
| Langflow | Componentes MCP | JSON en BD | no hay fichero local canónico | — | No | No |
| n8n | Nodos MCP | JSON en BD | no hay fichero local canónico | — | No | No |
| ActivePieces | Piezas MCP | JSON en BD | no hay fichero local canónico | — | No | No |
| Windmill | Scripts y apps | JS/TS en BD | no hay fichero local canónico | — | No | No |
| LobeChat | Plugins y MCP | JSON en BD | no hay fichero local canónico | — | No | No |
| LibreChat | MCP y agentes | BD + `librechat.yaml` | `librechat.yaml` (parcial, solo servidor) | `mcpServers` | Parcial | Traducible |
| AnythingLLM | MCP y agentes | BD SQLite | `~/.anythingllm` (datos, no config) | — | No | No |
| Open WebUI | MCP y functions | BD SQLite | `~/.open-webui` (datos, no config) | — | No | No |
| Jan | MCP | BD SQLite | `~/.jan` (datos, no config) | — | No | No |
| Cherry Studio | MCP y plugins | BD SQLite | `~/.cherry-studio` (datos, no config) | — | No | No |

Estas apps son **proveedores** de herramientas, no consumidores de ficheros de
configuración local. La vía correcta para alcanzarlas no es importar su config
sino **consumir su MCP server** (o su API), lo que encaja con el Nivel B ya
decidido en `docs/engineering/integraciones.md`.

### 3.8 Evidencia del formato canónico de referencia ###

Los campos que un importador debe reconocer, consolidados desde el código:

| Formato | Campos canónicos | Fuente de la evidencia |
| --- | --- | --- |
| JSON MCP de Claude | `command`, `args`, `env`, `url`, `headers`, `type`, `enabled`, `disabled` | `codex-rs/external-agent-migration/src/mcp.rs:186-244` |
| Allow-list MCP de Claude | `enabledMcpjsonServers`, `disabledMcpjsonServers` | `codex-rs/external-agent-migration/src/mcp.rs:42-51` |
| Placeholders de entorno | `${VAR}`, `${VAR:-default}` | `codex-rs/external-agent-migration/src/mcp.rs:333-347` |
| Bearer en header | `Authorization: Bearer ${VAR}` a `bearer_token_env_var` | `codex-rs/external-agent-migration/src/mcp.rs:264-283` |
| Variables de entorno | `env` (estático) y `env_vars` (por nombre) | `codex-rs/external-agent-migration/src/mcp.rs:306-331` |
| Skills | `SKILL.md` con frontmatter `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools` | `agentskills.io/specification` |
| Plugins de Claude | `plugin.json` con `name`; `marketplace.json` con `name`, `owner`, `plugins[]` | `code.claude.com/docs/en/plugin-marketplaces` |
| Registro MCP | `server.json` con `name`, `packages[]`, `remotes[]`, `environmentVariables[]` | `modelcontextprotocol/registry/docs/reference/server-json/generic-server-json.md` |

---

## 4. Estado de MCP en 2026 ##

La revisión vigente del protocolo es **`2026-07-28`** (confirmada en
`modelcontextprotocol.io/specification/versioning`). Las revisiones
`2025-11-25` y anteriores son *legacy* (handshake `initialize`); `2026-07-28`
es *modern* (versión y capacidades **por request** en `_meta`).

Ego está en `2024-11-05`: es *legacy* y está **dos revisiones por detrás**.

| Capacidad | Cliente MCP de Ego | Servidor MCP de Ego | Brecha | Prioridad |
| --- | --- | --- | --- | --- |
| Versión de protocolo | `2024-11-05` fija (`McpClient.ts:174`) | `2024-11-05` fija (`McpServer.ts:153`) | No negocia; `2026-07-28` es modern | P0 |
| `server/discover` | No implementado | No implementado | Obligatorio en servidores 2026 | P1 |
| `_meta` por request | No implementado | No implementado | Modern exige versión por request | P1 |
| Header `MCP-Protocol-Version` | No enviado | No emitido | Requisito de Streamable HTTP modern | P1 |
| `resultType` en resultados | No emitido | No emitido | Modern exige `complete` o `input_required` | P1 |
| `tools/list` | Sí (`McpClient.ts:251-261`) | Sí (`McpServer.ts:167-176`) | Sin cursor de paginación | P2 |
| Paginación `nextCursor` | Tipo declarado (`types.ts:83`), no iterado | No aplica | Se pierde la segunda página | P2 |
| `resources/list` | **No implementado** | Sí (`McpServer.ts:127,256-280`) | Divergencia doc-código | P0 |
| `resources/read` | **No implementado** | Sí (`McpServer.ts:129,282-328`) | Divergencia doc-código | P0 |
| `prompts/list` | **No implementado** | Sí (`McpServer.ts:131,330-345`) | Divergencia doc-código | P0 |
| `prompts/get` | **No implementado** | Sí (`McpServer.ts:133,347-379`) | Divergencia doc-código | P0 |
| `resources/templates/list` | No implementado | No implementado | Sin descubrimiento parametrizable | P2 |
| `roots/list` | **Anunciado y no cumplido** (`McpClient.ts:174` frente a `:582-585`) | n/a | Capacidad declarada que responde `-32601` | P0 |
| `sampling` | No declarado | n/a | Eliminado como request en 2026 (MRTR) | P2 |
| `elicitation` | No declarado | n/a | Eliminado como request en 2026 (MRTR) | P2 |
| `annotations` de tool | Ausentes en `McpToolDefinition` (`types.ts:67-76`) | No publicadas (`McpServer.ts:167-176`) | Riesgo deducido por nombre | P0 |
| `listChanged` | n/a | **Declarado, nunca emitido** (`McpServer.ts:155-157`) | Capacidad falsa | P1 |
| `subscriptions/listen` | No implementado | No implementado | Reemplaza GET stream en modern | P2 |
| Transporte SSE (legacy) | Declarado en tipos (`types.ts:137`), **no implementado** | n/a | Cae por error al spawn stdio | P1 |
| Transporte Streamable HTTP | Solo POST JSON, **sin SSE** (`McpClient.ts:686-690`) | Solo POST, GET responde 405 (`mcp-http-server.ts:152-160`) | Sin notificaciones push | P1 |
| `notifications/initialized` | Solo stdio (`McpClient.ts:787-797`) | n/a | En HTTP **no viaja** | P1 |
| Respuestas server a client | Solo stdio (`McpClient.ts:607-625`) | n/a | En HTTP el servidor queda colgado | P1 |
| OAuth 2.1 remoto | **Prohibido** (`types.ts:283`) | n/a | `authorization` bloqueado en config | P0 |
| mTLS | No implementado | n/a | — | P3 |
| `ping` | n/a | Sí (`McpServer.ts:135`) | Eliminado en 2026 | P3 |
| `logging/setLevel` | No implementado | No implementado | Sustituido por `_meta` | P3 |
| `Origin` validation | n/a | No implementada | Requisito anti-DNS-rebinding | P1 |

---

## 5. Compatibilidad por formato ##

| Formato | Campos | Traductor a Ego | Pérdida de info | Complejidad | Veredicto |
| --- | --- | --- | --- | --- | --- |
| JSON MCP de Claude (`mcpServers`) | `command`, `args`, `env`, `url`, `headers`, `type` | `mcpServers` a `McpServerConfig` | `type` implícito; placeholders `${VAR}` a marcadores `{{SECRET:...}}` | Baja | **Importar** |
| JSON MCP de Cursor | idéntico al de Claude | mismo traductor | el mismo | Baja | **Importar** |
| JSON MCP de Cline | idéntico al de Claude | mismo traductor | `timeout` por servidor se puede perder | Baja | **Importar** |
| JSON MCP de OpenCode (`mcp.servers`) | `type: local\|remote`, `command[]`, `environment`, `headers`, `oauth`, `disabled` | `command[]` a `command` + `args`; `environment` a `env` | `oauth` completo (CIMD y DCR) y `protocol` | Media | **Importar** (sin OAuth) |
| YAML MCP de Continue (`mcpServers[]`) | `name`, `command`, `args`, `env`, `url` | lista a mapa | se pierde el orden de carga | Baja | **Importar** |
| YAML MCP de Goose | bloque `extensions` | bloque a mapa | poco | Baja | **Importar** |
| YAML MCP de Hermes (`mcp_servers`) | `name`, `command`, `args`, `env` | bloque a mapa | flags de Hermes | Baja | **Importar** |
| TOML MCP de Codex (`mcp_servers`) | `command`, `args`, `env`, `env_vars`, `url`, `http_headers`, `env_http_headers`, `bearer_token_env_var` | TOML a `McpServerConfig` | `bearer_token_env_var` exige resolver a keychain | Media | **Importar** |
| `SKILL.md` (Agent Skills) | `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools` | copia y normalización de `name` a kebab-case | `allowed-tools` requiere motor de permisos | Muy baja | **Importar directo** |
| `AGENTS.md` | cuerpo Markdown libre | concatenación por jerarquía de directorio | semántica de "el más cercano gana" | Muy baja | **Importar directo** |
| `plugin.json` de Claude | `name`, `version`, `description` | manifiesto a manifiesto de plugin de Ego | `version` con semántica propia | Baja | **Importar** |
| `marketplace.json` de Claude | `name`, `owner`, `plugins[]`, `source` | catálogo a catálogo de Ego | `source` con 6 variantes (ruta, `github`, `git-subdir`, `url`, `archive`, `npm`, `command`) | Media | **Importar parcial** |
| `server.json` del MCP Registry | `name`, `packages[]`, `remotes[]`, `environmentVariables[]` | entrada a `McpServerConfig` | `runtimeArguments` y `packageArguments` no tienen equivalente en Ego | Media | **Importar parcial** |
| Plugin TypeScript de OpenCode | `Plugin.define({ id, setup })` | — | API de plugin en tiempo de ejecución | Muy alta | **No importar** |
| Plugin Python de Hermes | entry point Python | — | runtime Python embebido | Muy alta | **No importar** |
| Config de app web (BD) | — | — | sin fichero local | — | **No importar** |

---

## 6. Detección de apps instaladas ##

La detección debe ser **read-only**, opt-in y sin telemetría: sólo se listan
rutas conocidas y se comprueba su existencia. No se debe leer el contenido de
configuraciones hasta que el usuario lo autorice explícitamente.

| SO | App | Señal de detección | Fiabilidad | Veredicto |
| --- | --- | --- | --- | --- |
| Windows | Claude Desktop | `%APPDATA%\Claude\claude_desktop_config.json` | Alta | Usar |
| Windows | Claude Code | `%USERPROFILE%\.claude\settings.json` o `%USERPROFILE%\.claude.json` | Alta | Usar |
| macOS | Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` | Alta | Usar |
| macOS | Claude Code | `~/.claude/settings.json` o `~/.claude.json` | Alta | Usar |
| Linux | Claude Desktop | `~/.config/Claude/claude_desktop_config.json` | Alta | Usar |
| Linux | Claude Code | `~/.claude/settings.json` o `~/.claude.json` | Alta | Usar |
| Todos | Codex | `$CODEX_HOME/config.toml` o `~/.codex/config.toml` | Alta | Usar |
| Todos | OpenCode | `~/.config/opencode/opencode.json(c)` o `%PROGRAMDATA%\opencode` | Alta | Usar |
| Todos | Cursor | `~/.cursor/cli-config.json` o `<proyecto>/.cursor/mcp.json` | Media | Usar |
| Todos | Cline | `~/.cline/data/settings/cline_mcp_settings.json` o `$CLINE_MCP_SETTINGS_PATH` | Media | Usar |
| Todos | Continue | `~/.continue/config.yaml` | Alta | Usar |
| Todos | Gemini CLI | `~/.gemini/settings.json` | Alta | Usar |
| Todos | Qwen Code | `~/.qwen/settings.json` o `$QWEN_HOME` | Media | Usar |
| Todos | Goose | `~/.config/goose/config.yaml` | Media | Usar |
| Todos | Hermes | `~/.hermes/config.yaml` o `$HERMES_HOME/config.yaml` | Media | Usar |
| Windows | Claude Desktop (instalado) | Registro `HKCU\Software\Classes\Claude` o carpeta `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc` | Baja | Solo informativo |
| Windows | Codex CLI | binario `codex` en `PATH` | Baja | Solo informativo |
| Windows | OpenCode | binario `opencode` en `PATH` | Baja | Solo informativo |
| Windows | Gemini CLI | binario `gemini` en `PATH` | Baja | Solo informativo |
| Windows | Qwen Code | binario `qwen` en `PATH` | Baja | Solo informativo |
| Windows | Goose | binario `goose` en `PATH` | Baja | Solo informativo |
| macOS | Claude Desktop | bundle `/Applications/Claude.app` | Baja | Solo informativo |
| macOS | ChatGPT | bundle `/Applications/ChatGPT.app` | Baja | Solo informativo |
| Linux | codex, claude, opencode | `which <binario>` | Baja | Solo informativo |
| Windows | Procesos activos | `tasklist` filtrando `codex.exe`, `claude.exe`, `opencode.exe` | Muy baja | Solo informativo |

### 6.1 Consideraciones de privacidad ###

- **Nunca** leer el contenido de un fichero de configuración ajeno sin que el
  usuario haya aprobado ese fichero concreto en la UI. Un
  `claude_desktop_config.json` puede contener tokens en claro.
- **Nunca** copiar secretos a VantaDB. El importador debe mapear
  `env` y `headers` a referencias opacas `{{SECRET:<clave>}}` y a entradas del
  `CredentialManager`, nunca al valor.
- **Nunca** enviar a la red. La detección y el import son 100 % locales.
- **Nunca** modificar el config de origen. La importación es de **solo lectura**;
  Ego escribe únicamente en su propio namespace (`gov/mcp_servers`).
- **Visibilidad explícita**: la UI debe listar qué apps se han detectado y qué
  ficheros se van a leer **antes** de leerlos.
- **Sin telemetría**: no se reporta qué apps tiene instaladas el usuario.

---

## 7. Import y export ##

### 7.1 Pipeline ###

```typescript
// Pipeline de importación de integraciones de terceros.
// La etapa 7 (aprobar) es la ÚNICA con efecto: todo lo anterior es dry-run.

async function importIntegrations(sources: DetectedSource[]): Promise<ImportPlan> {
  // 1. DETECTAR — sólo metadatos, sin leer contenido.
  const candidates = await detectInstalledApps(); // rutas existentes, sin abrir
  const selected = intersect(candidates, sources);

  // 2. LEER — parseo tolerante a fallos, por familia de formato.
  const raw = await Promise.all(
    selected.map((s) => readConfigFamily(s.path, s.family)),
  );

  // 3. NORMALIZAR — cada familia produce el mismo modelo intermedio.
  const normalized = raw.flatMap((r) => toCanonical(r));

  // 4. VALIDAR — esquema, política de seguridad y allowlist de spawn.
  const validated = normalized.map((n) => validate(n)).filter(isOk);

  // 5. CATALOGUEAR — propuesta de catálogo, no escritura.
  const plan = diffAgainstCatalog(validated, existingCatalog());

  // 6. DRY-RUN — simular cada paso siguiente sin efectos.
  const simulation = await simulate(plan); // conexiones, comandos, permisos

  // 7. APROBAR — gate HITL humano (principio 6). Punto de control único.
  const approved = await approvalGate.request({ plan, simulation });
  if (!approved) return plan; // no se escribe nada

  // 8. ACTIVAR — escritura en VantaDB y arranque de conexiones.
  await persist(plan, approved); // namespace gov/mcp_servers
  await activateServers(plan);
  return plan;
}
```

### 7.2 Punto de control humano ###

El control humano está **entre el dry-run y la activación**, y es único. Antes
de él, todo es reversible y no tiene efecto. Después, la activación es
automática porque ya está aprobada.

Motivos para que el gate sea único y no disperso:

- Los permisos MCP de Ego ya tienen un motor (`ApprovalEngine`) con identidad
  causal; duplicar el gate crearía dos fuentes de verdad.
- Una importación puede arrastrar decenas de servidores: pedir confirmación por
  servidor es ruido, pedir confirmación por lote sin detalle es irresponsable.
- El dry-run debe mostrar, por servidor: comando literal, argumentos, variables
  de entorno (con valores enmascarados), transporte, tools declaradas y riesgo
  inferido. Ese render es lo que el usuario aprueba.

### 7.3 Export ###

El export es el inverso y escribe **únicamente** en formato estándar:

| Origen interno de Ego | Formato de salida | Notas |
| --- | --- | --- |
| `McpServerConfig` de `gov/mcp_servers` | JSON MCP de Claude (`mcpServers`) | formato más consumido |
| `McpServerConfig` de `gov/mcp_servers` | `server.json` del MCP Registry | exige `packages[]` o `remotes[]` |
| Catálogo de skills de Ego | `SKILL.md` | estándar Agent Skills |
| Reglas de Ego | `AGENTS.md` | Markdown libre |
| Manifiesto de plugin de Ego | `plugin.json` y `.claude-plugin/marketplace.json` | marketplace propio |

El export es lo que permite que Ego sea **proveedor** dentro del ecosistema, no
solo consumidor: un Sub-Ego de Ego debe poder usarse desde Claude Code o Cursor
vía su servidor MCP (ya implementado, `mcp-server-runtime.ts:109`).

---

## 8. Brechas reales del código actual de Ego ##

Priorizadas por impacto en interoperabilidad y facilidad de arreglo. Todas
verificadas por lectura directa del código en esta sesión.

| # | Brecha | Evidencia | Impacto | Prioridad |
| --- | --- | --- | --- | --- |
| 1 | Cliente MCP no descubre `resources` ni `prompts` | `McpClient.ts:251-261` (solo `tools/list`); el servidor sí los tiene (`McpServer.ts:127-134`) | La doc canónica promete el descubrimiento completo (`integraciones.md:80`) y el código no lo cumple | P0 |
| 2 | Capacidad `roots` anunciada y no cumplida | `McpClient.ts:174` anuncia `roots: { listChanged: true }`; `McpClient.ts:582-585` responde `-32601` a `roots/list` | El servidor MCP oficial de filesystem llama `roots/list` en su `initialize` y recibe error | P0 |
| 3 | Riesgo de tool deducido del nombre | `McpClient.ts:825-852` (`inferRiskLevel`); `types.ts:67-76` no declara `annotations` | `archive_file` o `git_commit` caen en `sensitive` aunque el servidor declare `readOnlyHint: true` | P0 |
| 4 | Sin OAuth para servidores MCP remotos | `types.ts:283` bloquea `authorization` y `proxy-authorization` en config; `types.ts:291-336` exige https sin loopback | El ecosistema remoto actual (Context7, Sentry, Cloudflare) es OAuth-first | P0 |
| 5 | `protocolVersion` fijada a `2024-11-05` | `McpClient.ts:174` y `McpServer.ts:153` | Dos revisiones por detrás de la vigente (`2026-07-28`) | P0 |
| 6 | `transport: "sse"` declarado y no implementado | `types.ts:137` lo declara; `McpClient.ts:627-629` sólo reconoce `streamable-http`, luego `sse` cae en `spawnProcess()` (`McpClient.ts:443-490`) | Un config SSE con URL falla con error de allowlist en vez de un mensaje claro | P1 |
| 7 | Notificaciones y respuestas no viajan por HTTP | `McpClient.ts:787-797` (`sendNotification`) y `McpClient.ts:607-625` (`respondToServerRequest`) escriben sólo a `this.process.stdin` | En Streamable HTTP el `notifications/initialized` **no se envía** y el servidor queda colgado ante una petición server a client | P1 |
| 8 | Sin soporte de respuestas SSE del servidor | `McpClient.ts:686-690` lanza error si el servidor responde `text/event-stream` | Bloquea servidores que usan SSE para respuestas largas | P1 |
| 9 | `listChanged` declarado y nunca emitido | `McpServer.ts:155-157`; no hay emisión de `notifications/tools/list_changed` en `packages/` | Capacidad falsa: el cliente que la acepta no puede invalidar caché | P1 |
| 10 | Sin paginación de `tools/list` | `McpListToolsResult.nextCursor` existe (`types.ts:83`) pero `McpClient.ts:258-260` no itera | Los servidores grandes (Context7, filesystem grande) pierden tools | P2 |
| 11 | Sin `resources/templates/list` ni prompts parametrizables | `McpServer.ts:256-280` sólo publica `payload://` y `memory://`; `McpServer.ts:330-345` devuelve `arguments: []` | No se pueden descubrir URIs parametrizables ni prompts con argumentos | P2 |
| 12 | `EgoMcpServer` es un `switch` monolítico | `McpServer.ts:115-147` | Cada capacidad nueva edita el switch; no escala | P2 |
| 13 | Servidor MCP de Ego sin validación `Origin` | `mcp-http-server.ts:135` valida el bearer pero no `Origin` | Requisito anti-DNS-rebinding de la spec | P1 |
| 14 | El servidor MCP de Ego no es consumible por su propio cliente | `types.ts:291-336` bloquea loopback; el servidor sirve en `127.0.0.1` (`mcp-server-runtime.ts:109`) | Ego no puede auto-verificarse como cliente MCP | P2 |
| 15 | Doc canónica desalineada del runtime | `integraciones.md:99` dice transporte `stdio`; el runtime real es HTTP streamable en loopback | Divergencia doc-código | P1 |

Nota: el punto 9 está ya registrado como `MCPS-07` en
[`docs/extractions/mcp-servers.md`](../extractions/mcp-servers.md) con destino
Fase 11. Este informe confirma su vigencia y añade los puntos 6, 7, 8, 10, 13,
14 y 15, que **no** estaban catalogados.

---

## 9. Estrategia de plugins y skills de Ego ##

### 9.1 Principio rector ###

El motor de plugins de Ego **no debe reimplementar MCP**: debe ser una capa de
gestión sobre MCP. Concretamente:

- Un **servidor MCP** es una capacidad ejecutable: se conecta por `stdio` o
  Streamable HTTP y se gobierna con la misma política de permisos.
- Un **plugin de Ego** es un *manifiesto* que **agrega** capacidades: un
  servidor MCP, un conjunto de skills, un conjunto de hooks, un conjunto de
  comandos y un conjunto de reglas. Es un contenedor, no un runtime nuevo.

Esto evita el segundo runtime y cumple el principio de primitives de librería
(AGENTS.md §4, D3): lo que existe como primitive de MCP se usa; sólo lo que
MCP no cubre (manifiesto, versionado, marketplace, sandbox) es propio.

### 9.2 Manifiesto de plugin de Ego ###

Formato **propio**, deliberadamente no compatible con `plugin.json` de Claude,
porque Ego necesita expresar permisos y dependencias que aquel no tiene:

```jsonc
{
  "$schema": "https://ego.local/schemas/plugin-v1.json",
  "id": "com.acme.research",
  "name": "Acme Research",
  "version": "1.2.0",
  "license": "Apache-2.0",
  "minEgoVersion": "0.2.0",
  "description": "Búsqueda y síntesis documental para Sub-Egos de Engineering",
  "mcpServers": [
    { "id": "acme-search", "transport": "stdio", "command": "npx", "args": ["-y", "@acme/mcp"] }
  ],
  "skills": ["skills/acme-search/SKILL.md"],
  "agents": ["agents/researcher.md"],
  "commands": ["commands/acme-brief.md"],
  "rules": ["rules/acme.md"],
  "hooks": [{ "event": "tool.pre", "match": "acme_*", "action": "approval" }],
  "permissions": {
    "tools": { "acme_*": "ask" },
    "network": ["api.acme.com"],
    "filesystem": []
  },
  "dependencies": []
}
```

### 9.3 Ciclo de vida ###

| Fase | Qué ocurre | Punto de control |
| --- | --- | --- |
| Descubrimiento | Se localiza el manifiesto y se valida el esquema | Automático |
| Resolución | Se resuelven `skills`, `agents`, `commands`, `rules` a rutas absolutas | Automático |
| Dependencias | Se comprueban `dependencies` y `minEgoVersion` | Automático |
| Sandboxing | Se calcula el perfil de permisos efectivo | Automático |
| **Aprobación** | El usuario ve permisos, red, filesystem y tools | **Humano (HITL)** |
| Activación | Se registran las tools MCP y se cargan las skills | Automático |
| Carga | `setup` del servidor MCP y registro de skills | Automático |
| Descarga | Se cierran procesos y se retiran tools | Automático |

### 9.4 Sandbox y permisos ###

- Los servidores MCP **stdio** ya quedan dentro de la política de spawn de Ego
  (`MCP_COMMAND_ALLOWLIST` en `McpClient.ts:34-43`, `shell:true` prohibido en
  `:59-71`). Esa es la frontera de sandbox: no se extiende ni se relaja.
- Las skills son **Markdown**: no ejecutan código por sí mismas. Los scripts que
  acompañan a una skill (`scripts/`) se ejecutan bajo la política del
  `TerminalCommandPolicy` existente.
- Las acciones del skill se gobiernan por la tabla de permisos que ya existe
  en la UI de permisos (`apps/desktop/src/ipc/schema.ts:264`), reutilizando el
  formato `allow`, `ask`, `deny` de OpenCode, que es de facto.

### 9.5 Hooks ###

Los hooks son el punto más débil del ecosistema: cada casa tiene su propio
vocabulario. Codex los persiste en `hooks.json` con nombres de evento propios,
Claude Code en `settings.json` bajo la clave `hooks`, Goose en
`settings.json`, y Cline y Hermes tienen formatos distintos.

Propuesta: **normalizar a los eventos de MCP 2026** (que ya define un conjunto
estable de notificaciones) más un conjunto mínimo propio:

| Evento canónico | Origen | Cuándo se emite |
| --- | --- | --- |
| `tool.pre` | Ego | antes de ejecutar una tool |
| `tool.post` | Ego | después de ejecutar una tool |
| `session.start` | Ego | arranque de sesión |
| `session.end` | Ego | cierre de sesión |
| `mcp.tools.changed` | MCP | `notifications/tools/list_changed` |
| `mcp.resources.updated` | MCP | `notifications/resources/updated` |

El traductor de hooks traduce el vocabulario de cada casa al canónico y
descarta los que no tienen equivalente, con aviso explícito, nunca en
silencio.

### 9.6 Versionado ###

- Manifiesto con **SemVer** y `minEgoVersion`.
- Los **contenidos** (skills, agentes, comandos) llevan su propia versión en el
  frontmatter, como ya hace Agent Skills con `metadata.version`.
- Un plugin instalado es un **snapshot inmutable** en el catálogo de Ego; las
  actualizaciones son un diff explícito aprobado por el usuario.

### 9.7 Marketplace propio ###

Ego necesita **un** marketplace propio, y la decisión es si lo hace o si
reutiliza el de Claude Code. La evidencia favorece **reutilizar el formato** y
**no** el servicio:

- El formato `.claude-plugin/marketplace.json` es JSON simple, documentado y con
  6 variantes de `source` (ruta relativa, `github`, `git-subdir`, `url`,
  `archive`, `npm`, `command`).
- Un marketplace propio con su servicio de publicación es un coste operativo
  permanente (hosting, moderación, firma, updates) que no aporta capacidad
  técnica: el formato ya es interoperable.
- La alternativa más barata y más interoperable es: **Ego lee
  `marketplace.json`** de cualquier marketplace de Claude Code, y **Ego publica**
  con el mismo formato para que Claude Code, Cursor y Codex puedan consumir el
  catálogo de Ego.

### 9.8 Qué se construye directamente sobre MCP ###

| Capacidad | Transporte | Decisión |
| --- | --- | --- |
| Tools de terceros | MCP `stdio` y Streamable HTTP | **Consumir tal cual** |
| Contexto y memoria de Ego | MCP server de Ego | **Emitir tal cual** (ya implementado) |
| Skills | `SKILL.md` nativo | **Directo**, sin MCP |
| Reglas | `AGENTS.md` nativo | **Directo**, sin MCP |
| Comandos | Markdown nativo | **Directo**, sin MCP |
| Plugins | Manifiesto propio | **Capa de gestión sobre MCP** |
| Hooks | Events canónicos | **Capa sobre el bus `EgoEvent`** |

---

## 10. Trade-offs y riesgos ##

### 10.1 Riesgos ###

| Riesgo | Descripción | Mitigación en Ego |
| --- | --- | --- |
| Breaking changes de MCP | La revisión `2026-07-28` eliminó handshake, sesiones, `ping`, SSE y `roots/list_changed` | Implementación **dual-era** (legacy `initialize` y modern `_meta`), como hace OpenCode con `protocol: legacy\|auto\|2026-07-28` |
| Confianza en servidores | Un servidor MCP es código arbitrario con acceso al sistema | Allowlist de spawn ya existente, firma Ed25519 (`signature.ts`) y `requiresApproval` para no firmados |
| Fuga de credenciales al importar | Los configs ajenos traen tokens en claro | Nunca leer secretos; mapear a `{{SECRET:...}}` y al `CredentialManager` |
| Dependencia de terceros | SDKs y registros cambian rápido | depender del **protocolo**, no de SDK; `modelcontextprotocol/typescript-sdk` es adaptador |
| Licencias copyleft | Cherry Studio es AGPL-3.0 y MCPJungle es MPL-2.0 | No copiar código: **consumir como servidores MCP** o leer el protocolo; atribuir en `NOTICE` |
| Licencias source-available | `anthropics/skills` incluye `docx`, `pdf`, `pptx` y `xlsx` como source-available, no open source | No distribuir esas skills dentro de Ego; se consumen desde el marketplace del usuario |
| Ruido de todo lo instalado | Cline, Codex y Goose usan directorios compartidos (`~/.agents`, `~/.claude`) | Deduplicar por ID de skill con precedencia explícita |
| Superficie de ataque de la detección | Listar rutas de usuario es información sensible | Sólo metadatos, opt-in, sin red |

### 10.2 Licencias con efecto para Ego (Apache 2.0) ###

| Repo | Estrellas | Último push | Licencia | Efecto para Ego |
| --- | --- | --- | --- | --- |
| `modelcontextprotocol/servers` | 91 397 | 2026-10-19 | MIT → Apache-2.0 (transición declarada; API `NOASSERTION`) | Consumir como servidores MCP; revisar por servidor |
| `modelcontextprotocol/registry` | 7 382 | 2026-10-14 | MIT → Apache-2.0 (transición declarada; API `NOASSERTION`) | Consumir la API; el esquema `server.json` es el contrato |
| `modelcontextprotocol/typescript-sdk` | 13 619 | 2026-10-20 | MIT → Apache-2.0 (transición declarada; API `NOASSERTION`) | Adaptador, no dependencia de núcleo |
| `modelcontextprotocol/python-sdk` | 24 624 | 2026-10-17 | MIT | Idóneo para sidecar Python |
| `modelcontextprotocol/inspector` | 11 107 | 2026-10-20 | MIT → Apache-2.0 (transición declarada; API `NOASSERTION`) | Herramienta de QA; no se distribuye |
| `punkpeye/awesome-mcp-servers` | 96 640 | 2026-10-18 | MIT | Catálogo de referencia (lista) |
| `wong2/awesome-mcp-servers` | 4 372 | 2026-07-13 | MIT | Catálogo de referencia |
| `PrefectHQ/fastmcp` (antes `jlowin/fastmcp`) | 28 143 | 2026-10-20 | Apache-2.0 | Compatible; útil para el sidecar Python |
| `lastmile-ai/mcp-agent` | 8 571 | 2026-01-25 | Apache-2.0 | Referencia de patrones; no dependencia |
| `mcpjungle/MCPJungle` | 1 303 | 2026-08-02 | MPL-2.0 | Copyleft de archivo: **no copiar código**; usar como gateway externo |
| `docker/mcp-gateway` | 1 607 | 2026-09-23 | MIT | Interesante para sandbox OCI; no requerido en P0 |
| `open-webui/mcpo` | 4 405 | 2026-05-17 | MIT | Puente MCP a OpenAPI; útil para apps sin MCP |
| `openclaw/mcporter` | 5 076 | 2026-10-19 | MIT | Referencia de ergonomía MCP en TypeScript |
| `sparfenyuk/mcp-proxy` | 2 796 | 2026-10-14 | MIT | Puente Streamable HTTP y stdio; cubre la brecha SSE de Ego |
| `agentgateway/agentgateway` | 5 422 | 2026-10-20 | Apache-2.0 | Proxy de agentes; candidato a Nivel C |
| `mcp-router/mcp-router` | 2 135 | 2026-09-18 | `NOASSERTION` | Desarrollo **detenido** y repo **archivado** desde 2026-09; no depender |
| `pathintegral-institute/mcpm.sh` | 1 015 | 2026-10-20 | MIT | Gestor MCP multiplataforma; referencia de UX |
| `microsoft/mcp` | 3 789 | 2026-10-20 | MIT | Servidores oficiales de Microsoft |
| `awslabs/mcp` | 9 796 | 2026-10-20 | Apache-2.0 | Servidores AWS oficiales |
| `cloudflare/mcp-server-cloudflare` | 4 396 | 2026-10-19 | Apache-2.0 | Servidor remoto oficial; exige OAuth |
| `stripe/ai` (antes `stripe/agent-toolkit`) | 1 963 | 2026-10-20 | MIT | Toolkits de Stripe para agentes |
| `anthropics/skills` | 182 334 | 2026-10-09 | sin `LICENSE` raíz; skills docx/pdf/pptx/xlsx source-available (Anthropic) | Consumir skills Apache-2.0; **no** redistribuir `docx`, `pdf`, `pptx` ni `xlsx` |
| `anthropics/claude-code` | 152 812 | 2026-10-19 | `LICENSE.md` propio (© Anthropic PBC; sin SPDX) | Referencia de formato de plugin y marketplace |
| `anthropics/claude-agent-sdk-typescript` (antes `anthropics/claude-agent-sdk`) | 1 824 | 2026-10-19 | `LICENSE.md` propio (© Anthropic PBC; sin SPDX) | Referencia; no dependencia |
| `obra/superpowers` | 302 306 | 2026-10-20 | MIT | Skills de calidad; importables |
| `wshobson/agents` | 41 202 | 2026-10-19 | MIT | Subagentes; importables como Sub-Egos |
| `github/awesome-copilot` | 40 207 | 2026-10-19 | MIT | Instrucciones y agentes |
| `simonw/llm` | 12 645 | 2026-10-18 | Apache-2.0 | CLI con plugins; referencia de plugins |
| `openai/codex` | 130 005 | 2026-10-20 | Apache-2.0 | **Fuente primaria del importador** |
| `lobehub/lobe-chat` | 83 352 | 2026-10-20 | `NOASSERTION` (LobeHub Community License) | Proveedor vía MCP, no importable |
| `LibreChat-AI/LibreChat` | 46 042 | 2026-10-20 | MIT | Proveedor vía MCP |
| `Mintplex-Labs/anything-llm` | 67 343 | 2026-10-20 | MIT | Proveedor vía MCP |
| `open-webui/open-webui` | 156 230 | 2026-10-19 | `NOASSERTION` (Open WebUI License) | Proveedor vía MCP |
| `langgenius/dify` | 158 980 | 2026-10-20 | `NOASSERTION` (Apache-2.0 modificado) | Proveedor vía MCP |
| `FlowiseAI/Flowise` | 55 512 | 2026-08-13 | `NOASSERTION` (`LICENSE.md` mixto) | Proveedor vía MCP |
| `langflow-ai/langflow` | 155 859 | 2026-10-20 | MIT | Proveedor vía MCP |
| `n8n-io/n8n` | 208 095 | 2026-10-20 | Sustainable Use License (fair-code; API `NOASSERTION`) | Nivel C (P2); **no** embeber en el instalador |
| `activepieces/activepieces` | 25 126 | 2026-10-20 | MIT (core) salvo `packages/ee/` (API `NOASSERTION`) | Nivel C (P2) |
| `windmill-labs/windmill` | 18 229 | 2026-10-20 | Apache-2.0 + AGPLv3 + propietaria (API `NOASSERTION`) | Nivel C (P2) |
| `janhq/jan` | 45 019 | 2026-10-20 | Apache-2.0 con cabecera no estándar (API `NOASSERTION`) | Proveedor vía MCP |
| `CherryHQ/cherry-studio` | 52 780 | 2026-10-20 | AGPL-3.0 | **Copyleft fuerte: no copiar código ni linkar**; sólo consumir vía MCP |
| `ComposioHQ/composio` | 30 644 | 2026-10-20 | MIT | 1 000+ toolkits con auth; candidato a Nivel C |

### 10.3 Trade-off central ###

Reutilizar formatos ajenos tiene un coste: Ego hereda sus limitaciones y sus
ambigüedades (por ejemplo, el `name` de un `plugin.json` de Claude no coincide
obligatoriamente con el del `marketplace.json`, lo que rompe instalaciones).
La alternativa es definir un formato propio, con el coste de que **nadie más lo
consume**.

La recomendación es **híbrida**: formato propio **sólo** donde MCP no llega
(manifiesto de plugin, hooks, marketplace de Ego) y **reutilización literal**
donde MCP sí llega (MCP, `SKILL.md`, `AGENTS.md`).

---

## 11. Recomendación para Ego ##

### Fase A — Cerrar el contrato MCP (P0, unas 2 semanas) ###

Objetivo: que Ego pueda consumir y servir cualquier servidor MCP actual sin
degradación.

| # | Acción | Ficheros tocados | Fundamento |
| --- | --- | --- | --- |
| A1 | Implementar `roots/list` en el cliente, o retirar `roots` del handshake | `packages/integrations/src/mcp/McpClient.ts` | Capacidad hoy falsa (§8, punto 2) |
| A2 | Implementar `resources/list`, `resources/read`, `prompts/list` y `prompts/get` en el cliente | `packages/integrations/src/mcp/McpClient.ts` | Divergencia con `integraciones.md:80` (§8, punto 1) |
| A3 | Mapear `annotations` a `ToolRiskLevel` con prioridad sobre la heurística | `types.ts`, `McpClient.ts:825-852`, `McpServer.ts:167-176` | El servidor es la fuente de verdad (§8, punto 3) |
| A4 | Versionado dual-era: `initialize` legacy y `_meta` modern, con `server/discover` | `McpClient.ts`, `McpServer.ts` | La spec actual es stateless (§4) |
| A5 | OAuth 2.1 en el cliente remoto (PKCE, CIMD y DCR), con secretos en keychain | `McpClient.ts`, `SecretProxy.ts`, `packages/security` | El ecosistema remoto es OAuth-first (§8, punto 4) |
| A6 | Enviar `notifications/initialized` y las respuestas server a client por HTTP | `McpClient.ts:607-625,787-797` | Hoy no viajan (§8, punto 7) |
| A7 | Traducir `docs/engineering/integraciones.md:99` al transporte real | doc canónica | Divergencia doc-código (§8, punto 15) |

Esfuerzo estimado: 12 a 18 días-ingeniero. Es la fase **bloqueante**: sin ella,
importar configuraciones solo aumenta el número de servidores que fallan.

### Fase B — Importador de configuraciones (P1, unas 3 semanas) ###

Objetivo: que Ego descubra e importe lo que el usuario ya tiene.

| # | Acción | Fundamento |
| --- | --- | --- |
| B1 | Implementar el crate equivalente a `codex-rs/external-agent-migration`: `detect`, `read`, `normalize`, `validate`, `catalogue`, `dry-run` | Precedente directo de Codex (§3.3) |
| B2 | Familia de formato "JSON MCP de Claude, Cursor y Cline" (un solo traductor para las tres) | Campos idénticos (§3.8) |
| B3 | Familia "YAML MCP de Continue, Goose y Hermes" | Campos equivalentes (§3.6) |
| B4 | Familia "TOML MCP de Codex" | Requiere resolver `bearer_token_env_var` (§3.8) |
| B5 | Familia "OpenCode `mcp.servers`" | `command[]` a `command` y `args` (§5) |
| B6 | Importador de `SKILL.md` desde `~/.claude/skills`, `~/.agents/skills`, `~/.config/opencode/skills`, `~/.gemini/skills` y `~/.qwen/skills` | Formato único y portable (§3) |
| B7 | Importador de `AGENTS.md`, `CLAUDE.md`, `.cursorrules` y `.continue/rules` | Markdown libre (§5) |
| B8 | UI de detección con dry-run por servidor: comando, args, env enmascarado, tools y riesgo | Principio 6 y §7.2 |
| B9 | Caso degradado: si un formato no se puede leer, se informa y se continúa con los demás | §7.1 |

Esfuerzo estimado: 18 a 24 días-ingeniero. El componente de mayor riesgo es B8
(render del dry-run), porque es donde se decide la confianza.

### Fase C — Motor de plugins y marketplace (P2, unas 3 semanas) ###

| # | Acción | Fundamento |
| --- | --- | --- |
| C1 | Manifiesto de plugin propio (esquema versionado) | §9.2 |
| C2 | Registro de plugin: descubrir, resolver, validar, sandbox, **aprobar** y activar | §9.3 |
| C3 | Motor de hooks con eventos canónicos y traductores por casa | §9.5 |
| C4 | Lectura de `marketplace.json` de Claude Code y export en el mismo formato | §9.7 |
| C5 | Export de skills de Ego a `SKILL.md` y de reglas a `AGENTS.md` | §7.3 |
| C6 | Descarga de plugins: cierre de procesos y retirada de tools | §9.3 |

Esfuerzo estimado: 15 a 20 días-ingeniero.

### Fase D — Registro MCP y catálogo (P3, una semana) ###

| # | Acción | Fundamento |
| --- | --- | --- |
| D1 | Cliente del MCP Registry (`registry.modelcontextprotocol.io`) con caché local | Goose ya retiró su directorio propio a favor del registro oficial |
| D2 | Parser de `server.json` a `McpServerConfig` | §3.8, formato oficial |
| D3 | Resolución de `runtimeArguments` y `packageArguments` a `command` y `args` | `server.json` cubre OCI, npm, pypi, cargo, nuget y mcpb |

Esfuerzo estimado: 5 a 8 días-ingeniero.

### 11.1 Orden de ejecución y dependencias ###

```text
Fase A (contrato MCP)  -->  Fase B (importador)  -->  Fase C (plugins)
        |                                                   |
        +------------------>  Fase D (registro)  <----------+
```

- **A antes que B**: importar servidores que fallan es peor que no importar.
- **A antes que C**: los plugins se apoyan en MCP.
- **D es independiente** de B y C: puede paralizarse y entregarse aparte.

### 11.2 Esfuerzo total ###

| Fase | Esfuerzo | Fase del roadmap de Ego |
| --- | --- | --- |
| A — Contrato MCP | 12 a 18 días | Fase 02 (Acción) y Fase 11 (Security) |
| B — Importador | 18 a 24 días | Fase 11 (Security) y Fase 12 (Distribution) |
| C — Plugins | 15 a 20 días | Fase 12 (Distribution) |
| D — Registro MCP | 5 a 8 días | Fase 11 (Security) |
| **Total** | **50 a 70 días** | 4 a 6 semanas-ingeniero |

Esto respeta el presupuesto de `integraciones.md` (10 a 15 % del esfuerzo de P0)
sólo si la Fase A entra en P0 y B, C y D se ejecutan en fases posteriores.

---

## 12. Deuda abierta y preguntas para el owner ##

### 12.1 Decisiones que bloquean el diseño ###

| # | Pregunta | Opciones | Recomendación |
| --- | --- | --- | --- |
| 1 | ¿Ego implementa la revisión `2026-07-28` (modern, sin handshake) o se queda en legacy? | (a) legacy `2024-11-05`; (b) dual-era; (c) modern puro | **(b) dual-era**: OpenCode ya lo hace con `protocol: legacy\|auto\|2026-07-28` y el mercado es mixto |
| 2 | ¿Ego implementa OAuth 2.1 en su cliente MCP o delega en un proxy externo? | (a) nativo; (b) `sparfenyuk/mcp-proxy`; (c) sin OAuth en P0 | **(a) nativo**: el `CredentialManager` ya existe y un proxy externo rompería la política de no secretos fuera de main |
| 3 | ¿El importador escribe en el mismo catálogo que los servidores de Nivel A? | (a) mismo catálogo; (b) catálogo separado con origen | **(b) separado con origen**: permite distinguir "instalado por el usuario" de "propuesto por Ego" |
| 4 | ¿Ego publica un marketplace propio? | (a) sí, con servicio; (b) no, sólo formato | **(b) no**: el formato de Claude Code ya es interoperable y un servicio propio es coste permanente |
| 5 | ¿Los hooks de Ego se exponen como extensión MCP? | (a) extensión `io.modelcontextprotocol/...`; (b) API propia | **(a) extensión**: es la vía que la spec 2026-07-28 ha abierto (`extensions` en capabilities) |
| 6 | ¿Qué hacer con los hooks que no tienen equivalente canónico? | (a) descartar; (b) mapear al más cercano; (c) rechazar el plugin | **(b) con aviso explícito** en el dry-run; nunca en silencio |

### 12.2 Deuda técnica heredada de este informe ###

| Deuda | Detalle |
| --- | --- |
| §8, punto 15 | `docs/engineering/integraciones.md:99` sigue diciendo transporte `stdio` del servidor MCP de Ego; el runtime real es HTTP streamable en loopback. Es una corrección documental, no de diseño. |
| §8, punto 14 | El cliente MCP de Ego no puede conectarse al servidor MCP de Ego (la política SSRF bloquea loopback). Se resuelve con una exención acotada para `127.0.0.1` autenticado por bearer, o con un test de contrato fuera de proceso. |
| §3.7 | Las rutas de las apps web (Dify, Flowise, Langflow, n8n, ActivePieces, Windmill, LobeChat, LibreChat, AnythingLLM, Open WebUI, Jan, Cherry Studio) están marcadas **no verificadas en local**: no hay clones en `repos-referencia/`. Para verificarlas: clonar el repo y localizar el módulo de persistencia de configuración (`packages/server` en la mayoría). |
| §3.1 | La ruta de `claude_desktop_config.json` en macOS y Windows está verificada **indirectamente** por las raíces de connector de Codex (`source/cla.rs:34-73`), no por el código de Claude Desktop. Para verificarla de forma directa: instalar Claude Desktop y listar `%APPDATA%\Claude` y `~/Library/Application Support/Claude`. |
| §6 | Las señales de detección por **proceso activo** y por **registro de Windows** se marcan como baja fiabilidad y "solo informativo" porque no se han verificado empíricamente en esta sesión. Para verificarlas: instalar cada app en una máquina limpia y enumerar `tasklist`, `Get-ChildItem HKCU:\Software` y `%LOCALAPPDATA%\Packages`. |
| §5 | La traducción de `marketplace.json` con `source` de tipo `github`, `git-subdir`, `url`, `archive`, `npm` y `command` no está verificada contra el código de Claude Code: se ha basado en la documentación oficial. Para verificarlo: inspeccionar `anthropics/claude-code`, que no está clonado en `repos-referencia/`. |
| §9.2 | El esquema del manifiesto de plugin de Ego (`plugin-v1.json`) es una **propuesta**, no un contrato. Su validación formal requiere una tarea propia en la Fase 12. |
| §3.4 | La ruta `~/.cursor/cli-config.json` y `<proyecto>/.cursor/mcp.json` están verificadas por el importador de Codex (`source/cur.rs:19-26` y `:36-38`), que las lee de Cursor. No se ha verificado el código de Cursor en sí. |

---

## 13. Trazabilidad de la evidencia ##

| Afirmación | Fuente de la evidencia |
| --- | --- |
| Revisión vigente del protocolo `2026-07-28` | `modelcontextprotocol.io/specification/versioning` |
| `initialize` eliminado, `_meta` por request, `server/discover` | `docs/specification/2026-07-28/changelog.mdx` (SEP-2575) |
| MRTR sustituye a `roots/list` y `sampling` | `docs/specification/2026-07-28/changelog.mdx` (SEP-2322) |
| SSE sale del binding estándar y se elimina el GET stream | `docs/specification/2026-07-28/basic/transports/index.mdx` |
| Esquema `server.json` del registro | `modelcontextprotocol/registry/docs/reference/server-json/generic-server-json.md` |
| Formato Agent Skills y sus campos | `agentskills.io/specification` |
| Adopción de Agent Skills por más de 50 clientes | `agentskills.io/home` (catálogo de clientes) |
| AGENTS.md gobernado por la AAIF (Linux Foundation) | `agents.md` |
| Codex importa configs de Claude Code y Cursor | `codex-rs/external-agent-migration/src/detect/mod.rs:39-73` |
| Campos del JSON MCP de Claude | `codex-rs/external-agent-migration/src/mcp.rs:186-244` |
| Placeholders `${VAR}` y `${VAR:-default}` | `codex-rs/external-agent-migration/src/mcp.rs:333-347` |
| Rutas de Claude Code y Claude Desktop por SO | `codex-rs/external-agent-migration/src/source/cla.rs:20-22,34-73` |
| Rutas de Cursor | `codex-rs/external-agent-migration/src/source/cur.rs:19-26` |
| Marketplace de plugins de Claude | `codex-rs/external-agent-migration/src/source_cla.rs:20-24` |
| Descubrimiento de skills de OpenCode | `packages/web/src/content/docs/skills.mdx:16-19,41-48` |
| Precedencia de skills de OpenCode | `packages/web/src/content/docs/skills.mdx:162-180` |
| OAuth de OpenCode (PKCE, CIMD y DCR) | `packages/web/src/content/docs/mcp-servers.mdx:189-278` |
| Selección de revisión de protocolo en OpenCode | `packages/web/src/content/docs/mcp-servers.mdx:121,176` |
| Directorios de sistema de OpenCode por SO | `packages/web/src/content/docs/config.mdx:28-48` |
| Skills de Goose y directorios compartidos | `goose/crates/goose/src/skills/mod.rs:45-53,166-171,323-325` |
| Directorios de subagentes de Goose | `goose/crates/goose/src/sources.rs:461-475,517-548` |
| Goose retira su directorio de servidores MCP | `goose/AGENTS.md`, sección "MCP Server Directory" |
| Cline: `cline_mcp_settings.json` y `plugin.json` | `cline/docs/mcp/mcp-overview.mdx:28`, `cline/sdk/README.md:220` |
| Cline: `~/.agents/plugins/*` y el veto al workspace | `cline/apps/cli/CHANGELOG.md:129` |
| Continue: `mcpServers` en YAML | `continue/extensions/cli/spec/mcp.md:5` |
| Gemini CLI: rutas por SO | `gemini-cli/packages/core/src/config/storage.ts:54-59,79,139-159,174-188,344` |
| Qwen Code: `.qwen/*` y `QWEN_HOME` | `qwen-code/.gitignore:35-62`, `qwen-code/CHANGELOG.md:1020` |
| Hermes: `~/.hermes/config.yaml` y `.mcp.json` | `hermes-agent/AGENTS.md:98`, `hermes-agent/.gitignore:161` |
| Persistencia de servidores MCP de Ego | `apps/desktop/src/main.ts:2370,2390,2410` (`gov/mcp_servers`) |
| Transporte real del servidor MCP de Ego | `apps/desktop/src/main/mcp/mcp-server-runtime.ts:10-11,109` |
| Servidor MCP de Ego: solo POST | `apps/desktop/src/main/mcp/mcp-http-server.ts:152-160` |
| Allowlist de spawn MCP de Ego | `packages/integrations/src/mcp/McpClient.ts:34-43,59-71` |
| Brechas del cliente MCP de Ego | `packages/integrations/src/mcp/McpClient.ts:174,251-261,582-585,607-625,627-629,686-690,787-797,825-852` |
| Brechas del servidor MCP de Ego | `packages/integrations/src/mcp/McpServer.ts:115-147,127-134,153-157,167-176,256-280,330-345` |
| Restricción de cabeceras de autenticación | `packages/integrations/src/mcp/types.ts:283,291-336` |
| Divergencias ya catalogadas | `docs/extractions/mcp-servers.md` (MCPS-01 a MCPS-09) |
| Configuración de reglas del linter | `.markdownlint.json` |

---

## Verificación de datos (2026-10-20) ##

Auditoría independiente de este informe. Los 41 repos de §10.2 se reconsultaron en
`GET /repos/{owner}/{repo>` de la API REST de GitHub el 2026-10-20 y se compararon
`stargazers_count`, `pushed_at`, `license.spdx_id` y `archived`. Las licencias `NOASSERTION`
se resolvieron leyendo el fichero de licencia en `raw.githubusercontent.com`. Las referencias
`ruta:línea` se comprobaron contra los clones de `repos-referencia/` y, para los repos no
clonados, descargando el fichero desde `raw.githubusercontent.com`.

| Dato verificado | Valor declarado | Valor real | Fuente | Estado |
| --- | --- | --- | --- | --- |
| `modelcontextprotocol/servers` — estrellas, push | 91 397 · 2026-10-19 | 91 397 · 2026-10-19 | API | Correcto |
| `modelcontextprotocol/servers` — licencia | `NOASSERTION` (mixta) | MIT → Apache-2.0 (transición declarada) | `LICENSE` | Corregido |
| `modelcontextprotocol/registry` — licencia | `NOASSERTION` | MIT → Apache-2.0 (transición declarada) | `LICENSE` | Corregido |
| `modelcontextprotocol/typescript-sdk` — estrellas, licencia | 13 618 · `NOASSERTION` (MIT) | 13 619 · MIT → Apache-2.0 (transición) | API + `LICENSE` | Corregido |
| `modelcontextprotocol/python-sdk` — estrellas, licencia, push | 24 624 · MIT · 2026-10-17 | 24 624 · MIT · 2026-10-17 | API | Correcto |
| `modelcontextprotocol/inspector` — estrellas, licencia | 11 106 · `NOASSERTION` | 11 107 · MIT → Apache-2.0 (transición) | API + `LICENSE` | Corregido |
| `punkpeye/awesome-mcp-servers` — estrellas | 96 639 | 96 640 | API `stargazers_count` | Corregido |
| `wong2/awesome-mcp-servers` — estrellas | 4 371 | 4 372 | API `stargazers_count` | Corregido |
| `jlowin/fastmcp` — nombre del repo | `jlowin/fastmcp` | `PrefectHQ/fastmcp` (28 143 estrellas, Apache-2.0, 2026-10-20) | API `full_name` | Corregido |
| `lastmile-ai/mcp-agent` — estrellas, licencia, push | 8 571 · Apache-2.0 · 2026-01-25 | idéntico | API | Correcto |
| `mcpjungle/MCPJungle` — estrellas, licencia, push | 1 303 · MPL-2.0 · 2026-08-02 | idéntico | API | Correcto |
| `docker/mcp-gateway` — estrellas, licencia, push | 1 607 · MIT · 2026-09-23 | idéntico | API | Correcto |
| `open-webui/mcpo` — estrellas, licencia, push | 4 405 · MIT · 2026-05-17 | idéntico | API | Correcto |
| `openclaw/mcporter` — estrellas | 5 075 | 5 076 | API `stargazers_count` | Corregido |
| `sparfenyuk/mcp-proxy` — estrellas, licencia, push | 2 796 · MIT · 2026-10-14 | idéntico | API | Correcto |
| `agentgateway/agentgateway` — estrellas, licencia, push | 5 422 · Apache-2.0 · 2026-10-20 | idéntico | API | Correcto |
| `mcp-router/mcp-router` — estado | (no declarado) | `archived: true` | API `archived` | Añadido |
| `pathintegral-institute/mcpm.sh` — estrellas, licencia, push | 1 015 · MIT · 2026-10-20 | idéntico | API | Correcto |
| `microsoft/mcp` — estrellas | 3 788 | 3 789 | API `stargazers_count` | Corregido |
| `awslabs/mcp` — estrellas, licencia, push | 9 796 · Apache-2.0 · 2026-10-20 | idéntico | API | Correcto |
| `cloudflare/mcp-server-cloudflare` — estrellas, licencia, push | 4 396 · Apache-2.0 · 2026-10-19 | idéntico | API | Correcto |
| `stripe/agent-toolkit` — nombre del repo | `stripe/agent-toolkit` | `stripe/ai` (1 963 estrellas, MIT, 2026-10-20) | API `full_name` | Corregido |
| `anthropics/skills` — estrellas | 182 331 | 182 334 | API `stargazers_count` | Corregido |
| `anthropics/skills` — licencia | sin `LICENSE` raíz | sin fichero de licencia en la raíz (`LICENSE` y `LICENSE.md` dan 404) | `raw` | Correcto |
| `anthropics/claude-code` — estrellas, licencia | 152 807 · sin `LICENSE` en el root | 152 812 · `LICENSE.md` propio (© Anthropic PBC, sin SPDX) | API + `LICENSE.md` | Corregido |
| `anthropics/claude-agent-sdk` — nombre y licencia | `anthropics/claude-agent-sdk` · sin `LICENSE` | `anthropics/claude-agent-sdk-typescript` · `LICENSE.md` propio (© Anthropic PBC, sin SPDX) | API `full_name` + `LICENSE.md` | Corregido |
| `obra/superpowers` — estrellas | 302 279 | 302 306 | API `stargazers_count` | Corregido |
| `wshobson/agents` — estrellas | 41 200 | 41 202 | API `stargazers_count` | Corregido |
| `github/awesome-copilot` — estrellas | 40 206 | 40 207 | API `stargazers_count` | Corregido |
| `simonw/llm` — estrellas, licencia, push | 12 645 · Apache-2.0 · 2026-10-18 | idéntico | API | Correcto |
| `openai/codex` — estrellas | 130 001 | 130 005 | API `stargazers_count` | Corregido |
| `lobehub/lobe-chat` — estrellas, licencia, push | 83 352 · `NOASSERTION` · 2026-10-20 | 83 352 · LobeHub Community License · 2026-10-20 | API + `LICENSE` | Correcto |
| `danny-avila/LibreChat` — nombre y estrellas | `danny-avila/LibreChat` · 46 039 | `LibreChat-AI/LibreChat` · 46 042 | API `full_name` | Corregido |
| `Mintplex-Labs/anything-llm` — estrellas, licencia, push | 67 343 · MIT · 2026-10-20 | idéntico | API | Correcto |
| `open-webui/open-webui` — estrellas, licencia, push | 156 230 · `NOASSERTION` · 2026-10-19 | idéntico | API + `LICENSE` | Correcto |
| `langgenius/dify` — estrellas | 158 977 | 158 980 | API `stargazers_count` | Corregido |
| `FlowiseAI/Flowise` — estrellas, licencia, push | 55 512 · `NOASSERTION` · 2026-08-13 | idéntico | API | Correcto |
| `langflow-ai/langflow` — estrellas, licencia, push | 155 859 · MIT · 2026-10-20 | idéntico | API | Correcto |
| `n8n-io/n8n` — estrellas, licencia | 208 093 · `NOASSERTION` (fair-code) | 208 095 · Sustainable Use License en `LICENSE.md` | API + `LICENSE.md` | Corregido |
| `activepieces/activepieces` — licencia | `NOASSERTION` | MIT salvo `packages/ee/` | `LICENSE` | Corregido |
| `windmill-labs/windmill` — licencia | `NOASSERTION` | Apache-2.0 + AGPLv3 + licencia propietaria, por fichero | `LICENSE` | Corregido |
| `janhq/jan` — estrellas, licencia | 45 020 · `NOASSERTION` | 45 019 · Apache-2.0 con cabecera no estándar | API + `LICENSE` | Corregido |
| `CherryHQ/cherry-studio` — estrellas | 52 778 | 52 780 | API `stargazers_count` | Corregido |
| `ComposioHQ/composio` — estrellas, licencia, push | 30 644 · MIT · 2026-10-20 | idéntico | API | Correcto |
| Nº de repositorios declarados en §2.2 | 45 | 41 filas en §10.2 | recuento del informe | Corregido |
| `packages/integrations/src/mcp/McpClient.ts` — líneas 34-43, 59-71, 174, 251-261, 258-260, 443-490, 582-585, 607-625, 627-629, 686-690, 787-797, 825-852 | citadas | las 12 referencias existen y corresponden al mecanismo descrito | árbol local | Correcto |
| `packages/integrations/src/mcp/McpServer.ts` — líneas 115-147, 127-134, 153-157, 167-176, 256-280, 330-345 | citadas | las 6 referencias existen y corresponden al mecanismo descrito | árbol local | Correcto |
| `packages/integrations/src/mcp/types.ts` — líneas 67-76, 83, 137, 283, 291-336 | citadas | confirmadas (`McpToolDefinition`, `nextCursor`, `transport`, cabeceras bloqueadas, `assertSafeMcpHttpUrl`) | árbol local | Correcto |
| `apps/desktop/src/main/mcp/mcp-server-runtime.ts:10-11,109` y `mcp-http-server.ts:135,152-160` | citadas | confirmadas (HTTP streamable en 127.0.0.1; bearer validado; GET → 405) | árbol local | Correcto |
| `apps/desktop/src/main.ts:2370,2390,2410` — persistencia `gov/mcp_servers` | citadas | confirmadas | árbol local | Correcto |
| `docs/engineering/integraciones.md:80`, `:99` | citadas | confirmadas (descubrimiento; transporte `stdio` del servidor MCP) | árbol local | Correcto |
| `codex-rs/external-agent-migration/src/mcp.rs` (42-51, 186-244, 264-283, 306-331, 333-347), `detect/mod.rs:39-73`, `source/cla.rs:20-22,34-73`, `source/cur.rs:19-26`, `source_cla.rs:20-24` | citadas | confirmadas contra el clon local | `repos-referencia/codex` | Correcto |
| Rutas de la documentación de OpenCode en §13 | `opencode/services/www/src/content/docs/*.mdx` | `packages/web/src/content/docs/*.mdx` | clon local | Corregido |
| `goose/crates/goose/src/skills/mod.rs` (45-53, 166-171, 323-325) y `sources.rs` (461-475, 517-548) | citados | confirmados contra el clon local | `repos-referencia/goose` | Correcto |
| `cline/docs/mcp/mcp-overview.mdx:28`, `cline/sdk/README.md:220`, `cline/apps/cli/CHANGELOG.md:129` | citados | confirmados contra el clon local | `repos-referencia/cline` | Correcto |
| `continue/extensions/cli/spec/mcp.md:5` | citado | confirmado contra el clon local | `repos-referencia/continue` | Correcto |
| `gemini-cli/packages/core/src/config/storage.ts:54-59,79,139-159,174-188,344` | citados | confirmados contra el clon local | `repos-referencia/gemini-cli` | Correcto |
| `qwen-code/.gitignore:35-62`, `qwen-code/CHANGELOG.md:1020` | citados | confirmados contra el clon local | `repos-referencia/qwen-code` | Correcto |
| `hermes-agent/AGENTS.md:98`, `hermes-agent/.gitignore:161` | citados | confirmados contra el clon local | `repos-referencia/hermes-agent` | Correcto |
| Revisión vigente del protocolo `2026-07-28` y su changelog | declarada | no re-verificada en esta auditoría (fuera de la API de GitHub) | — | No verificado (2026-10-20) |
| "50+ clientes declarados" de Agent Skills | declarado | no re-verificado | — | No verificado (2026-10-20) |
| "60 k+ repos" que usan `AGENTS.md` | declarado | no re-verificado | — | No verificado (2026-10-20) |
| Rutas de configuración de las apps web (§3.7) | marcadas no importables | sin clones en `repos-referencia/` | — | No verificado (2026-10-20) |
| Señales de detección por proceso activo y registro de Windows (§6) | baja fiabilidad | no verificadas empíricamente | — | No verificado (2026-10-20) |
| Variantes del campo `source` de `marketplace.json` (§5) | 6 variantes | basadas en documentación oficial, no en el código de Claude Code | — | No verificado (2026-10-20) |

Notas de la auditoría:

- Ningún repo de §10.2 resultó inexistente, pero **tres cambiaron de nombre** desde la redacción
  del informe y se corrigen aquí: `jlowin/fastmcp` → `PrefectHQ/fastmcp`, `stripe/agent-toolkit` →
  `stripe/ai` y `anthropics/claude-agent-sdk` → `anthropics/claude-agent-sdk-typescript`. Un
  cuarto, `danny-avila/LibreChat`, es un alias del owner canónico `LibreChat-AI/LibreChat`.
- **Las licencias `NOASSERTION` no eran "mixta": casi todas son declaraciones explícitas.** Los
  repos de MCP (`servers`, `registry`, `typescript-sdk`, `inspector`) declaran la transición
  MIT → Apache-2.0; `activepieces` es MIT con `packages/ee/` comercial; `windmill` es Apache-2.0
  más AGPLv3 más licencia propietaria, por fichero; `jan` es Apache-2.0 con cabecera no estándar;
  `n8n` es Sustainable Use License.
- `anthropics/claude-code` y `anthropics/claude-agent-sdk-typescript` **sí tienen** `LICENSE.md`
  en la raíz: es propietario (© Anthropic PBC, sin SPDX), no "sin `LICENSE`".
- `mcp-router/mcp-router` está **archivado**, dato que faltaba y que refuerza el veredicto de
  "no depender".
- La evidencia de código de este informe es la más sólida de las tres: **las 40 referencias
  `ruta:línea` comprobadas existen y corresponden al mecanismo descrito**, con la única excepción
  de la ruta de la documentación de OpenCode en §13, que estaba mal escrita.
- Contradicciones con los informes ya auditados, unificadas aquí: `n8n-io/n8n` 208 093 → **208
  095**, `langgenius/dify` 158 977 → **158 980**, `LibreChat-AI/LibreChat` 46 039 → **46 042**,
  `CherryHQ/cherry-studio` 52 778 → **52 780**, `janhq/jan` 45 020 → **45 019**,
  `anthropics/claude-code` 152 807 → **152 812**, `obra/superpowers` 302 279 → **302 306**,
  `wshobson/agents` 41 200 → **41 202**, `github/awesome-copilot` 40 206 → **40 207**,
  `openai/codex` 130 001 → **130 005**.

**Recuento**: 59 cifras verificadas · 27 corregidas · 6 marcadas "no verificado".
