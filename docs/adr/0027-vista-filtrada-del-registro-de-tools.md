# ADR 0027: Vista filtrada del registro de tools por Sub-Ego

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-21 |
| Estado | Aceptado (implementado y verificado en `packages/tools/**`, `packages/subegos/**` y `packages/runtime/**`) |
| Nivel jerárquico | 4.Architecture (`docs/jerarquia-canonica.md`) |
| Decisor | Owner ("Vista filtrada por Sub-Ego", 2026-10-21) · diseño e implementación A4 · aplicación en el loop A2-bis · ámbito MCP A3 |
| Sustituye a | Nada - fija el modelo de aislamiento de tools que `AGENTS.md` §2 y la E13 dejaban indefinido |
| Relacionado | [ADR-0024](0024-identidad-declarativa-y-presupuestos.md) · `EGO-FIND-90` · `EGO-FIND-45` |

## Contexto

El registro de tools (`packages/tools/src/ToolRegistry.ts`) es **global** y lo consultan tres superficies:

1. la **superficie del modelo** (las tools que se le pasan al LLM),
2. la **E13** (`search_tools` / `expand_tools`, la divulgación progresiva),
3. la **ejecución** (resolver una tool por nombre).

El problema no era el registro: era que **no había dueño**. `ToolDefinition.origin` dice **de dónde viene** una tool
(`native` / `mcp` / `custom` / `skill`), **no de quién es**. Sin dueño no hay aislamiento posible, y las tools de
**arrival tardío** —las de un servidor MCP que se conecta en caliente— se filtraban de forma **desigual** según el Sub-Ego
que consultara. La única aproximación existente (`cloneRegistryForProfile`) era un **clon** sin uso: habría congelado el
catálogo (el arrival tardío no aparecería) y multiplicado la memoria por Sub-Ego.

El owner decidió (2026-10-21) la **vista filtrada por Sub-Ego**.

## Decisión

1. **El registro global sigue siendo la única fuente de verdad.** No se clona. Cada Sub-Ego consulta una **proyección**
   (`subEgoToolsView(registry, subEgoId)`): un predicado por tool, **recalculado en cada consulta** → el *arrival tardío*
   se ve **sin reconstruir nada**, sin clones y sin divergencia.
2. **El dueño es de primera clase.** `ToolDefinition.ownerSubEgoId?` y `register(tool, { ownerSubEgoId })`. La
   precedencia es `tool.ownerSubEgoId ?? options.ownerSubEgoId`.
3. **Regla de visibilidad**: tool **con dueño** → privada de su Sub-Ego. Tool **sin dueño** → **global**.
4. **El ámbito es explícito, no accidental.** Para el MCP, el ámbito es un **tipo** (`McpToolOwnership`:
   `{scope:"app"}` | `{scope:"sub-ego"; ownerSubEgoId}`) propagado por `registerServer`/`connectServer` y **persistido en
   la entrada**, no un parámetro suelto que se pueda olvidar. La conexión MCP la abre **la app** (el usuario la configura:
   `ipc.mcp.addServer` no tiene campo de Sub-Ego) ⇒ sus tools son **infraestructura compartida** y su ámbito es
   `{scope:"app"}`, **declarado**.
5. **Fail-closed en el acceso**: `expand_tools` **falla con un error** ante una tool ajena (no
   devuelve un schema vacío) y la **ejecución** se resuelve contra la misma vista, con un error **tipado**
   (`ToolNotVisibleToSubEgoError`, categoría `TOOL_NOT_VISIBLE` ≠ `TOOL_NOT_FOUND`): *"no existe"* y *"no es tuya"* son
   errores distintos.
6. **El budget mide lo que se usa.** La superficie efectiva = **declarada ∧ visible** (`manifest.tools` ∧ vista).
   `manifest.tools` deja de ser una declaración inerte: es el presupuesto declarado que la superficie efectiva aplica.
7. **Sin Sub-Ego se ve el global.** La app, el usuario y la introspección (UI, servidor MCP, `ipc.mcp.*`) consultan el
   registro global **deliberadamente**: es la vista del *usuario*, no la de un Sub-Ego.

## Consecuencias

### A favor

- El **aislamiento por Sub-Ego es real y comprobable**: `expand_tools` falla cerrado ante una tool ajena y la ejecución
  también.
- El *arrival tardío* se ve sin reconstruir nada: la vista se recalcula, no se clona.
- El **budget por Sub-Ego** mide la superficie que realmente usa (declarada ∧ visible), no el catálogo global.
- El **ámbito del MCP es explícito** y **persistido**: apagar y volver a encender un servidor MCP no deja la tool
  privada convertida en global.

### En contra — agujero de aislamiento reconocido

Una tool registrada **sin dueño** es visible para todos. Hoy es **inocuo** (las tools del producto son infraestructura
compartida) y el ámbito del MCP lo hace explícito, pero **las tools que *nacen* de un Sub-Ego deben declarar dueño**. El
`ownerSubEgoId` es de primera clase en el contrato y la regla está **testeada**; el fail-closed puro se descartó (ver
alternativas). ⚠️ Un Sub-Ego podría invocar por nombre una tool ajena **si** la vista no se aplica en la ejecución: por eso
la aplicación de la vista en el loop es parte de esta decisión, no un extra.

## Alternativas descartadas

| Alternativa | Veredicto | Motivo |
| --- | --- | --- |
| **Clon por perfil** (`cloneRegistryForProfile`) | Descartada | Congela el catálogo (el *arrival tardío* no aparece) y multiplica la memoria por Sub-Ego. |
| **Fail-closed puro** ("sin dueño ⇒ invisible") | Descartada | Dejaría **vacía** la superficie de todos los Sub-Egos (ninguna tool tiene dueño hoy) y rompería la delegación. |
| **Filtrar en la capa que consulta** | Descartada | Duplicaría la regla en tres sitios (la E13, el loop y el budget) y cada copia se olvidaría de actualizarse. |
| **Tool registry por Sub-Ego** (un registro por Sub-Ego) | Descartada | El registro global dejaría de ser la fuente de verdad: aparecería divergencia y habría que sincronizar. |
| **Un parámetro `ownerSubEgoId` suelto en `connectServer`** | Descartada | Se olvidaría en algún camino y el *fallback* (sin dueño ⇒ global) abriría el aislamiento sin que nadie lo notara. El **tipo** lo hace explícito. |
