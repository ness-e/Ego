# MCP Profiles

OpenCode no soporta filtrado nativo de MCP servers por agente.  
Este sistema permite alternar entre perfiles manualmente.

> **⚠️ Alcance:** Los perfiles solo controlan MCPs configurados en el proyecto (`opencode.jsonc`).  
> MCPs del config global (`~/.config/opencode/opencode.json`) como metasearch, websearch, argus,
> playwright, notion, pencil, tavily y exa NO son afectados por estos perfiles.
>
> Esquema: `mcp.servers.<nombre>.disabled` (`false` = ON), igual que `opencode.jsonc`
> (migrado 2026-09-24; perfiles legacy `{mcp:{<nombre>:{enabled}}}` se autoconvierten).
> Los perfiles solo gestionan su subset (codegraph, discord, campaign, lottiefiles-creator);
> el resto de servers queda intacto.
>
> **Nota (2026-09-28):** `metasearchmcp` y `argus` se movieron al config global en la limpieza
> de MCPs de búsqueda (se eliminó el duplicado `metasearchmcp` y los inservibles `agent-search` /
> `firecrawl`). Por eso ya no figuran en los perfiles — lo global no es alternable por perfil.

## Perfiles disponibles

| Perfil | MCPs activos | Para qué |
|--------|-------------|----------|
| **core** | codegraph, codebase-memory-mcp, campaign | Tareas Rust, backend, ingeniería |
| **design** | codegraph, campaign | Diseño UI/visual, frontend |
| **full** | codegraph, codebase-memory-mcp, discord, campaign, lottiefiles-creator (default) | Desarrollo general |

Los 3 servidores de búsqueda (`metasearch`, `websearch`, `argus`) están en el config global y están
activos en **todos** los perfiles — ningún perfil los apaga.

## Cómo cambiar de perfil

```powershell
# Ver perfil actual
.agents/mcp-profiles/switch-profile.ps1 -Status

# Cambiar a perfil core (deshabilita discord, lottie)
.agents/mcp-profiles/switch-profile.ps1 -Profile core

# Cambiar a perfil design (solo codegraph + campaign)
.agents/mcp-profiles/switch-profile.ps1 -Profile design

# Volver a full (todo habilitado)
.agents/mcp-profiles/switch-profile.ps1 -Profile full

# Ver qué perfiles existen
.agents/mcp-profiles/switch-profile.ps1 -List
```

## Notas

- El cambio es inmediato — solo alterna `disabled: true/false` en `mcp.servers` de `opencode.jsonc`
- OpenCode debe reiniciarse (o recargar MCPs) para que el cambio surta efecto
- Los perfiles no borran config, solo alternan `enabled`
