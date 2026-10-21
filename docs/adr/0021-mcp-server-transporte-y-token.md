# ADR 0021: Transporte HTTP loopback y política de token del MCP Server de Ego #

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-20 |
| Estado | Aceptado (ratificado por el owner) |
| Nivel jerárquico | 4.Architecture (`docs/jerarquia-canonica.md`) |
| Decisor | Owner (2026-10-20) · implementación A3 (`EgoMcpServer`) + A4 (`startEgoMcpServer`) · redacción A1 |

## Contexto ##

`AGENTS.md` §7 exige que Ego sea **MCP Client *y* MCP Server**: "Ego opera
bidireccionalmente como **MCP Client** (consumidor de herramientas y recursos
externos) y como **MCP Server** (exposición de contexto del proyecto, memoria en
VantaDB, grafo de conocimiento y tareas para IDEs y agentes externos)".

`EgoMcpServer` (`packages/integrations/src/mcp/McpServer.ts`) implementa el
servidor: `tools/list`, `tools/call` (con validación Zod y gate HITL
fail-closed), `resources/list|read` y `prompts/list|get`. Estaba implementado y
testeado, pero **no se instanciaba en `src/`**: el servidor no existía en
producción.

El **transporte** no estaba decidido, y la decisión no es trivial porque el
contenido del servidor vive en el **proceso main**:

- Las tools están en el `ToolRegistry` del main.
- La memoria está en el `EgoMemoryAdapter` (VantaDB in-process).
- Las aprobaciones HITL las decide el `ApprovalEngine` del main.

## Alternativas consideradas ##

| Alternativa | Veredicto | Motivo |
|---|---|---|
| **Proceso hijo stdio** (`startStdio()`) | ❌ Descartada | Obliga a proxiar el `ToolRegistry` y la memoria por el pipe: el catálogo expuesto sería una **copia desincronizada**, no el catálogo real. Además `startStdio()` existía pero **nunca se arrancó**: no hay seam para compartir estado con el main. |
| **Socket local (unix domain socket / named pipe)** | ❌ Descartada | Mismo problema de proxying que stdio, más superficie de permisos por fichero en Windows. No aportaba nada sobre el loopback HTTP, que ya cumple el requisito de "no salir del host". |
| **HTTP streamable en `127.0.0.1`, in-proceso en main** | ✅ **Elegida** | Es el único transporte que expone **el runtime real** sin duplicarlo: el servidor HTTP vive **en el proceso main** y comparte `ToolRegistry`, `EgoMemoryAdapter` y `ApprovalEngine` por referencia. Cumple `AGENTS.md` §7 ("Ego = MCP Client **y** MCP Server"). |

**Criterio de decisión:** *¿el cliente MCP externo habla con el runtime real de
Ego o con una copia?* La respuesta exigía in-proceso, y el único transporte
in-proceso razonable sobre loopback es HTTP.

## Decisión ##

1. **Transporte: HTTP streamable en `127.0.0.1`, in-proceso en el proceso
   main.** `startEgoMcpServer()` (`apps/desktop/src/main/mcp/mcp-server-runtime.ts`)
   construye el `EgoMcpServer` con el `ToolRegistry` real, el `PayloadRegistry`
   (singleton), el `EgoMemoryAdapter` y el `SubEgoRegistry`, y lo sirve con
   `startEgoMcpHttpServer({ host: "127.0.0.1", port: 0 })` (puerto efímero).
2. **El token del servidor MCP no se expone al renderer.** Vive solo en el
   proceso main. El renderer **nunca** llama al servidor MCP: el camino del
   chat usa el `ApprovalEngine` del main directamente.
3. **Contrato de obtención para clientes MCP externos:** se documenta en
   `docs/user/` (guía de usuario final) y recomienda una **variable de
   entorno con nombre explícito** (`EGO_MCP_TOKEN`) y, como alternativa, un
   **fichero en el directorio de datos de la app con permisos `0600`**.
   *Tarea abierta y con dueño: la redacción de esa guía es de A1, pero su
   contenido depende de que el owner confirme el canal definitivo.*

### Invariantes de seguridad ###

Estos son **invariantes del diseño**, no notas de implementación. Un cambio que
los rompa es un cambio de decisión, no un refactor.

1. **Solo loopback.** El servidor se enlaza a `127.0.0.1`. Cualquier otra
   interfaz (`0.0.0.0`, `::`, una IP de la LAN) **hace fallar el arranque**:
   `startEgoMcpHttpServer` lanza con el mensaje *"el servidor MCP de Ego solo
   escucha en loopback"* (`apps/desktop/src/main/mcp/mcp-http-server.ts:96-99`).
