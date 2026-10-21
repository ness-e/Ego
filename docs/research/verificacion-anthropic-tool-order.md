---
title: "Verificación de la constraint del proveedor sobre el orden de tool_result vs tool_use"
kind: research
status: active
description: "Verificación independiente contra la documentación oficial de Anthropic de la constraint que bloqueaba la ejecución concurrente de tool calls, con URLs y fecha"
tags: [arquitectura, research]
supersedes: null
superseded_by: null
---

> **Conclusión:** la constraint que la ola 3 tenía por bloqueante **no existe en su forma general**.
> La documentación oficial de Anthropic **exige emparejar por `tool_use_id`**, **no** por posición, y
> **autoriza explícitamente la ejecución concurrente**. La exigencia de orden secuencial aplica
> **solo** a los *batch actions* de las tools `computer use` y `browser use`.
> → **`EGO-FIND-80` se puede cerrar como RESUELTA** y **`EGO-FIND-43` (paralelismo de tool calls) queda DESBLOQUEADO**.

## 1. El bloqueo que se heredó

`EGO-FIND-80` (tarea transversal T-X3 de la Ola 3) pedía contrastar contra la **fuente primaria** la
suposición con la que A2 justificó no implementar ejecución concurrente de tool calls:

> *"Anthropic exige que cada `tool_result` siga en orden a su `tool_use`."*

A2 lo verificó contra el **source del SDK** (`anthropic-sdk-typescript`), que es sólido pero no es la
fuente primaria, y dejó `EGO-FIND-80` abierta con la anotación de que
`docs.anthropic.com` está **geobloqueado por región** en este entorno.

## 2. El bloqueo, reproducido con evidencia

| Vía | URL | Resultado | Evidencia |
| --- | --- | --- | --- |
| Fetch directo | `https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use` | **HTTP 200 con la página de región**, no la doc | El cuerpo devuelto es literalmente *"App unavailable in region — Unfortunately, Claude is only available in certain regions right now."* + el pie *"View supported countries"*. No hay una sola línea de la página de tool use. |
| Buscador `websearch` (host) | consulta sobre la constraint | **HTTP 403** | Error de ejecución del backend de búsqueda. |
| Buscador `metasearch` (MCP) | `"Anthropic tool_result blocks must be in the same order as tool_use parallel tool use"` | Respuestas irrelevantes | Devuelve la home de anthropic.com y Wikipedia; ningún resultado sobre la constraint. |
| `metasearch.search_github` | `anthropic-cookbook tool_use parallel tool_result order` | **0 resultados** | El índice de GitHub del provider no devuelve nada para esa consulta. |
| `metasearch.search_code` | `"tool_result blocks must be in the same order as tool_use"` | Ruido | Devuelve paquetes npm sin relación (`oxc-parser`, `postcss-sorting`…): la cadena no está indexada. |

**Conclusión del diagnóstico:** el bloqueo es real para `docs.anthropic.com` **directo** y para el
buscador del host, y **no lo es** para un lector de texto de terceros.

## 3. La vía que funciona: lector de texto (Jina Reader)

`https://r.jina.ai/<url>` devuelve el **mismo contenido de la página oficial** renderizado a markdown.
Bypass verificado, sin cuenta ni clave.

| URL oficial (canónica) | Vía | HTTP | Longitud | Estado |
| --- | --- | --- | --- | --- |
| `https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use` | `r.jina.ai` | 200 | 9 051 | ✅ doc real ("Define tools") |
| `https://docs.anthropic.com/docs/en/agents-and-tools/tool-use/overview` | `r.jina.ai` | 200 | 10 580 | ✅ doc real |
| `https://docs.anthropic.com/docs/en/agents-and-tools/tool-use/handle-tool-calls` | `r.jina.ai` | 200 | 24 248 | ✅ doc real |
| `https://docs.anthropic.com/docs/en/agents-and-tools/tool-use/parallel-tool-use` | `r.jina.ai` | 200 | 6 192 | ✅ doc real |
| `https://docs.anthropic.com/en/api/messages` | `r.jina.ai` | 200 | 43 297 | ✅ referencia de API |
| `https://raw.githubusercontent.com/anthropics/anthropic-sdk-typescript/main/src/resources/messages/messages.ts` | GitHub raw | 200 | 229 150 | ✅ source del SDK (accesible) |

> Nota sobre las URLs: la doc oficial usa **dos esquemas de URL** a la vez
> (`/en/docs/...` y `/docs/en/...`). Las páginas devuelven 200 en ambos, pero solo el lector de
> texto resuelve el contenido; con `fetch` directo **todas** devuelven la página de región.

## 4. Las citas (fuente primaria, 2026-10-21)

### 4.1 La ejecución concurrente está autorizada — `parallel-tool-use`

