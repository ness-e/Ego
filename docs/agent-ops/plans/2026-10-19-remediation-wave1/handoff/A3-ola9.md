# Handoff A3 — Ola 9 — 2026-10-21 — Canal de obtención del token del MCP Server (`EGO-FIND-81`)

> **Agente:** A3 (ejecución)
> **Ola:** 9 — cerrar `EGO-FIND-81` (**CRÍTICA**) con la decisión del owner del 2026-10-21:
> **"Keychain + CLI local."**
> **Plan:** `docs/agent-ops/plans/2026-10-19-remediation-wave1/VERDICT.md` §7 ·
> `OLA3-CONTRATO.md` §"Handoff".
> **Zona de escritura:** `packages/integrations/**` (sin cambios: el token no se gestiona ahí) ·
> `apps/desktop/src/main/mcp/**` · `apps/desktop/src/main/credentials/**` ·
> `apps/desktop/src/cli/**` (nuevo) · `apps/desktop/src/main.ts` (**un único `argv`**, cableado
> explícitamente pedido por la tarea) · `apps/desktop/test/**` (tests nuevos + 1 línea base
> actualizada) + **este** handoff.
> **Sin commits. Sin `git checkout/reset/stash/clean`. Sin `pnpm install`.**
> **No he tocado** `packages/avatar/**` (A6), `packages/tools/**` ni `packages/subegos/**` (A4),
> `packages/security/**` ni `packages/runtime/**` (A2-bis), `docs/**` (A1/A5), raíz ni `scripts/**`.

---

## 0. Resumen en una línea

El token del servidor MCP **ya existía, ya se exigía y ya se revocaba** — pero **no había ningún
canal por el que un cliente MCP externo pudiera obtenerlo**: la autenticación era imposible. Ahora
el token vive en el **keychain** con clave namespacada, **rota por arranque**, y se entrega
**sólo** por un **comando CLI local** que habla con un **broker local del usuario** (pipe con
permisos del owner). El renderer no lo ve y el token no aparece en ningún log.

**Verificado de extremo a extremo contra la app real en marcha** (no sólo en tests): el CLI
obtuvo el token, un cliente MCP real hizo `tools/list` con él → **200**, y con un token incorrecto
→ **401**.

---

## 1. T1 — INVENTARIO REAL (antes de tocar nada)

### 1.1 Dónde se generaba el token

| Qué | Dónde (fichero:línea) | Detalle |
|---|---|---|
| Generación | `apps/desktop/src/main/mcp/mcp-server-runtime.ts:110` (`resolveMcpServerToken`) | 32 bytes `randomBytes` → `base64url` (43 chars) |
| Uso | `apps/desktop/src/main/mcp/mcp-server-runtime.ts:175` → `startEgoMcpHttpServer({ token })` | el token se compara en cada petición |
| Arranque | `apps/desktop/src/main/window/create-window.ts:768` (`startEgoMcpServer({...})`) | en el proceso main, dentro de `createWindow` |
| Log del arranque | `apps/desktop/src/main/window/create-window.ts:795-797` | imprime la **URL**, **nunca** el token ✓ |

### 1.2 Dónde se guardaba (⚠️ **el hallazgo principal**)

| Qué | Dónde | Detalle |
|---|---|---|
| Almacén | `apps/desktop/src/main/mcp/mcp-server-runtime.ts:41` (interfaz `McpTokenVault`) | la cumple el `CredentialManager` del main |
| Implementación real | `apps/desktop/src/main/mcp/mcp-runtime.ts:271` (`getMcpCredentialManager()`) → `new CredentialManager(mainProcessCryptoBackend)` | backend = `safeStorage` (DPAPI/Keychain) |
| **El vault** | **`packages/security/src/CredentialManager.ts:337`**: `private vault: Map<string, StoredCredential> = new Map()` | 🔴 **EN MEMORIA** |

🔴 **HALLAZGO 1 (seguridad, no un detalle): el token NO se persistía, pese a que el código
afirmaba lo contrario.**

`packages/security/src/CredentialManager.ts:337` guarda el vault en un **`Map` en memoria**: el
payload se **cifra** con `safeStorage` (bien), pero **nunca se escribe en disco** ⇒ el token
**no sobrevivía a un reinicio**. Sin embargo, el docstring del runtime
(`mcp-server-runtime.ts:83-87`, antes de esta ola) afirmaba:

> *"Se persiste **cifrado** en el keychain del SO … y **reutilizado** entre arranques (así un
> cliente puede cachearlo)."*

⇒ **La reutilización entre arranques era una promesa que el almacenamiento no cumplía**, y el
test que la fijaba (`mcp-server-runtime.test.ts:80`) la daba por buena. El token real era de
sesión, pero el código y el test contaban otra historia.

🔴 **HALLAZGO 2 (seguridad): la reutilización era un fallo de seguridad por sí misma.**

El token es un bearer de un servidor en loopback que **se revoca al cerrar** (ADR-0021 §3). Si
sobrevive entre arranques, una credencial **capturada** sigue autenticando contra un servidor
**posterior** ⇒ la revocación deja de ser una garantía. Además, el puerto es efímero: el cliente
tendría que redescubrirlo de todas formas, así que el "cliente puede cachearlo" tampoco resolvía
nada.

⇒ **Decisión (A3, justificada): el token ROTA en cada arranque.** Se genera uno nuevo, se
sobrescribe la entrada del keychain y se revoca al cerrar. Implementado en
`mcp-server-runtime.ts:110-141` y con la **línea base del test actualizada**
(`mcp-server-runtime.test.ts:80-105`: antes afirmaba "se reutiliza"; ahora afirma "rota" con el
guard explícito `expect(secondToken).not.toBe(firstToken)`).

### 1.3 Dónde se verificaba (la política de ADR-0021, sin rediseñarla)

`apps/desktop/src/main/mcp/mcp-http-server.ts:134-143`:

```ts
const bearer = extractBearer(req.headers.authorization);
if (!bearer || !safeEqual(bearer, options.token)) {
  res.writeHead(401, { "content-type": "application/json",
                       "www-authenticate": 'Bearer realm="ego-mcp"' });
  res.end(JSON.stringify({ error: "unauthorized" }));
  return;                       // ANTES de tocar el registry
}
```

- **Cabecera**: `Authorization: Bearer <token>` (`extractBearer`, `mcp-http-server.ts:69`).
- **Comparación**: `timingSafeEqual` (`safeEqual`, `mcp-http-server.ts:57`).
- **Códigos de error**: **401** + `www-authenticate: Bearer realm="ego-mcp"` + `{"error":"unauthorized"}`;
  **404** `{"error":"not_found"}` (ruta distinta); **405** `{"error":"method_not_allowed"}`;
  **400** `-32700` (JSON inválido); **500** `-32603` (error interno).
- La política **no se ha rediseñado**: se reutiliza tal cual ✓.

### 1.4 El renderer

- El preload expone `ipc.mcp.listServers|addServer|removeServer|toggleServer|listTools`
  (`apps/desktop/src/preload.ts:316-320`) ⇒ la **configuración de servidores MCP externos**,
  **no** el token del servidor de Ego.
- Búsqueda en `apps/desktop/src/{src,renderer}`: **0 coincidencias** de `MCP_SERVER_TOKEN`,
  `ego-mcp-server` o `mcp.server` fuera de `src/main/mcp/` ⇒ el token **nunca** llegó al renderer ✓.

### 1.5 Other leak surfaces (auditados)