2. **Bearer token obligatorio, y las peticiones sin token se rechazan ANTES de
   tocar el registry.** La comprobación del `Authorization: Bearer <token>` ocurre
   **antes** de cualquier resolución de tool (`mcp-http-server.ts:134-136`); sin
   token válido la respuesta es **401** y el catálogo no se toca. La comparación
   es de **tiempo constante** (`timingSafeEqual`).
3. **El token se genera al arrancar, se persiste cifrado en el keychain del SO
   y se revoca al cerrar.** 32 bytes aleatorios en `base64url`, guardados bajo
   el servicio `mcp` / cuenta `ego-mcp-server` del `CredentialManager`. **Nunca
   en disco ni en claro en el renderer**, y **nunca en la URL**. `close()`
   revoca el token: si sobreviviera en el keychain, un cliente externo que lo
   hubiera cacheado seguiría autenticando contra un servidor que el usuario
   cree apagado. Con la revocación, el token viejo devuelve **401** y el
   arranque siguiente genera uno nuevo.
4. **El gate HITL es el mismo `ApprovalEngine` del chat y es fail-closed.**
   `tools/call` de una tool que exige aprobación pasa por el gate; **sin gate,
   el `EgoMcpServer` rechaza la llamada**. Un cliente MCP externo no puede
   saltarse la aprobación humana del chat.
5. **El token no se expone al renderer.** El renderer es *untrusted*
   (`AGENTS.md` §4): un token en el renderer es un token en manos de la UI ante
   una XSS. El camino del chat no necesita el servidor MCP: usa el
   `ApprovalEngine` del main directamente.

## Consecuencias ##

- Positivas:
  - Ego cumple **de verdad** `AGENTS.md` §7: el servidor expone el runtime real.
  - El catálogo de tools expuesto es **el mismo** que el del chat, sin copias
    que desincronizar.
  - El gate HITL es **uno**, no dos: la gobernanza no se duplica con el
    canal MCP.
  - El cierre revoca el token: no queda una credencial viva tras apagar la app.
- Negativas:
  - Un cliente MCP externo **necesita obtener el token por un canal fuera de
    banda** (variable de entorno o fichero `0600`). Eso es coste operativo y
    es la razón por la que esa obtaining está **pendiente de owner** y
    documentada como tarea en `docs/user/`.
  - Un servidor HTTP en loopback **ocupa un puerto**: hay que publicar la URL
    (puerto efímero) por otro canal para que un cliente externo la conozca.
  - Loopback **no es un límite de seguridad por sí solo** (cualquier proceso
    local puede conectar): la frontera real es el **token**, y por eso el token
    es obligatorio y se revoca.
- Deuda asumida:
  - **El contrato de obtención del token no está cerrado** → tarea abierta en
    `docs/user/` (documentación de usuario final, no interna).
  - El puerto es efímero (`port: 0`): la URL cambia en cada arranque. Un
    cliente externo necesita descubrirla o fijar un puerto; no está decidido.
- Fuera de alcance: exposición fuera de loopback, TLS, autenticación por
  `mTLS` o por par de claves, y el modo "stdio como proceso hijo".

## Referencias ##

- `packages/integrations/src/mcp/McpServer.ts` — el servidor (`handleRequest`,
  `startStdio`).
- `apps/desktop/src/main/mcp/mcp-server-runtime.ts` — arranque in-proceso, token
  y revocación.
- `apps/desktop/src/main/mcp/mcp-http-server.ts` — transporte HTTP, loopback,
  bearer obligatorio, comparación en tiempo constante.
- `apps/desktop/src/main/mcp/secret-resolver.ts` — resolución de secretos.
- `apps/desktop/src/main.ts` — `before-quit`: cierre del servidor (revoca) →
  `mcpManager.dispose()` → grabación.
- Tests: `packages/integrations/test/mcp-server.test.ts` (11),
  `packages/integrations/test/McpHttp.test.ts` (7),
  `apps/desktop/test/mcp-http-server.test.ts` (9),
  `apps/desktop/test/mcp-server-runtime.test.ts` (5),
  `apps/desktop/test/mcp-server-lifecycle.test.ts` (5),
  `apps/desktop/test/mcp-ipc.test.ts` (7),
  `apps/desktop/test/mcp-secret-resolver.test.ts` (4).
- `AGENTS.md` §4 (renderer untrusted) · §7 (Ego = MCP Client **y** MCP Server).
- `docs/roadmap/Backlog.md` — `EGO-FIND-46`.
- `docs/adr/0011-stab14-asimilados-descartes.md` — mapa de asimilados/descartes.
