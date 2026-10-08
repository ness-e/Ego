---
name: coordinated-web-search
description: OBLIGATORIA para cualquier petición de investigar, buscar, validar o descubrir algo en internet. Router en cascada websearch→metasearch→argus. Carga SIEMPRE antes de usar cualquier herramienta de búsqueda web.
---

# Skill: coordinated-web-search (v3 — Router en Cascada)

> **v3 (2026-09-28):** reescrita tras la limpieza de MCPs. Se eliminaron `agent-search` (6/9 adapters en
> `bot_challenge`), `firecrawl` (sin API key) y `metasearchmcp` (duplicado de `metasearch`).
> Los 3 servidores de esta skill viven en el **config global** y están activos en todos los perfiles.

## Arquitectura

```
Petición de investigación en internet
        │
        ▼
[0] HEALTH-CHECK mental: ¿qué capa responde?
        │
        ├── 1. WEBSEARCH (keyless, arranque rápido, cero config)
        │      websearch_search (DuckDuckGO por defecto; engines: bing, brave,
        │      startpage, sogou, baidu…) + websearch_fetchWebContent
        │
        ├── 2. METASEARCH (canónico — ~1700 providers keyless)
        │      search_web / search_code / search_github / search_academic /
        │      search_news / search_images…
        │      compare_engines → URLs consistentes en ≥2 engines = confiables
        │
        ├── 3. ARGUS (profundidad: contenido y URLs muertas)
        │      extract_content → markdown (jina/playwright) ← la más útil
        │      recover_url → Wayback Machine
        │      search_web crippled: solo yahoo + github responden
        │
        └── 4. FALLBACKS escalonados
               websearch_fetchWebContent → Jina (r.jina.ai) → Playwright browser real
```

## Regla de oro

**Nunca depender de una sola herramienta.** Cada nivel tiene fallback al siguiente.
Si el nivel 1-2 falla por red, el flujo sigue funcionando con keyless.

**Toda afirmación obtenida de internet se cita con su URL fuente.** Si ninguna capa responde,
decirlo explícitamente — nunca inventar ni rellenar con conocimiento interno.

---

## Flujo por tipo de consulta

### Búsqueda general ("busca X en internet")
1. `websearch_search(X)` — keyless, respuesta inmediata
2. Insuficiente o sesgado → `metasearch_search_web(X, tags:["web"])`
3. Validar → `metasearch_compare_engines(X)` (consistencia entre engines)
4. Leer fuente completa → `argus_extract_content(url)` → fallback `webfetch https://r.jina.ai/<url>`

### Contenido de página ("léeme esta URL")
1. `websearch_fetchWebContent(url)` — rápido, markdown + readability
2. `argus_extract_content(url)` — extracción con quality gates, mejor para JS-rendered
3. Falla/paywall → `webfetch https://r.jina.ai/{url}`
4. JS-rendered → Playwright MCP (`browser_navigate` + `snapshot`)

### Página muerta / URL rota
1. `argus_recover_url(url)` — Wayback Machine + archive.is
2. Nada → buscar el contenido en otra fuente viva (nivel búsqueda general)

### GitHub / código / packages
1. `metasearch_search_github(q)` o `metasearch_search_code(q)` — cubre crates, npm, PyPI, Maven, GitHub
2. Fallback: `webfetch` a raw.githubusercontent.com

### Papers / academia
1. `metasearch_search_academic(q)` — arXiv, Semantic Scholar, CrossRef, OpenAlex, Europe PMC
2. Fallback: `webfetch` a arxiv.org/abs/... directamente

### Validación de hechos ("¿es cierto que...?")
1. Buscar en ≥2 capas distintas (websearch + metasearch)
2. `compare_engines` → URLs presentes en múltiples engines priorizan
3. Extraer texto original de las fuentes coincidentes y citar

### Investigación profunda (multi-paso)
1. Descubrir fuentes (nivel búsqueda general)
2. Extraer las 3-5 más relevantes en paralelo (nivel contenido)
3. Sintetizar con citas por URL
4. Usar `argus_build_research_pack(topic: "...")` si aplica — OJO: el parámetro se llama `topic`, no `query`

---

## Diagnóstico rápido (si algo falla)

| Síntoma | Causa | Acción |
|---|---|---|
| metasearch: timeout en TODOS los engines | Proceso MCP wedgeado (sockets stale) | Restart opencode; la librería funciona (verificado) |
| Argus: "MISSING KEY" en provider | Falta API key en config de argus | Habilitar keyless (yahoo/github ya funcionan) |
| Argus: provider DISABLED | Config lo deshabilitó (brave/serper/tavily/exa están así) | Editar config de argus; los budgets no son gastables hasta entonces |
| websearch 403 en exa | Backend del host caído | Usar metasearch / argus |
| Todo falla | Red global | Solo queda webfetch + Playwright |

## Instalación / configuración actual

```jsonc
// %USERPROFILE%\.config\opencode\opencode.json  (GLOBAL)
"metasearch": { "command": ["...\\uv\\tools\\metasearchmcp\\Scripts\\metasearchmcp-mcp.exe"],
                "environment": { "ALLOW_UNSTABLE_PROVIDERS": "true" } },
"websearch":  { "command": ["node", "...\\npm\\node_modules\\open-websearch\\build\\index.js"],
                "environment": { "MODE": "stdio", "DEFAULT_SEARCH_ENGINE": "duckduckgo",
                                 "SEARCH_MODE": "auto" } },
"argus":      { "command": ["...\\hermes\\hermes-agent\\venv\\Scripts\\argus.exe", "mcp", "serve"] }
```

Jina Reader no requiere instalación: `https://r.jina.ai/<url-cualquiera>`

## Cuándo usar cada capa (resumen para el agente)

| El usuario dice... | Ruta |
|---|---|
| "busca X" | websearch_search → metasearch_search_web → compare_engines |
| "verifica X" | 2+ capas → compare_engines → extraer originales |
| "encuentra repos/tools" | metasearch_search_github / search_code |
| "busca papers" | metasearch_search_academic |
| "léeme esta URL" | websearch_fetchWebContent → argus.extract_content → jina → playwright |
| "URL muerta" | argus_recover_url |
| "investigación profunda" | descubrir → extraer paralelo → sintetizar con citas |