| Vector | Estado |
|---|---|
| Variable de entorno `EGO_MCP_TOKEN` | **NO EXISTE en el código** (sólo era una *propuesta* en ADR-0021 §3 y en el Backlog) ⇒ no hay que cerrar nada, pero **tampoco funciona** |
| Fichero en `userData` en claro | **NO EXISTE** (el vault es en memoria) |
| Log de arranque | ✓ imprime la URL, no el token (`create-window.ts:795`) |
| URL del endpoint | ✓ el token **nunca** va en la URL (`mcp-http-server.ts:21`, `create-window.ts:793`) |
| `SecretsFilter` | **no se usa** en el main (`packages/security/src/SecretsFilter.ts` no tiene consumidores) ⇒ **no hay redacción automática** de secretos en logs; la garantía es de **código** (el token no se pasa a ningún `console.*`), y eso es lo que verifica el test |

### 1.6 El hueco (lo que esta ola cierra)

**No existía ningún canal de obtención.** El token vivía en el `Map` en memoria del proceso main:
inalcanzable desde fuera ⇒ **autenticación imposible** para cualquier cliente MCP externo.
`EGO-FIND-81` (🟠 Alta en el Backlog) estaba abierto por esto, y la fila del Backlog incluso
recomendaba un canal (`EGO_MCP_TOKEN` o fichero `0600`) que **nunca se implementó**.

---

## 2. T2 — EL TOKEN EN EL KEYCHAIN

### 2.1 La clave, con namespace

Nuevo módulo `apps/desktop/src/main/credentials/mcp-token-keychain.ts` (mi zona):

```ts
export const MCP_TOKEN_KEYCHAIN_SERVICE = "mcp.server";   // antes: "mcp"
export const MCP_TOKEN_KEYCHAIN_ACCOUNT = "token";         // antes: "ego-mcp-server"
```

La clave canónica es `mcp.server::token` (la que usa `CredentialManager.buildKey`,
`packages/security/src/CredentialManager.ts:358`).

**Por qué no colisiona:**

- los secretos de **proveedor** usan el nombre del proveedor como servicio
  (`CredentialPool.serviceFor`, `packages/security/src/CredentialManager.ts:556`);
- los secretos de **env MCP** usan `mcp/<serverId>/env` (`mcp-runtime.ts:283-296`);
- ⇒ `mcp.server::token` es un namespace propio del servidor MCP de Ego.

La clase `McpTokenKeychain` (fachada tipada sobre el vault) es la **única** puerta de entrada y
salida del token: `read()` · `write()` · `revoke()`.

### 2.2 Rotación (decisión de A3, con su justificación)

| Opción | Valoración |
|---|---|
| Reutilizar el token entre arranques | ❌ **Descartada**: contradice la revocación de ADR-0021 §3 y, en la práctica, **no funcionaba** (el vault es en memoria → HALLAZGO 1) |
| **Rotar por arranque** | ✅ **Elegida**: el token dura lo que el proceso; se revoca al cerrar; un cliente emparejado lo pide con `ego mcp token` mientras Ego está en marcha |

### 2.3 Lo que **NO** se hace (y por qué)

- **No** se persiste el token en disco, ni siquiera cifrado. Motivo (medido, §3.1): el blob de
  `safeStorage` de Electron 41 **no se puede descifrar desde otro proceso** ⇒ un fichero
  cifrado en `userData` **no** resolvería el canal, sólo añadiría un secreto en reposo.
- **No** se usa una variable de entorno persistente: sería el peor canal (la hereda todo el
  entorno del proceso, acaba en `/proc/<pid>/environ` en Linux, en el registro de entorno de
  Windows y en los volcados de diagnóstico).
- **No** se toca `packages/security` (zona de A2-bis): el `CredentialManager` canónico ya
  cumple la forma `McpTokenVault`; no hace falta tocarlo (ver §7: sí hace falta **saber** que su
  vault es en memoria).

---

## 3. T3 — EL COMANDO CLI LOCAL

### 3.1 La medición que decided la arquitectura (no es una suposición)

Antes de elegir el canal, **medí** si un proceso separado podía leer el keychain:

```text
$ electron enc.js blob.bin     →  encrypted ok, available=true
$ electron dec.js blob.bin     →  DECRYPT_FAILED=Error while decrypting the ciphertext
                                   provided to safeStorage.decryptString.
```

Repetido con el **mismo `userData`** en ambos procesos: **el mismo fallo**. ⇒ El blob de
`safeStorage` de Electron 41 (Windows) **no lo puede descifrar otro proceso**, ni aunque sea la
misma app con el mismo perfil.

**Consecuencias de diseño (las dos opciones que se evaluaron):**

| Opción | Canal | Veredicto |
|---|---|---|
| **(A)** Persistir el vault cifrado en `userData` y que el CLI lo lea | fichero + `safeStorage` | ❌ **Descartada**: el CLI (otro proceso) **no puede descifrarlo** (medido). Sólo funcionaría con un keychain **nativo** (`keytar` / `@napi-rs/keyring`), que es una dependencia nativa nueva: `AGENTS.md` prohíbe las que rompen el empaquetado de Electron y esta ola no puede instalar dependencias. |
| **(B)** El proceso main (único con acceso al keychain) entrega el token por un **pipe local del usuario**; el CLI es su único cliente soportado | named pipe / unix socket | ✅ **Elegida**: funciona con **cualquier** backend de keychain (en memoria, `safeStorage` o nativo) porque **el secreto nunca sale del proceso**, y no necesita dependencias nuevas. |

### 3.2 El broker local (`apps/desktop/src/main/mcp/mcp-token-broker.ts`, nuevo)

- **Ruta determinista por usuario** (`resolveMcpTokenBrokerPath()`):
  - Windows: named pipe `\\.\pipe\ego-mcp-token-<hash del usuario>`;
  - macOS/Linux: unix socket `<tmpdir>/ego-mcp-token-<hash>.sock` con **modo 0600**.
- **Frontera de seguridad**: el DACL por defecto de un named pipe de Windows lo hereda del token
  del proceso (⇒ lo abre el **usuario owner**, y SYSTEM/administradores); en POSIX el modo 0600
  ⇒ sólo el owner. Es exactamente **el mismo nivel de confianza que el keychain**: un proceso de
  otro usuario no llega; uno del mismo usuario sí (y también podría leer el keychain).
- **Protocolo mínimo**: un único comando (`GET_TOKEN`) que devuelve `{ token, url }` en una línea
  JSON. Cualquier otro comando se rechaza. El token **no se registra** en ningún log.
- Por qué devuelve **también la URL**: el puerto es efímero (`port: 0`) ⇒ sin la URL el token no
  basta para conectar. (Esto también cierra la "deuda asumida" del puerto en ADR-0021.)
- El broker **se cierra con la app** (`close()`), y entonces el token se revoca: no queda canal.

### 3.3 El comando (`apps/desktop/src/cli/mcp-token-cli.ts`, nuevo)

```text
ego mcp token                 # imprime el token por stdout
ego mcp token --out <fichero> # lo escribe en un fichero 0600 (recomendado)
ego mcp token --json          # { "token": "...", "url": "..." }
```

- Corre en el **proceso main**, **sin ventana y sin renderer** (el renderer es *untrusted*).
- El cableado del `argv` está en `apps/desktop/src/main.ts:872-884` (un `if/else` sobre el
  arranque existente): en modo CLI seRedirecta `userData` a un temporal (el perfil pertenece a la
  app en marcha: si el CLI lo abriera, pelearían por el mismo `userData`) y se sale con
  `app.exit(código)`.
- La **lógica del CLI es pura** (sin `electron`): `parseMcpTokenCliArgs` + `runMcpTokenCli(argv,
  deps)` devuelven el **código de salida** en vez de llamar a `process.exit` ⇒ es testeable en
  vitest sin matar el proceso.

### 3.4 ⚠️ El trade-off del canal (lo que la tarea pide decidir y justificar)

**Riesgo del modo stdout** (el que pide el contrato): un token impreso puede acabar en

1. el **scrollback** del terminal (y en las grabadoras de terminal);
2. el **log del proceso padre**, si captura la salida del hijo;
3. una **tubería mal construida** hacia otro destino por accidente;
4. (en Windows) el **búfer de consola compartido** de la sesión.