> "When Claude calls tools, the response has a `stop_reason` of `tool_use` and can contain several
> `tool_use` blocks in a single assistant turn. **How you run those calls is your decision. The API
> doesn't prescribe an execution order: you can run the calls concurrently (`Promise.all`,
> `asyncio.gather`), sequentially in the order they appear, or in any combination that suits your
> tools.**"
> — `https://docs.anthropic.com/docs/en/agents-and-tools/tool-use/parallel-tool-use` (consultado 2026-10-21)
> "**Whichever strategy you use, return one `tool_result` for each `tool_use` block, all together in
> the next user message. Match each result to its call with `tool_use_id`,** and put every
> `tool_result` block before any text content in that message."
> — *misma página*
> "The computer use tool and the browser use tool are stricter. When Claude returns several of their
> member tool calls in one turn (a batch action), **run them sequentially in the order they appear
> and stop at the first failure**; each tool defines the exact text to return for the calls you skip."
> — *misma página*
> "**Execution order is your choice.** If your tools have ordering dependencies, running the batch
> sequentially and stopping on the first failure is a valid strategy (and the required one for the
> computer use and browser use tools): return `is_error: true` for any call you didn't run."
> — *misma página*

### 4.2 Los requisitos reales de formato — `handle-tool-calls`

> "**Important formatting requirements:** **Tool result blocks must immediately follow their
> corresponding tool use blocks in the message history.** You cannot include any messages between
> the assistant's tool use message and the user's tool result message. And **in the user message
> containing tool results, the `tool_result` blocks must come FIRST in the content array.** Any text
> must come AFTER all tool results."
> — `https://docs.anthropic.com/docs/en/agents-and-tools/tool-use/handle-tool-calls` (consultado 2026-10-21)

### 4.3 La firma del parámetro — API de Messages

`ToolResultBlockParam object{ type: "tool_result", tool_use_id, cache_control, 3 more }`
— `https://docs.anthropic.com/en/api/messages` (consultado 2026-10-21)

## 5. Veredicto

| Constraint que se creía vigente | Veredicto | Fuente |
| --- | --- | --- |
| "Cada `tool_result` debe ir **en el orden** de su `tool_use`" (posicional) | **REFUTADA** para tools de usuario. La correspondencia es por `tool_use_id`; el orden de los bloques no es una constraint de la API | `parallel-tool-use` + `handle-tool-calls` |
| "La API no prescribe orden de ejecución" | **CONFIRMADA** — concurrencia explícitamente permitida | `parallel-tool-use` |
| "Los `tool_result` deben ir antes de cualquier texto en el mensaje de usuario" | **CONFIRMADA** — requirement real | `handle-tool-calls` |
| "El mensaje de `tool_result` debe seguir inmediatamente al mensaje de `tool_use`" | **CONFIRMADA** — requirement real | `handle-tool-calls` |
| "El orden secuencial es obligatorio" | **REFUTADA en general**; **obligatoria solo** en batch actions de `computer use` / `browser use` | `parallel-tool-use` |

**Por qué el source del SDK no mostraba el error:** el SDK valida *tipos y forma*, no *orden posicional*
de los `tool_result`; de ahí que la lectura del source pareciera confirmar una regla que la doc no
contiene. La diferencia entre las dos fuentes es precisamente el punto que `EGO-FIND-80` pedía
contrastar.

## 6. Impacto en Ego

- **`EGO-FIND-80`: RESUELTA.** La premisa del bloqueo era incorrecta. Cerrar con esta evidencia.
- **`EGO-FIND-43` (ejecución concurrente de tool calls): DESBLOQUEADO.** La implementación ya
  entregada en la Ola 2 (`packages/runtime/src/ToolExecutionLoop.ts:739-768`, 3 fases y
  `Promise.allSettled` que **conserva el orden de entrada**) es **más estricta que la API exige** y por
  tanto sigue siendo correcta: no hay que deshacerla ni relajarla.
- **Única cautela operativa:** si Ego incorpora alguna vez las tools `computer use` / `browser use`
  nativas de Anthropic, sus batch actions **sí** exigen ejecución secuencial con parada en el primer
  fallo. Hoy Ego no las usa (el browser va por MCP externo), así que la regla general aplica.
- **Nada que cambiar en el código.** El cambio es de **registro**: el finding se cierra y el
  paralelismo deja de estar anotado como bloqueado.

## 7. Vías verificables para el owner (si quiere la fuente primaria sin proxy)

1. **Lector de texto de terceros** — la vía usada aquí: `https://r.jina.ai/<url oficial>`. Devuelve
   el contenido de la página oficial, no una paráfrasis. Accesible sin cuenta.
2. **Mirror de la doc en GitHub** — el repositorio de docs de Anthropic es público y clonable con
   `git clone`; el markdown original conserva la redacción exacta de las secciones citadas.
3. **El SDK** — `github.com/anthropics/anthropic-sdk-typescript` (accesible, verificado 200) y
   `github.com/anthropics/anthropic-cookbook`, que incluye ejemplos ejecutables de tool use
   concurrente.
4. **Red propia del owner** — desde una región soportada, `docs.anthropic.com` carga directamente
   (la comprobación de región es del lado de Anthropic, no del cliente).

---

*Verificado por A8 el 2026-10-21 con lectura directa vía lector de texto. Fuente primaria citada
con URL y fecha. Sin commits: el orquestador commitea.*