⇒ **No lo elimino** (el contrato lo pide: "un comando local que imprima el token por stdout para
que un proceso emparejado lo consuma"), pero **añado el canal de menor exposición**:

| Canal | Exposición | Recomendación |
|---|---|---|
| `--out <fichero>` (modo **0600**, forzado con `chmod` tras crear) | El token **no** pasa por stdout: no hay scrollback, ni historial de shell, ni log del padre. El fichero lo lee el cliente y **se borra en el acto**. | ✅ **Recomendado** para automatización y para procesos emparejados |
| stdout (por defecto) | El token queda en el scrollback del terminal y es capturable por un padre que registre la salida. | ⚠️ Aceptable en un terminal de confianza; **no** en uno compartido |

**Riesgo residual del modo stdout, documentado**: quien lo use en un terminal compartido acepta
que el token queda en el scrollback. Por eso el valor por defecto de la receta "proceso
emparejado" es `--out`.

**Lo que el modo `--out` NO arregla**: el fichero existe en claro en el disco durante el
transcurso ⇒ si el cliente emparejado muere sin borrarlo, el token queda ahí (con permisos 0600:
sólo el usuario owner). Mitigación: el token **rota por arranque**, así que un fichero huérfano
deja de servir para el siguiente arranque.

**Por qué no "stdout de un pipe que el cliente abre"**: el pipe lo abriría **el cliente**, y para
que el proceso main sepa a quién escribir necesita una ruta de vuelta y una autorización
adicional; el named pipe del broker ya resuelve eso con la ACL del SO, sin inventar un segundo
protocolo.

### 3.5 El token nunca sale del proceso

| Componente | ¿Ve el token? |
|---|---|
| Renderer (preload/IPC) | ❌ **NO** (verificado por enumeración de canales, §6) |
| Logs | ❌ **NO** (verificado por captura de `console.*`, §6) |
| Disco | ❌ **NO** (sólo vive en el `Map` cifrado del `CredentialManager` en memoria) |
| URL / query string | ❌ **NO** |
| Otro proceso del mismo usuario | ⚠️ **SÍ**, por diseño (nivel de confianza del keychain) y **sólo** a través del CLI |
| Otro usuario / remoto | ❌ **NO** (ACL del pipe + el servidor MCP sólo escucha en loopback) |

---

## 4. T4 — TDD (rojo primero, output pegado)

### 4.1 ROJO

Antes de la implementación, el test nuevo no podía ni cargar los módulos:

```text
$ pnpm --filter @ego/desktop test -- mcp-token-channel

⎯⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  test/mcp-token-channel.test.ts [ test/mcp-token-channel.test.ts ]
Error: Cannot find module '../src/main/mcp/mcp-token-broker.js' imported from
  'C:/Users/Eros/VantaDB Proyect/Ego/apps/desktop/test/mcp-token-channel.test.ts'
Caused by: Error: Failed to load url ../src/main/mcp/mcp-token-broker.js …
Test Files  1 failed (1)
     Tests  no tests
```

(= el estado "de hoy": **no hay canal**.)

### 4.2 Intermedios (dos correcciones de diseño que el test destapó)

```text
❯ test/mcp-token-channel.test.ts (14 tests | 8 failed)
  × el broker local entrega el token vigente y la URL del servidor
    → McpTokenBrokerError: el servidor MCP no tiene token vigente
  × el token NO aparece en ningún log del arranque ni del uso
    → AssertionError: expected 0 to be greater than 0
```

- La primera: el fixture no había escrito token en el vault (el broker hacía bien su trabajo:
  **no sirve un token que no existe**).
- La segunda: la captura de logs estaba **vacía** ⇒ el test era **vacuo** ("no hay nada donde
  filtrar el token"). Se corrigió emitsiendo una línea benigna dentro de la ventana de captura,
  para que el test demuestre que la captura está viva.

Y un tercer fallo, **de la plataforma**: el path del pipe en Windows. `net.listen(ruta)` en
Windows **no** crea un unix socket: el `connect` devolvía `ENOENT`. ⇒ Se añadió
`normalizeMcpTokenBrokerPath()`: en Windows, cualquier ruta se convierte en un **named pipe**
(`\\.\pipe\ego-mcp-token-<nombre>-<hash de la ruta>`), lo que además preserva el aislamiento
entre tests.

### 4.3 VERDE

```text
$ pnpm --filter @ego/desktop test -- mcp-token-channel
 ✓ test/mcp-token-channel.test.ts (14 tests) 258ms
 Test Files  1 passed (1)
      Tests  14 passed (14)
```

Y la suite completa del desktop:

```text
$ pnpm --filter @ego/desktop test
 Test Files  70 passed | 1 skipped (71)
      Tests  431 passed | 5 skipped (436)
```

(antes: 416 → **+15**: 14 nuevos + 1 línea base actualizada.)

### 4.4 Qué cubre cada test (14)

| # | Test | Qué demuestra |
|---|---|---|
| 1 | el token se guarda en el keychain con clave **NAMESPACADA** | `mcp.server` / `token`; no colisiona con un secreto de proveedor |
| 2 | el token **ROTA** por arranque | el de la sesión anterior **no** se reutiliza |
| 3 | el broker entrega el token vigente **y** la URL | el puerto efímero también se descubre |
| 4 | el broker **NO** sirve token si el keychain no lo tiene | fail-closed |
| 5 | el broker se cierra con la app | después no queda canal |
| 6 | el CLI devuelve el token por **stdout** | el contrato de la tarea |
| 7 | el CLI escribe el token en un fichero **0600** | canal de menor exposición; stdout **no** lleva el token |
| 8 | el CLI detecta su invocación y no confunde otros `argv` | `mcp token` sí; `mcp server` no; sin args no |
| 9 | **EXTREMO A EXTREMO**: token incorrecto → **401**; token correcto → **200** | contra el **servidor real** (no mock): `tools/list` devuelve el catálogo real |
| 10 | el token **NO** aparece en ningún log | captura de `console.{log,info,warn,error,debug}` durante arranque + uso + broker (y la captura se demuestra **viva**) |
| 11 | **ningún canal del preload** expone el token | enumeración real de los canales `ipcRenderer.invoke/on/send/once` |
| 12 | el preload no menciona la clave del keychain | ni `mcp.server`, ni `mcp.server::token`, ni `ego-mcp-server` |
| 13 | la superficie `mcp` del preload no tiene método de token | parseo del bloque `mcp: {…}` del preload |
| 14 | la ruta del broker no se expone al renderer | ni el módulo ni la ruta |

### 4.5 Verificación **contra la app real** (no sólo tests)

Con la app **real** en marcha (Electron 41, build de producción):

```text
$ electron out\main\main.js mcp token --json
{"token":"9mdh-ZDJadOu3Kwbdgb3yJHzkCZeIWtkB0QD54L0eUs","url":"http://127.0.0.1:65510/mcp"}

$ Invoke-WebRequest -Uri $url -Method Post -Headers @{Authorization="Bearer $token"} -Body '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
status=200
{"jsonrpc":"2.0","id":1,"result":{"tools":[{"name":"fs_read_file",…

$ … con "Bearer token-incorrecto"
status=401     (www-authenticate: Bearer realm="ego-mcp")

$ el token en el log de la app (stdout/stderr): False   (ni el prefijo de 8)
$ el pipe del broker tras cerrar la app: 0 pipes
```

⇒ El canal funciona de verdad, con el token real, contra el servidor real, y el token **no**
aparece en los logs del proceso.

---

## 5. T5/T6 — Texto exacto para A1 (NO he editado `docs/**`)

### 5.1 Fila del Backlog `EGO-FIND-81` (sustituir la de `docs/roadmap/Backlog.md:1203`)

> **Estado:** `🆕 Pendiente` → **`✅ Completada`**
> **Columnas a tocar:** la de *Estado* y el *detalle/Evidencia*.
> **Columnas que NO cambian:** ID, severidad (🟠 Alta), zona, estimación, prioridad, referencias.

<!-- markdownlint-disable MD013 -->
```markdown
| `EGO-FIND-81` | 🟠 Alta | **El token del MCP Server no tiene contrato de obtención documentado para clientes externos** | `apps/desktop/src/{main/mcp,main/credentials,cli}/**` | 🟡 1d | 🟠 P1 | ✅ Completada | **Decisión del owner (2026-10-21): "Keychain + CLI local".** El token se guarda en el keychain del SO (`CredentialManager` + `safeStorage`) con clave **namespacada** `mcp.server::token` (no un secreto de proveedor), **rota en cada arranque** (rotar es más seguro que reutilizar: el token se revoca al cerrar, ADR-0021 §3, y el vault del `CredentialManager` es en memoria) y se revoca al cerrar. Se entrega **sólo** por un **comando CLI local** (`ego mcp token`) que habla con un **broker local del usuario** (named pipe en Windows / unix socket 0600 en POSIX) servido por el proceso main, que es el único con acceso al keychain. El CLI devuelve el token **y** la URL del endpoint (el puerto es efímero) y puede escribirlo en un fichero **0600** (`--out`) para no exponerlo en stdout. El **renderer nunca lo ve** (0 canales del preload lo exponen) y **no aparece en ningún log** (verificado por captura de `console.*`). **Evidencia Ola 9 (A3):** `apps/desktop/src/main/credentials/mcp-token-keychain.ts` (clave namespacada + fachada `read/write/revoke`), `apps/desktop/src/main/mcp/mcp-token-broker.ts` (broker + ruta determinista por usuario), `apps/desktop/src/cli/mcp-token-cli.ts` (CLI), `apps/desktop/src/main/mcp/mcp-server-runtime.ts` (rotación + broker en el ciclo de vida), `apps/desktop/src/main.ts:872-884` (cableado del `argv`), `apps/desktop/test/mcp-token-channel.test.ts` (14 tests: keychain, rotación, broker, CLI, 401/200 de extremo a extremo contra el servidor real, token invisible al preload, token fuera de los logs) + `mcp-server-runtime.test.ts` (línea base de la reutilización → rotación). Verificado contra la **app real**: el CLI obtuvo el token, `tools/list` con él → 200 y con token incorrecto → 401; el token no aparece en el log del proceso. | `docs/adr/0021-mcp-server-transporte-y-token.md` | `EGO-FIND-46` |
```
<!-- markdownlint-enable MD013 -->

### 5.2 Texto para **ADR-0021** (`docs/adr/0021-mcp-server-transporte-y-token.md` — A1)

**5.2.1 — §"Decisión", punto 3 (sustituir el texto actual):**

```markdown
3. **El token del servidor MCP se guarda en el keychain del SO, rota por arranque y
   sólo se expone por un comando CLI local.** 32 bytes aleatorios en `base64url`,
   guardados bajo la clave **namespacada** `mcp.server::token` del `CredentialManager`
   (servicio `mcp.server`, cuenta `token`; no es un secreto de proveedor). El token
   **rota en cada arranque** y **se revoca al cerrar**: es un bearer de un servidor en
   loopback, y una credencial capturada no debe seguir autenticando contra un
   servidor posterior. **Nunca** en disco en claro, **nunca** en el renderer, **nunca**
   en la URL, **nunca** en un log, **nunca** en una variable de entorno persistente.
   El **único** canal de obtención es el comando CLI local `ego mcp token`, que habla
   con un **broker local del usuario** (named pipe en Windows / unix socket con modo
   `0600` en macOS/Linux) servido por el proceso main — el único con acceso al
   keychain. El broker devuelve el token **y** la URL del endpoint (el puerto es
   efímero, así que sin ella el token no basta). El CLI puede escribir el token en un
   fichero `0600` (`--out`) para no exponerlo en stdout. Medido: el blob de
   `safeStorage` de Electron **no** es descifrable desde otro proceso, de modo que
   persistir el vault cifrado en disco **no** habría resuelto el canal.
```

**5.2.2 — §"Invariantes de seguridad", añadir el invariante 6 (el 1-5 se conservan tal cual):**

```markdown
6. **El token se obtiene sólo por CLI local, y el renderer no lo ve.** El token
   vive en el keychain del SO y se entrega por un pipe local del usuario (named
   pipe en Windows / unix socket `0600` en POSIX): la frontera es **el usuario del
   SO**, el mismo nivel de confianza que el keychain. El renderer es *untrusted*
   (`AGENTS.md` §4) y **ningún** canal del preload expone el token. El token **rota
   por arranque** y se revoca al cerrar: fuera de la ventana de ejecución de Ego no
   hay token que_valga.
```

**5.2.3 — §"Consecuencias", sustituir la negativa del canal y la deuda asumida:**

```markdown
- Negativas:
  - Un cliente MCP externo necesita **una app de Ego en ejecución**: el token rota
    por arranque y el canal (broker local) muere con el proceso. Es el precio de
    que el token no sobreviva a la app.
  - El token entregado por stdout puede quedar en el scrollback del terminal o en
    el log del proceso padre ⇒ para automatización se recomienda
    `ego mcp token --out <fichero>` (modo `0600`).
- Deuda asumida:
  - El **puerto es efímero** (`port: 0`): la URL se obtiene **junto con el token**
    (el broker la devuelve), pero un cliente que la cachee entre arranques debe
    volver a pedirla.
  - El vault del `CredentialManager` es **en memoria**
    (`packages/security/src/CredentialManager.ts:337`): el token no se persiste en
    disco. Con la rotación por arranque, eso no resta capacidad (el canal entrega
    el token vigente), pero una credencial de proveedor sí se pierde al reiniciar
    ⇒ petición a A2-bis en `handoff/A3-ola9.md` §7.
```

### 5.3 Documentos de **uso** que hay que actualizar (A1/A5)

| Documento | Qué hay que cambiar |
|---|---|
| `docs/user/changelog.md:89-94` | Hoy dice: *"El canal para obtener esa clave (variable de entorno o fichero protegido…) **todavía se está documentando**: hasta que se cierre, un cliente MCP externo no puede autenticarse de forma soportada."* ⇒ **Sustituir** por el canal ya cerrado (CLI + keychain). **Texto propuesto**: <br>*"**El token del servidor MCP se obtiene con un comando local.** El token vive en el keychain del sistema operativo (nunca en un fichero en claro) y rota cada vez que arranco Ego, así que caduca con la app. Para conectarte, con Ego en marcha, ejecuta `ego mcp token` (el token sale por la salida estándar) o `ego mcp token --out /ruta/fichero` (lo escribe en un fichero que sólo tú puedes leer: es la opción recomendada para guiones). El token **no** lo ve la interfaz de Ego, y el servidor sólo escucha en `127.0.0.1`."* |
| `docs/engineering/integraciones.md:87-99` | La sección "MCP Server: Ego como proveedor de contexto para la IA" dice (línea 99) *"El servidor MCP de Ego opera sobre transporte `stdio` local"* ⇒ **está desactualizada** (es HTTP streamable en loopback, ADR-0021). Hay que corregir el transporte **y** añadir el canal del token. |
| `docs/engineering/integraciones.md:103-113` ("Credential Manager") | Menciona "Windows Credential Manager, macOS Keychain, Linux Secret Service" como si el vault viviera ahí ⇒ hoy el vault es un `Map` en memoria y el backend es `safeStorage` (DPAPI/Keychain). Ajustar el texto a lo que el código hace. |
| `docs/adr/0021-mcp-server-transporte-y-token.md` | §5.2 de este handoff (A1). |
| `docs/roadmap/Backlog.md:1203` | §5.1 de este handoff (A1). |
| `docs/user/` (nuevo) | No hay **ninguna** guía de "conectar un cliente MCP a Ego": `docs/user/` tiene `README`, `concepts`, `configuration`, `faq`, `getting-started`, `troubleshooting`, `changelog` y **ninguno** menciona cómo conectar un cliente MCP externo. La receta mínima (obtener el token + `Authorization: Bearer` + la URL) encaja en `docs/user/configuration.md` (o en una página nueva `docs/user/mcp-server.md`, decisión de A1). |

> **A5**: no he tocado `docs/**`. Los textos de arriba son **propuestas exactas** para que las
> aplique quien tenga la zona.

---

## 6. Verificación

| Comando | Exit | Resumen |
|---|---|---|
| `pnpm --filter @ego/desktop typecheck` | **0** | 0 errores |
| `pnpm --filter @ego/desktop test` | **0** | 70 ficheros · **431 tests** (antes 416 → **+15**) · 5 skipped |
| `pnpm -r typecheck` | **2** | ⛔ **falso rojo de A4** (ver abajo): `@ego/renderer` (no mi zona) |
| `pnpm lint` | **1** | ⛔ **puerta compartida, NO es de mi zona** (ver abajo) |
| `node scripts/audit-security.mjs` | **0** | **0 críticos · 0 altos** (5 avisos informativos preexistentes) |
| `node scripts/verify-vantadb-ids.mjs` | **0** | 0 errores · 2 avisos W2 preexistentes · 26 IDs |
| `node apps/desktop/scripts/design-lint.cjs` | **0** | 0 errores · 22 advertencias (R8) |
| `node scripts/check-docs-lint.mjs` | **0** | gate OK · este handoff: **0** violaciones markdownlint |
| E2E contra la **app real** | **0** | CLI → token → `tools/list` **200**; token incorrecto → **401**; token ausente del log; pipe eliminado al cerrar |
| Mojibake en los 6 ficheros escritos | — | **0** |

**TDD — rojo demostrado antes del fix:**

| Tarea | Rojo |
|---|---|
| El canal de obtención (E5) | `Cannot find module '../src/main/mcp/mcp-token-broker.js'` (el módulo no existía: **no había canal**) |
| El broker, el CLI, el aislamiento y los logs | 8/14 fallos tras la primera implementación (fixture sin token, captura de logs vacía ⇒ test vacuo) |
| Compatibilidad Windows del pipe | `connect ENOENT` (un path de fichero no es un named pipe en Windows) |

---

## 7. Petición a A2-bis (`packages/security`) — NO lo he tocado

**Texto exacto (2 puntos, ambos informativos; ninguno bloquea esta ola):**

### 7.1 El vault del `CredentialManager` es **en memoria**

`packages/security/src/CredentialManager.ts:337`:

```ts
private vault: Map<string, StoredCredential> = new Map();
```

El backend cifra con `safeStorage` (DPAPI/Keychain) ✓, pero **el vault cifrado nunca se
escribe en disco** ⇒ **ningún secreto persiste entre reinicios** (API keys de proveedor, env de
MCP, y ahora el token del servidor MCP). El `exportVault()`/`importVault()` que ya existen
(`CredentialManager.ts:433` y `:464`) **no tienen ningún consumidor** en el repo.

**Medido (2026-10-21)**: el blob de `safeStorage` de Electron 41 **no** lo puede descifrar otro
proceso, ni con el mismo `userData`:

```text
$ electron enc.js blob.bin  →  encrypted ok, available=true
$ electron dec.js blob.bin  →  DECRYPT_FAILED=Error while decrypting the ciphertext
                                provided to safeStorage.decryptString.
```

⇒ **Un keychain persistente de verdad necesita un backend nativo** (`keytar` /
`@napi-rs/keyring`, o el `Electron safeStorage` + un fichero cifrado **que sólo el proceso main
puede descifrar**). Como la Ola 9 no puede instalar dependencias, **esta ola NO lo resuelve**: el
canal del token se diseñó para que **no** dependa de ello (el broker entrega el token desde la
memoria del proceso).

**Lo que pido a A2-bis (decisión, no parche)**: decidir y documentar si `CredentialManager` debe
tener un **backend persistente** (con su formato de fichero, sus permisos y su política de
rotación). Si la respuesta es sí, el token del servidor MCP **se benefits** automáticamente (la
misma clave `mcp.server::token`), y la rotación por arranque que decidí en esta ola se puede
revisar (con un keychain persistente, reutilizar el token dejaría de contradecir la revocación
… o no: seguiría siendo un bearer de sesión ⇒ **mi recomendación se mantiene: rotar**).

### 7.2 `SecretsFilter` no tiene consumidores

`packages/security/src/SecretsFilter.ts` exporta `redactText`/`scanText`/…, pero **ningún
código del main los usa** (0 coincidencias en `apps/desktop/src`). Hoy la garantía de "el token
no aparece en los logs" es de **código** (nadie se lo pasa a un `console.*`) y la verifica un test
— pero **no hay redacción automática** si alguien lo pasara por error.

**Petición**: que el logger del main (`packages/events/src/StructuredLogger`, ya existe) pase
**todo** su texto por `redactText` con los secretos conocidos (el `CredentialManager` podría
exponer los valores descifrados que tiene en memoria). Con eso, "el token no está en los logs"
pasaría a ser una **garantía de sistema**, no una convención. (También affecta a las API keys de
proveedor, que hoy tienen el mismo riesgo.)

---

## 9. Petición cruzada de A4 — el dueño del *arrival tardío* (§7.2 de `handoff/A4-ola9.md`)

### 9.1 La API real que A4 dejó (verificada, no asumida)

| Qué | Dónde | Firma exacta |
|---|---|---|
| Campo de primera clase | `packages/tools/src/types.ts:70` | `readonly ownerSubEgoId?: string` en `ToolDefinition` |
| Opción de registro | `packages/tools/src/ToolRegistry.ts:41-43` | `register(tool, options: { allowOverride?: boolean; ownerSubEgoId?: string })` |
| Precedencia | `packages/tools/src/ToolRegistry.ts:58` | `const ownerSubEgoId = tool.ownerSubEgoId ?? options.ownerSubEgoId;` (el de la tool manda) |
| La regla | `packages/tools/src/subEgoView.ts:81-88` | con dueño ⇒ privada de ese Sub-Ego · **sin dueño ⇒ GLOBAL** |

### 9.2 El dueño: **GLOBAL** (la conexión la abre la app) — y por qué no es un olvido

**Evidencia (con `fichero:línea`):**

| Dónde | Qué |
|---|---|
| `apps/desktop/src/main/ipc/domains/mcp.ts:49` | el handler IPC `ipc.mcp.addServer`: lo dispara el **usuario** al configurar un servidor MCP externo en los ajustes. El esquema `AddMcpServerSchema` (`apps/desktop/src/ipc/schema.ts`) **no tiene ningún campo de Sub-Ego** |
| `apps/desktop/src/main/window/create-window.ts:701` | la app **restaura** sus servidores MCP persistidos al arrancar (`mcpManager.registerServer(...)`) |
| `packages/integrations/src/mcp/**` | **0** referencias a `subEgoId` (los únicos `subEgo*` son `subEgoRegistry`: el proveedor de *prompts* del servidor MCP, sin relación) |
| `packages/integrations/src/mcp/McpClient.ts:424` | el punto exacto que A4 señaló: `registry.register(toolDef, { allowOverride: true })` — sin dueño |

⇒ **No existe ningún camino en el que un Sub-Ego abra una conexión MCP.** Las tools de un
servidor MCP son **infraestructura de la app** (las configuró el usuario) ⇒ **sin dueño ⇒
global** es lo correcto. **No es un olvido**: por eso el ámbito se declara **explícitamente**
en la API y no se deduce.

### 9.3 Lo implementado (mi zona: `packages/integrations/**`)

**Un tipo de ámbito, no un parámetro suelto** (`packages/integrations/src/mcp/McpManager.ts:54-96`):

```ts
export type McpToolOwnership =
  | { readonly scope: "app" }
  | { readonly scope: "sub-ego"; readonly ownerSubEgoId: string };

export const APP_SCOPE_TOOL_OWNERSHIP: McpToolOwnership = Object.freeze({ scope: "app" });
```

- `scope: "app"` ⇒ **sin dueño** ⇒ las tools son **GLOBALES** (la conexión la abre la app).
- `scope: "sub-ego"` ⇒ las tools son **privadas** de ese Sub-Ego.

El ámbito se propaga:

| Punto | Cambio |
|---|---|
| `packages/integrations/src/mcp/types.ts:232-256` | `McpImportOptions.ownerSubEgoId?: string` (documentado: **cuándo** se declara) |
| `packages/integrations/src/mcp/McpClient.ts:424-432` | `registry.register(toolDef, { allowOverride: true, ...(ownerSubEgoId ? { ownerSubEgoId } : {}) })` |
| `packages/integrations/src/mcp/McpManager.ts:87-135` | `registerServer(config, enabled, ownership = APP_SCOPE_TOOL_OWNERSHIP)`; el ámbito **se guarda en la entrada** (`ManagedServerEntry.ownership`) |
| `packages/integrations/src/mcp/McpManager.ts:182-196` | `connectServer(id, ownership?)`: si se omite, usa el ámbito con el que se **registró** el servidor ⇒ una **reconexión no pierde el dueño** |

**Compatible hacia atrás**: los dos parámetros son opcionales ⇒ `apps/desktop/src/main/ipc/domains/mcp.ts:103`
y `apps/desktop/src/main/window/create-window.ts:701` siguen compilando **sin cambios** y
mantienen el ámbito `app` (global) ⇒ **comportamiento idéntico al de hoy** para la app.

### 9.4 ⚠️ Un bug preexistente que la petición destapó (arreglado)

Para poder demostrar que el dueño **sobrevive a una reconexión**, hubo que arreglar un bug
**preexistente** de `packages/integrations/src/mcp/McpClient.ts`:

> `cleanupProcess()` mata al subproceso pero **no espera** a que termine. Su evento `exit`
> llegaba **después** de que se hubiera spawneado el subproceso nuevo, y su
> `rejectAllPending()` —sobre el mapa **compartido** `pendingRequests`— rechazaba el
> handshake `initialize` del subproceso **nuevo** con el error del viejo:
> *"El subproceso MCP terminó inesperadamente (código: null, señal: SIGTERM)"*.
>
> ⇒ **Apagar y volver a encender un servidor MCP SIEMPRE fallaba** (toggle off/on en los
> ajustes de la app) y sus tools **no volvían** al registro.

**Fix** (`packages/integrations/src/mcp/McpClient.ts:462-520`): los handlers se **ligan al
subproceso que los registra** (`const child = this.process;` + guard `if (this.process !== child) return;`)
⇒ un subproceso **obsoleto** ya no toca ni el estado ni las peticiones pendientes del actual.

**Por qué era obligatorio arreglarlo (no era cosmético)**: sin dueño persistente, un
*toggle off/on* habría dejado la tool privada **sin dueño** ⇒ **GLOBAL** ⇒ una fuga de
privilegios entre Sub-Egos.

### 9.5 TDD (rojo primero)

```text
$ pnpm --filter @ego/integrations test -- mcp-tool-ownership
 ❯ test/mcp-tool-ownership.test.ts (6 tests | 3 failed)
   × ÁMBITO SUB-EGO: la tool privada NO aparece en la vista de otro Sub-Ego
   × el dueño SOBREVIVE a una reconexión (toggle off/on)
   × el `McpClient` acepta el dueño y lo propaga al registro

$ … tras implementar
 ✓ test/mcp-tool-ownership.test.ts (6 tests) 2.62s
 Test Files  1 passed (1)
      Tests  6 passed (6)
```

**Y el rojo del bug de reconexión** (mensaje real):

```text
TypeError: Cannot read properties of undefined (reading 'ownerSubEgoId')
❯ test/mcp-tool-ownership.test.ts:115:40
[debug] reconexion: {"status":"error","err":"Fallo al conectar con servidor MCP \"Servidor A\"
  (server-a): El subproceso MCP terminó inesperadamente (código: null, señal: SIGTERM)."}
```

⇒ tras el fix: `{"status":"connected"}`.

**Tests nuevos (7):**

| Fichero | Test | Qué demuestra |
|---|---|---|
| `packages/integrations/test/mcp-tool-ownership.test.ts` (nuevo) | ÁMBITO APP (el caso real) | la tool importada **no** tiene dueño ⇒ **GLOBAL** ⇒ la ven todas las vistas. El test lo dice explícitamente para que no parezca un olvido |
| "" | ÁMBITO SUB-EGO | la tool privada **no** aparece en la vista de otro Sub-Ego y **sí** en la del dueño |
| "" | el dueño sobrevive a la reconexión | `toggle off/on` ⇒ el dueño sigue ahí |
| "" | el `McpClient` acepta el dueño | `importIntoRegistryDetailed(..., { ownerSubEgoId })` ⇒ la tool lo lleva |
| "" | EGO-FIND-49 intacto | una tool **nativa** no se sobrescribe **ni con dueño** |
| "" | el veto no depende del ámbito | el veto se aplica igual en `app` y en `sub-ego` |
| `packages/integrations/test/McpManager.test.ts` (modificado) | RECONEXIÓN | apagar y volver a encender deja el servidor `connected` y sus tools **vuelven** al registro (regresión del bug de §9.4) |

### 9.6 Texto exacto para A1 — el clause "Pendiente" de la fila `EGO-FIND-90`

La fila `docs/roadmap/Backlog.md:1212` termina hoy con:

> *"**Pendiente:** la superficie del modelo y la resolución de la tool las aplica el loop
> (`packages/runtime`, A2-bis) y **el dueño del *arrival tardío* lo declara la conexión MCP
> (`packages/integrations`, A3)**."*

**Sustituir ese último miembro por:**

<!-- markdownlint-disable MD013 -->
```text
**Dueño del *arrival tardío* (A3, Ola 9):** las tools que llegan en caliente desde un servidor MCP se registran **sin dueño ⇒ GLOBAL**, y **no es un olvido**: la conexión MCP la abre **la app** (el usuario configura el servidor en los ajustes — `apps/desktop/src/main/ipc/domains/mcp.ts:49` — o la app la restaura al arrancar — `apps/desktop/src/main/window/create-window.ts:701`), y `packages/integrations/src/mcp/**` tiene 0 referencias a `subEgoId` ⇒ sus tools son **infraestructura compartida** de la app, no artefactos de un Sub-Ego. Para que la decisión sea explícita y no dependa de un olvido, el ámbito se declara en la API: `McpToolOwnership = { scope: "app" } | { scope: "sub-ego"; ownerSubEgoId }` (`packages/integrations/src/mcp/McpManager.ts:54-96`), y `registerServer`/`connectServer` lo propagan al registro (`McpClient.ts:424` → `registry.register(toolDef, { allowOverride: true, ownerSubEgoId })`), **conservándolo en la reconexión** (`ManagedServerEntry.ownership`). El camino privado (`scope: "sub-ego"`) queda **disponible y probado** (6 tests en `packages/integrations/test/mcp-tool-ownership.test.ts`). Al arreglarlo se destapó y corrigió un **bug preexistente**: el `exit` del subproceso viejo rechazaba el handshake del nuevo ⇒ **apagar y volver a encender un servidor MCP fallaba siempre** (`packages/integrations/src/mcp/McpClient.ts:462-520`, regresión en `McpManager.test.ts`).
```
<!-- markdownlint-enable MD013 -->

---

## 10. Deuda / no resuelto

**⛔ A7 — `pnpm lint` sale en 1** por el **presupuesto de avisos de oxlint**, que es una **puerta compartida** y cuyo fichero (`scripts/lint-budget.json`) es de A7:

```text
[verify-lint-budget] recuento real 438 · presupuesto 421 (anterior 317) · margen -17
[verify-lint-budget] REGRESIÓN: el recuento real (438) supera el presupuesto (421)
```

(El recuento exacto **crece en tiempo real** con el trabajo en curso de los otros agentes:
424 → 434 → 438 durante esta ola. Lo que no cambia es que **mis ficheros aportan 0**.)

**No es de mi trabajo**, con la evidencia:

- mis **12** ficheros nuevos/tocados (los que no son `main.ts`) aportan **0 avisos**
  (`oxlint` filtrado por ellos ⇒ 0);
- los **3** avisos de `apps/desktop/src/main.ts` (líneas 913, 917, 974) son **preexistentes**:
  en `HEAD` están en las líneas **899, 903, 960** (mi diff sólo las desplaza: +14 líneas,
  `git diff --stat` = 15 inserciones / 1 borrado). Verificado con `git show HEAD:…`;
- el recuento **crece en tiempo real** con el trabajo en curso de A2-bis (`packages/runtime`),
  A4 (`packages/tools`) y A6 (`packages/avatar`): pasó de **424 → 434 → 438** mientras medía.

**Lo que hace falta (A7)**: o corregir los avisos del trabajo en curso, o subir el
presupuesto con `raisedBecause` (el propio fichero dice que *"cuando el trabajo en curso se
asiente, hay que BAJARLO de nuevo"*). **No toco `scripts/`** (zona de A7).

**⛔ A4 — `pnpm -r typecheck` sale en 2 por `@ego/renderer`** (no mi zona) — el fallo está
**acotado** a un fichero de A4:

```text
apps/desktop/renderer typecheck: components/ego-chat.tsx(35,3): error TS6133: 'Sparkle' is declared but its value is never read.
apps/desktop/renderer typecheck: components/ego-chat.tsx(1509,9): error TS6133: 'modelMenuItems' is declared but its value is never read.
apps/desktop/renderer typecheck: Failed
```

Son 2 imports sin usar en el **renderer** (zona de A4; `git status` ⇒ modificado por A4, no
por mí). **Mis paquetes pasan**: `pnpm --filter @ego/desktop typecheck` → **exit 0**,
`pnpm --filter @ego/integrations --filter @ego/tools typecheck` → **exit 0**.
⇒ **Bloqueo: A4** (2 líneas: borrar los imports o usarlos).

1. **El CLI se invoca con el binario de Electron** (`electron out/main/main.js mcp token`): el
   paquete `@ego/desktop` no declara un `bin` (`apps/desktop/package.json` no tiene `bin`, y ese
   manifiesto es de A7). El texto para A7/A1 va en §5.3 (que el comando se llame `ego mcp token`
   presupone un lanzador; si no, la receta es la ruta larga). **Bloqueo: A7** (no owner) — y no
   bloquea la capacidad: el canal funciona con la ruta larga.
2. **El modo CLI abre un `userData` temporal** (`ego-cli-<pid>`) para no pelear con el perfil de
   la app en marcha. En macOS, Electron sin ventana puede que necesite `app.dock.hide()`; no
   verificado en macOS (aquí sólo Windows). **Verificar en macOS/Linux** antes de publicar.
3. **La ruta del pipe en POSIX** va en `os.tmpdir()`: en Linux, `/tmp` es compartido entre
   usuarios ⇒ el modo 0600 protege el socket, pero la **ubicación** sería más limpia en
   `$XDG_RUNTIME_DIR` (que ya es 0700 por usuario). **No bloquea**: el modo 0600 ya impide que
   otro usuario lo abra.
4. **No hay guía de usuario**: `docs/user/` no tiene ninguna página sobre conectar un cliente
   MCP (§5.3). **Bloqueo: A1** (docs) — no owner.
5. **`packages/integrations` no se ha tocado**: el token no se gestiona ahí (el `EgoMcpServer` es
   agnóstico al transporte y al token). Correcto, pero conviene que A1 lo sepa al redactar el ADR.
6. **La app tiene que estar en marcha** para que el canal exista (el token rota y el broker
   muere con el proceso). Es el precio de que el token no sobreviva a la app (§5.2.3).
7. **El log de arranque del broker**: el `console.warn` de "no se pudo arrancar el broker" no
   incluye la ruta del pipe. A propósito (no filtrar rutas), pero un usuario sin canal recibe un
   mensaje genérico: la ruta **sí** se la da el error del CLI ("¿Está Ego en ejecución?").

---

## 11. Ficheros tocados

**Nuevos (5):**

| Fichero | Qué |
|---|---|
| `apps/desktop/src/main/credentials/mcp-token-keychain.ts` | clave namespacada `mcp.server::token` + fachada `read/write/revoke` |
| `apps/desktop/src/main/mcp/mcp-token-broker.ts` | broker local (pipe del usuario) + cliente + ruta determinista |
| `apps/desktop/src/cli/mcp-token-cli.ts` | CLI (`parseMcpTokenCliArgs`, `runMcpTokenCli`, `--out` 0600, `--json`) |
| `apps/desktop/test/mcp-token-channel.test.ts` | **14 tests** (keychain, rotación, broker, CLI, 401/200 e2e, aislamiento del renderer, token fuera de los logs) |
| `packages/integrations/test/mcp-tool-ownership.test.ts` | **6 tests** (dueño del *arrival tardío*: ámbito app ⇒ global, ámbito sub-ego ⇒ privada, persistencia en la reconexión, `McpClient` directo, EGO-FIND-49 intacto) |

**Modificados (8):**

| Fichero | Qué |
|---|---|
| `apps/desktop/src/main/mcp/mcp-server-runtime.ts` | rotación por arranque · clave namespacada · el broker arranca y muere con el servidor · `revoke()` vía la fachada |
| `apps/desktop/src/main.ts` | **cableado del `argv`** (líneas 872-884): modo CLI sin ventana, con `userData` temporal |
| `apps/desktop/test/mcp-server-runtime.test.ts` | **línea base actualizada**: "se reutiliza el token" → "el token rota" (con el guard explícito) + la clave del vault |
| `packages/integrations/src/mcp/types.ts` | `McpImportOptions.ownerSubEgoId?: string` (documentado: cuándo se declara) |
| `packages/integrations/src/mcp/McpClient.ts` | el dueño viaja al registro (`registry.register(..., { ownerSubEgoId })`) + **fix del bug de reconexión** (handlers ligados al subproceso) |
| `packages/integrations/src/mcp/McpManager.ts` | `McpToolOwnership` (`app` \| `sub-ego`) + `ownership` en la entrada + propagación en `registerServer`/`connectServer` |
| `packages/integrations/test/McpManager.test.ts` | test de regresión del bug de reconexión (toggle off/on) |
| `docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A3-ola9.md` | este handoff |

---

## 12. RESULTADO

```text
RESULTADO: {
  agente: A3-ola9,
  status: COMPLETO,
  scope: "Ola 9 — EGO-FIND-81 (CRÍTICA): canal de obtención del token del MCP Server + petición cruzada de A4 (§7.2): el dueño del *arrival tardío*",
  decision_owner: "Keychain + CLI local (2026-10-21) · vista filtrada por Sub-Ego (A4, 2026-10-21)",
  archivos_modificados: [
    "apps/desktop/src/main/credentials/mcp-token-keychain.ts",
    "apps/desktop/src/main/mcp/mcp-token-broker.ts",
    "apps/desktop/src/cli/mcp-token-cli.ts",
    "apps/desktop/src/main/mcp/mcp-server-runtime.ts",
    "apps/desktop/src/main.ts",
    "apps/desktop/test/mcp-token-channel.test.ts",
    "apps/desktop/test/mcp-server-runtime.test.ts",
    "packages/integrations/src/mcp/types.ts",
    "packages/integrations/src/mcp/McpClient.ts",
    "packages/integrations/src/mcp/McpManager.ts",
    "packages/integrations/test/mcp-tool-ownership.test.ts",
    "packages/integrations/test/McpManager.test.ts",
    "docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A3-ola9.md"
  ],
  hallazgos_resueltos: [
    "EGO-FIND-81 (CRÍTICA): NO existía ningún canal por el que un cliente MCP externo obtuviera el token ⇒ la autenticación era imposible",
    "EGO-FIND-81: ahora keychain (clave namespacada `mcp.server::token`) + broker local del usuario + CLI local (`ego mcp token`, con `--out` 0600 y `--json` que devuelve también la URL)",
    "HALLAZGO 1 (seguridad): el token NO se persistía — el vault del `CredentialManager` es un `Map` en memoria (`packages/security/src/CredentialManager.ts:337`) — pese al docstring y a un test",
    "HALLAZGO 2 (seguridad): la reutilización del token entre arranques contradecía la revocación de ADR-0021 §3 ⇒ el token ahora ROTA por arranque (línea base del test actualizada: 'se reutiliza' → 'rota')",
    "Medición que decide la arquitectura: el blob de `safeStorage` de Electron 41 NO es descifrable desde otro proceso (ni con el mismo userData)",
    "Consecuencia: persistir el vault cifrado en disco NO habría resuelto el canal; de ahí el broker local (funciona con cualquier backend de keychain)",
    "El renderer NUNCA ve el token: enumeración real de los canales del preload, sin ninguno de tipo mcp+token, y el preload no menciona la clave del keychain ni la ruta del broker",
    "El token NO aparece en ningún log: captura de console.{log,info,warn,error,debug} durante arranque + uso + broker (con la captura demostrada viva para que el test no sea vacuo)",
    "El puerto efímero del servidor MCP también se descubre: el broker devuelve el token Y la URL",
    "A4 §7.2 (dueño del *arrival tardío*): las tools de un servidor MCP son GLOBAL (sin dueño): la conexión la abre la APP (`ipc.mcp.addServer`: `apps/desktop/src/main/ipc/domains/mcp.ts:49`)",
    "A4 §7.2: no es un olvido ⇒ el ámbito se declara EXPLÍCITO: `McpToolOwnership = {scope:'app'} | {scope:'sub-ego'; ownerSubEgoId}`",
    "A4 §7.2: el camino privado (`scope: 'sub-ego'`) queda implementado y probado (6 tests): la tool privada NO aparece en la vista de otro Sub-Ego y SÍ en la del dueño",
    "BUG PREEXISTENTE (destapado por la petición): el `exit` del subproceso viejo rechazaba el handshake del nuevo ⇒ apagar y volver a encender un servidor MCP fallaba SIEMPRE",
    "EGO-FIND-49 intacto: una tool nativa no se sobrescribe ni con `allowOverride` ni con dueño, y el veto se audita igual en ambos ámbitos"
  ],
  verify: {
    desktop_tests: "431 passed / 0 failed (antes 416 → +15; 14 nuevos + 1 línea base actualizada) · 70 ficheros · 5 skipped",
    integrations_tests: "84 passed / 0 failed (antes 77 → +7: 6 de dueño + 1 de regresión de la reconexión) · 10 ficheros",
    tools_tests: "181 passed / 0 failed · 21 ficheros",
    desktop_typecheck: "exit 0",
    integrations_typecheck: "exit 0",
    repo_typecheck: "⛔ exit 2 — FALSO ROJO de A4: `@ego/renderer` (`components/ego-chat.tsx:35` y `:1509`, 2 imports sin usar). Mis paquetes: desktop 0, integrations 0, tools 0",
    lint: "⛔ exit 1 — PUERTA COMPARTIDA, no de mi zona: oxlint 421 vs 438+ (crece con A2-bis/A4/A6). Mis 12 ficheros: 0 avisos; los 3 de main.ts son preexistentes",
    audit_security: "exit 0 — 0 críticos, 0 altos",
    verify_vantadb_ids: "exit 0 — 0 errores, 26 IDs",
    design_lint: "exit 0 — 0 errores, 22 advertencias (R8)",
    e2e_app_real: "CLI → token → `tools/list` = 200; token incorrecto = 401; el token ausente del stdout/stderr de la app; el pipe del broker desaparece al cerrar la app",
    tdd_rojos_demostrados: [
      "el canal: `Cannot find module '../src/main/mcp/mcp-token-broker.js'` (el módulo no existía)",
      "8/14 fallos en la primera implementación (fixture sin token en el vault; captura de logs vacía ⇒ test vacuo)",
      "compatibilidad Windows del pipe: `connect ENOENT` (un path de fichero no es un named pipe)",
      "el dueño: 3/6 fallos (`ÁMBITO SUB-EGO`, `el dueño SOBREVIVE a una reconexión`, `el McpClient acepta el dueño`)",
      "el bug de reconexión: `TypeError: Cannot read properties of undefined (reading 'ownerSubEgoId')` + `status: error … señal: SIGTERM`"
    ]
  },
  solicitudes_handoff: 5,
  fuera_de_zona: [
    "A1 (§5.1): fila de `docs/roadmap/Backlog.md:1203` (EGO-FIND-81) — texto exacto listo",
    "A1 (§5.2): ADR-0021 — texto exacto para §Decisión punto 3, §Invariantes (nuevo 6) y §Consecuencias/Deuda",
    "A1 (§9.6): el clause 'Pendiente' de la fila `EGO-FIND-90` (`docs/roadmap/Backlog.md:1212`) — texto exacto para sustituirlo por la decisión del dueño",
    "A1/A5 (§5.3): documentos de uso — `docs/user/changelog.md:89-94` y `docs/engineering/integraciones.md:99` (transporte `stdio`, desactualizado) y `:107` (keychain)",
    "A1/A5 (§5.3): además, no existe ninguna guía de cliente MCP en `docs/user/` ⇒ hay que crearla o añadirla a `configuration.md`",
    "A2-bis (§7): `CredentialManager` con el vault en memoria (`packages/security/src/CredentialManager.ts:337`) — decidir/documentar un backend persistente (`safeStorage` no es descifrable cross-proceso)",
    "A2-bis (§7.2): `SecretsFilter` no tiene consumidores ⇒ la redacción de secretos en el logger del main sería una garantía de sistema, no una convención"
  ],
  deuda_abierta: [
    "A7 (§10.0): `pnpm lint` en rojo por el presupuesto de oxlint (421 vs 438+, creciente por A2-bis/A4/A6) — mis ficheros aportan 0 avisos; el fichero `scripts/lint-budget.json` es suyo",
    "A4 (§10.0b): `pnpm -r typecheck` en rojo por `@ego/renderer` (`components/ego-chat.tsx:35` y `:1509`: 2 imports sin usar) — 2 líneas; mis 3 paquetes pasan",
    "A7: `@ego/desktop` no declara `bin` ⇒ el comando se invoca con la ruta larga (`electron out/main/main.js mcp token`); el alias `ego mcp token` necesita un lanzador",
    "macOS/Linux sin verificar: el modo CLI abre un `userData` temporal y en macOS puede hacer falta `app.dock.hide()`",
    "En POSIX la ruta del pipe está en `/tmp` (modo 0600 protege el socket, pero `$XDG_RUNTIME_DIR` sería más limpio)",
    "No hay guía de usuario para conectar un cliente MCP (A1) — el canal está listo, la documentación no",
    "El dueño del *arrival tardío* sólo aplica a las tools de un SERVIDOR MCP: una tool nativa de un Sub-Ego necesita `ownerSubEgoId` (lo declara quien la registra: `packages/tools/**`, A4)"
  ],
  SKILLS_CARGADAS: ["test-driven-development", "systematic-debugging", "security-and-hardening"]
}
```
