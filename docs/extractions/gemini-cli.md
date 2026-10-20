# Extracción Técnica: Gemini CLI (repos-referencia/gemini-cli) #

| Campo | Valor |
| --- | --- |
| Estado | Activo — Documento canónico de extracción y análisis de patrones |
| Repositorio Origen | `repos-referencia/gemini-cli/` (Commit verificado: `76e4d7c046c7dab5727787da378b9c06bf0948cf`, rama `main`, profundidad 1; `package.json` → `0.66.0-nightly.20261013.g204db94ae`) |
| Stack del Origen | Node.js ≥20 + TypeScript 5.8 (strict) + React 19 + Ink 6 (TUI) + `@modelcontextprotocol/sdk` 1.23 + Zod + `@iarna/toml` + `shell-quote` + `proper-lockfile` |
| Rol en Ego | Referencia de **gobernanza de herramientas** (policy engine), sandbox de shell, contexto jerárquico de proyecto y confianza de workspace |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Licencia | Apache-2.0 (origen, Google LLC) — compatible con la política de Ego (Apache 2.0); todo código derivado requiere cabecera `Adapted from google-gemini/gemini-cli (Apache-2.0), <ruta de origen>` y aviso de licencia en el `LICENSE.md` del paquete receptor |

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia ##

`gemini-cli` es el agente de código de Google más maduro en el eje de **gobernanza de herramientas**.
A diferencia de `hermes-agent` (gemelo de UI) o `openclaw` (harness de runs), su valor para Ego no
está en la interfaz sino en tres subsistemas con equivalente directo en el stack canónico de Ego:

1. **Motor de policy de tres veredictos** (`ALLOW` / `DENY` / `ASK_USER`) con reglas ordenadas por
   prioridad, la identidad del servidor MCP como dimensión de primera clase y degradación explícita a
   `ASK_USER` ante heurísticas de shell (`packages/core/src/policy/`). Es la pieza más transferible
   del repo.
2. **Sandbox de ejecución con deny-by-default real** (perfil SBPL de macOS, `bwrap` en Linux,
   restricted tokens en Windows), con lista de archivos de gobernanza intocables y de secretos negados.
3. **Contexto jerárquico por ficheros** con recorrido ascendente acotado por la raíz del repositorio y
   carga bajo demanda (JIT) al entrar en subdirectorios, con deduplicación por identidad de inodo.

### Divergencias Fundamentales (Qué Descartamos y Por Qué) ###

| Dimensión | Gemini CLI | Ego (Cognitive OS) | Decisión Crítica |
| --- | --- | --- | --- |
| **Capa de presentación** | TUI React Ink (`packages/cli/src/ui/`; `packages/cli/package.json:52`) | Electron 33 + React 19 en renderer (`apps/desktop/renderer/`) | **DESCARTAR** la TUI: es una primitive de framework (Ink) para terminal; el renderer de Ego es Chromium. |
| **Motor de policy** | `PolicyEngine` de 3 veredictos con reglas por prioridad (`packages/core/src/policy/policy-engine.ts:242-1018`) | `packages/security/src/ToolPermissions.ts` (veredicto ternario fail-closed) + `packages/execution/src/ApprovalEngine.ts` (HITL) | **ADAPTAR**: Ego ya tiene veredicto ternario y HITL; falta la tabla de reglas priorizadas con identidad MCP/subagente y la degradación por heurística de shell. |
| **Persistencia de la política** | Ficheros TOML en disco (`~/.gemini/policies/`, `policies/`) | VantaDB (`gov/`, `packages/memory/EgoMemoryAdapter.ts`) | **ADAPTAR** el modelo de precedencia por tiers; el sustrato sigue siendo VantaDB, no TOML en disco. |
| **Aislamiento del shell** | Seatbelt SBPL / `bwrap` / restricted tokens + helper nativo C# | `contextIsolation`/`sandbox` de Electron + validación léxica de rutas y allowlist de comandos (`packages/tools/src/native/terminal/TerminalCommandPolicy.ts`) | **ADAPTAR** la parte portable (gobernanza intocable, secretos negados); el aislamiento nativo por SO se difiere a Fase 11. |
| **Contexto de proyecto** | Ficheros `GEMINI.md` / `MEMORY.md` jerárquicos en disco (`packages/core/src/utils/memoryTool.ts:12`) | Namespaces VantaDB (`projects/*`, `kb/*`) + `packages/knowledge/src/ProjectMemoryGraph.ts` | **EXTRAER PATRÓN** (algoritmo de descubrimiento y dedup); nunca el cambio de sustrato. |
| **Proveedor de modelo** | Gemini API con OAuth de Google (`packages/core/src/code_assist/`) | Model Router propio multi-proveedor + BYOK (`packages/models/src/ModelRouter.ts`) | **DESCARTAR**: dominio ajeno y colisión con el principio 7. |
| **Telemetría** | Clearcut (`packages/core/src/telemetry/clearcut-logger/`) | `packages/events/src/StructuredLogger.ts` local | **DESCARTAR**: telemetría saliente incompatible con el principio 9 (local-first). |

---

## 2. Inventario Quirúrgico de Patrones a Extraer ##

### Bloque A: Motor de política de herramientas ###

Ubicación en fuente: `repos-referencia/gemini-cli/packages/core/src/policy/`

1. **Veredicto ternario y fail-closed** — `policy-engine.ts:298-301` (default interactivo `ASK_USER` /
   no interactivo `DENY`), `:370-372` (`DENY` nunca se degrada), `:1010-1012` (`ASK_USER` → `DENY` en
   headless); `types.ts:10-14`.

   **Qué hace:** tres veredictos (`allow` / `deny` / `ask_user`) con default fail-closed por modo de
   ejecución y negación dominante sobre el resto de heurísticas.

   **Adaptación en Ego:** **ya asimilado**. `packages/security/src/ToolPermissions.ts:25`
   (`ToolDecision`), `:264-269` (`defaultMode` fail-closed), `:364-371` (`isDenied` / `needsApproval`).

   **Relación con Backlog Ego:** `SEC-05`, `ACT-06`.

2. **Reglas priorizadas con identidad MCP, subagente y argumentos** — `policy-engine.ts:129-240`
   (`ruleMatches`: comodín `mcp_{server}_*`, `mcpName`, `subagent`, `toolAnnotations`, `argsPattern` con
   serialización estable, `modes`, `interactive`), `:255-263` (orden descendente por prioridad).

   **Qué hace:** una tabla de reglas declarativas donde gana la de mayor prioridad, con la identidad
   de servidor MCP y de subagente como criterios independientes del nombre de la herramienta.

   **Adaptación en Ego:** extender `packages/security/src/ToolPermissions.ts` (hoy: cadena de `if` en
   `:277-360`) con una tabla `PolicyRule[]` ordenada por prioridad; el Tool Registry canónico es
   `packages/tools/src/ToolRegistry.ts:181` (`resolveApprovalRequirement`).

   **Relación con Backlog Ego:** `SEC-05`, `ACT-01`, `ACT-06`, `ACT-09`.

3. **Degradación por heurística de shell** — `policy-engine.ts:365-445` (cwd fuera del workspace →
   `ASK_USER`; `git` en workspace no confiable → `ASK_USER`; comando peligroso → `ASK_USER`; comando
   conocido-seguro → `ALLOW`), `:447-675` (descomposición de comandos compuestos y wrappers `bash -c`),
   `:903-956` (Build File Protection: exige confirmación explícita para ficheros de build).

   **Qué hace:** el motor no se limita a la regla: evalúa el comando real y **rebaja** un `ALLOW` a
   `ASK_USER` cuando hay heurística de riesgo.

   **Adaptación en Ego:** mismo punto de entrada que hoy (`governance.permissionCheck` en
   `apps/desktop/src/main.ts:2505`), reutilizando el veredicto de `TerminalCommandPolicy.evaluate`
   (`packages/tools/src/native/terminal/TerminalCommandPolicy.ts:284`).

   **Relación con Backlog Ego:** `SEC-05`, `ACT-04`.

4. **Precedencia por tiers de configuración de gobernanza** — `config.ts:66-86` (constantes de tier
   `1..5` y prioridades fraccionales), `:108-130` (`getPolicyDirectories`), `:136-174` (`getPolicyTier`),
   `:227-284` (`loadExtensionPolicies`: una extensión **no puede** contribuir reglas `ALLOW` ni modos
   `YOLO`), `:296-314` (ignora la política administrativa extra si ya existe política de sistema),
   `:712-934` (`createPolicyUpdater`: escritura atómica tmp+rename y cola secuencial
   anti-pérdida-de-actualizaciones).

   **Qué hace:** orden de precedencia Default < Extension < Workspace < User < Admin, con prioridad
   fraccional para no colisionar entre bandas, y una garantía dura de que una extensión no puede
   auto-aprobar.

   **Adaptación en Ego:** aplicar las bandas de precedencia sobre
   `packages/execution/src/SafeConfigMutation.ts` (`SafeConfigMutationService`, `:25`) y sobre las
   preferencias cacheadas que ya consume `apps/desktop/src/main.ts:2506`.

   **Relación con Backlog Ego:** `SEC-05`, `ACT-09`, `ACT-11`.

### Bloque B: Seguridad de ejecución de shell ###

Ubicación en fuente: `packages/core/src/sandbox/` y `packages/core/src/services/sandboxManager.ts`

1. **Allowlist de comandos seguros y denylist de peligrosos, con saneamiento de entorno** —
   `sandbox/utils/commandSafety.ts`, `sandbox/windows/commandSafety.ts`,
   `services/environmentSanitization.ts` (`sanitizeEnvironment`, `getSecureSanitizationConfig`).

   **Qué hace:** clasificación de comandos en conocido-seguro / desconocido / peligroso y filtrado del
   entorno heredado por el subproceso.

   **Adaptación en Ego:** **ya cubierto** por el módulo canónico
   `packages/tools/src/native/terminal/TerminalCommandPolicy.ts` (cabezas/subcomandos `:39-70`,
   separadores y construcciones prohibidas `:146-154`, `PROCESS_ENV_ALLOWLIST` + `sanitizeProcessEnv`
   `:551-620`).

   **Relación con Backlog Ego:** `SEC-05`, `ACT-04`.

2. **Archivos de gobernanza intocables y secretos negados** — `services/sandboxManager.ts:198-212`
   (`GOVERNANCE_FILES`: `.gitignore`, `.geminiignore`, `.git`; `SECRET_FILES`: `.env`, `.env.*`),
   `:216-224` (`isSecretFile`), `:243-283` (`findSecretFiles` con `skipDirs`);
   `sandbox/windows/WindowsSandboxManager.ts:96-106` (`ensureGovernanceFilesExist` crea los ficheros
   antes de lanzar el sandbox para poder protegerlos).

   **Qué hace:** el sandbox nunca concede escritura sobre ficheros de gobernanza ni lectura sobre
   ficheros de credenciales, independientemente de la política del comando.

   **Adaptación en Ego:** la lista de rutas reservadas de
   `packages/security/src/ToolPermissions.ts:97-108` cubre directorios del sistema, pero **no** cubre
   ficheros de gobernanza del repositorio ni `.env*`; añadirlo en
   `packages/tools/src/native/fs/NativeFsTool.ts` y
   `packages/tools/src/native/terminal/NativeTerminalTool.ts`.

   **Relación con Backlog Ego:** `SEC-05`, `SEC-09`, `CARP-03`.

3. **Resolución canónica de rutas del sandbox** — `services/sandboxManager.ts:371-454`
   (`resolveSandboxPaths`: expande cada ruta a su `realpath`, deduplica, filtra workspace y rutas
   prohibidas, resuelve worktrees/submódulos de git vía `sandbox/utils/fsUtils.ts`).

   **Qué hace:** toda ruta que entra al sandbox se canonicaliza antes de comparar, de modo que un
   symlink no puede eludir el perímetro.

   **Adaptación en Ego:** `packages/tools/src/native/fs/PathValidator.ts:31` ya valida con resolución
   de symlinks; extender la misma canonicalización a las rutas **declaradas por el usuario** (allowlist
   de permisos) y no solo a las rutas de entrada.

   **Relación con Backlog Ego:** `SEC-05`, `CARP-03`.

4. **Aislamiento nativo de proceso por sistema operativo** — `sandbox/macos/baseProfile.ts:14-17`
   (`(deny default)` + import del perfil base de Apple), `:163-211` (deny de sockets y binarios de
   Docker/Podman/Colima/OrbStack), `sandbox/macos/MacOsSandboxManager.ts:73-140` (preparación del
   comando con perfil y permisos), `sandbox/linux/bwrapArgsBuilder.ts`,
   `sandbox/windows/WindowsSandboxManager.ts:61-106` (restricted tokens + Job Objects + helper nativo
   `GeminiSandbox.exe` compilado desde C#).

   **Qué hace:** aislamiento real del proceso hijo, no solo validación léxica previa.

   **Adaptación en Ego:** **diferido**. Requiere toolchain nativa por SO y un modelo "lectura por
   defecto, escritura por aprobación" que hoy Ego no tiene para `terminal_exec`.

   **Relación con Backlog Ego:** `SEC-05` (Fase 11, P1).

### Bloque C: Contexto jerárquico de proyecto y confianza de workspace ###

Ubicación en fuente: `packages/core/src/utils/memoryDiscovery.ts`, `packages/core/src/utils/trust.ts`

1. **Descubrimiento jerárquico del contexto + carga JIT por subdirectorio** —
   `memoryDiscovery.ts:150-207` (`findProjectRoot` con marcador de frontera `.git`), `:405-431`
   (`getEnvironmentMemoryPaths`: recorrido ascendente con techo en la raíz del repositorio), `:463-510`
   (`findUpwardGeminiFiles`), `:512-648` (`loadJitSubdirectoryMemory`: carga bajo demanda del contexto
   al entrar en un subdirectorio, eligen la raíz confiable más profunda), `:54-148` (deduplicación por
   identidad `dev:ino` en vez de por cadena de ruta), `:209-293` (límite de concurrencia 20 para no
   agotar descriptores).

   **Qué hace:** el contexto de un proyecto se resuelve por jerarquía de directorios con techo
   explícito, y se amplía bajo demanda sin recargar todo.

   **Adaptación en Ego:** **extraer el algoritmo**, no el formato de fichero: un resolvedor de
   contexto jerárquico sobre el proyecto activo que alimente el Context Assembly del runtime
   (`packages/runtime/src/ToolExecutionLoop.ts:335`) y persista los hechos en VantaDB.

   **Relación con Backlog Ego:** `CORE-06`, `CORE-07`, `KB-01`, `KB-11`, `SUB-04`.

2. **Confianza de workspace por niveles** — `trust.ts:18-22` (`TRUST_FOLDER` / `TRUST_PARENT` /
   `DO_NOT_TRUST`), `:47-83` (`checkPathTrust` con precedencia env → IDE → fichero), `:157-197`
   (`isPathTrusted`: gana el prefijo más largo y la comparación es sobre `realpath` normalizado),
   `:199-271` (`setValue` con `proper-lockfile` y reversión en memoria si el guardado falla), `:333-363`
   (`saveTrustedFolders`: tmp + rename, modo `0600`).

   **Qué hace:** el veredicto de confianza se resuelve por la regla más específica que aplica, sobre
   rutas canonicalizadas, y el almacén se escribe de forma atómica y exclusiva para el usuario.

   **Adaptación en Ego:** **no existe el concepto**. El grep
   `TRUST_FOLDER\|DO_NOT_TRUST\|isWorkspaceTrusted\|folderTrust` sobre `packages/` devuelve 0
   resultados: `packages/runtime/src/TrustBoundary.ts` marca *mensajes* no confiables, no *workspaces*.

   **Relación con Backlog Ego:** `SEC-05`, `CORE-07`.

### Bloque D: Comandos declarativos por fichero ###

Ubicación en fuente: `packages/cli/src/services/FileCommandLoader.ts`

1. **Macros en TOML con pipeline de inyección seguro** — `:55-71` (esquema Zod `prompt` +
   `description`), `:95-145` (carga recursiva con glob `**/*.toml`), `:205-247` (orden usuario →
   proyecto (gateado por confianza) → extensiones), `:301-320` (nombre derivado de la ruta, sanitizado
   y truncado), `:331-357` (**la inyección `@file` se ejecuta ANTES que la de shell**, para que el
   contenido inyectado no pueda generar rutas maliciosas), `:396-406` (`ConfirmationRequiredError`
   devuelve el control a la UI para confirmar los comandos).

   **Qué hace:** macros versionables en el repositorio, con precedencia explícita y un orden de
   procesamiento que impide que la inyección de ficheros se convierta en ejecución de shell.

   **Adaptación en Ego:** un cargador de macros por proyecto en `packages/subegos/src/` que reutilice
   `packages/integrations/src/skills/SkillLinter.ts` para validar el fichero antes de registrarlo, y
   que **no** reutilice `packages/ui-runtime/src/SlashCommandParser.ts` (descartado en `HERM-12` por
   duplicar `apps/desktop/renderer/components/composer-slash.ts`).

   **Relación con Backlog Ego:** `SUB-01`, `SUB-02`, `ACT-11`, `HERM-12`.

---

## 3. Matriz de Extracción vs Descarte ##

| Componente Gemini CLI | Acción en Ego | Razón Técnica / Arquitectónica |
| --- | :---: | --- |
| `packages/core/src/policy/policy-engine.ts` (veredicto ternario) | **EXTRAER PATRÓN** | Semántica idéntica a `ToolPermissions.ts`; solo se documenta y se cita, no se re-importa. |
| `packages/core/src/policy/policy-engine.ts` (tabla de reglas priorizadas) | **EXTRAER & ADAPTAR** | Aporta identidad MCP/subagente y degradación por heurística, ausentes en la cadena de `if` actual. |
| `packages/core/src/policy/config.ts` (tiers) + `toml-loader.ts` (Zod) | **EXTRAER & ADAPTAR** | La precedencia por origen y la prohibición de auto-aprobar a extensiones son invariantes de gobernanza. |
| `packages/core/src/sandbox/utils/commandSafety.ts` + `environmentSanitization.ts` | **EXTRAER PATRÓN** | Ya cubierto por `TerminalCommandPolicy.ts`; no duplicar. |
| `packages/core/src/services/sandboxManager.ts` (gobernanza, secretos, realpath) | **EXTRAER & ADAPTAR** | Cubre huecos reales del perímetro de Ego (ficheros de gobernanza, `.env*`). |
| `packages/core/src/sandbox/{macos,linux,windows}` (aislamiento nativo) | **EXTRAER PATRÓN** | Diferido a Fase 11: exige toolchain nativa por SO. |
| `packages/core/src/utils/memoryDiscovery.ts` | **EXTRAER & ADAPTAR** | Algoritmo de jerarquía + JIT + dedup por inodo; el sustrato sigue siendo VantaDB. |
| `packages/core/src/utils/trust.ts` | **EXTRAER & ADAPTAR** | La confianza de workspace no existe en Ego y es requisito del principio 6. |
| `packages/cli/src/services/FileCommandLoader.ts` | **EXTRAER & ADAPTAR** | Macros versionables por proyecto con pipeline de seguridad; complementa `HERM-12`. |
| `packages/cli/src/ui/` (React Ink) | 🚫 **Descartada** | Primitive de terminal; el renderer de Ego es Chromium (Electron + React 19). |
| `packages/core/src/code_assist/` + `packages/core/src/telemetry/clearcut-logger/` | 🚫 **Descartada** | Dominio ajeno de Google: viola los principios 7 y 9 e introduce telemetría saliente. |
| `packages/a2a-server/` | 🚫 **Descartada** | Experimental (`packages/a2a-server/README.md:3`) y sin equivalente canónico: `packages/integrations/src/mcp/` ya cubre MCP cliente + servidor. |

---

## 4. Estado real verificado (2026-10-20) ##

> Fuente canónica del estado por tarea: [`docs/review/backlog-gemini-cli.md`](../review/backlog-gemini-cli.md).
> Criterio de cierre: fichero adaptado **y** caller en producción (grep sobre `packages/` +
> `apps/desktop/`, excluyendo `test/`, `dist/`, `node_modules/`).

| ID | Patrón | Estado | Evidencia / Fundamento |
| --- | --- | :---: | --- |
| `GCLI-01` | Veredicto ternario fail-closed (`allow` / `deny` / `requireApproval`) con negación dominante | ✅ Completada | `packages/security/src/ToolPermissions.ts:25` (`ToolDecision`), `:264-269` (`defaultMode` fail-closed), `:364-371` (`isDenied` / `needsApproval`). Caller en producción: `apps/desktop/src/main.ts:56` (import) y `:2515` (`evaluateToolCall` en `governance.permissionCheck`); `apps/desktop/src/main/ipc/register-ipc.ts:44` (import) y `:1880` (gate deny-gana de `terminal.spawn`). |
| `GCLI-02` | Allowlist deny-by-default de comandos, segmentación por metacaracteres, flags de escape prohibidos y allowlist de variables de entorno | ✅ Completada | `packages/tools/src/native/terminal/TerminalCommandPolicy.ts:39-70` (cabezas y subcomandos), `:146-154` (separadores y construcciones prohibidas), `:284-335` (`evaluate`), `:551-620` (`PROCESS_ENV_ALLOWLIST`, `sanitizeProcessEnv`). Callers: `packages/tools/src/native/terminal/NativeTerminalTool.ts:69`; `apps/desktop/src/main/terminal-policy.ts:19,44,60`; `apps/desktop/src/main/ipc/register-ipc.ts:49,1914`. **Nota:** cobertura previa a esta revisión (EGO-FIND-32); no derivada de este repo, por lo que no procede re-importación. |
| `GCLI-03` | Motor de reglas priorizadas con identidad MCP/subagente, `argsPattern` y degradación por heurística de shell, sobre precedencia de configuración por tiers | 🆕 Pendiente | Sin fichero adaptado. **Cableado:** extender `packages/security/src/ToolPermissions.ts` con una tabla `PolicyRule[]` ordenada por prioridad (comodín `mcp_{server}_*`, `mcpName`, `subagent`, `argsPattern`) y conectarla al `permissionCheck` de `apps/desktop/src/main.ts:2505`; bandas de precedencia usuario/proyecto/extensión en `packages/execution/src/SafeConfigMutation.ts:25`. **Responsable:** A2 (motor de permisos), revisión A4. |
| `GCLI-04` | Descubrimiento jerárquico del contexto de proyecto con techo en la raíz del repositorio, carga JIT por subdirectorio y deduplicación por identidad de inodo | 🆕 Pendiente | Sin fichero adaptado. **Cableado:** `packages/knowledge/src/HierarchicalContextResolver.ts` resolviendo el contexto del proyecto activo y alimentando el Context Assembly (`packages/runtime/src/ToolExecutionLoop.ts:335`); los hechos derivados se persisten en VantaDB, nunca en ficheros planos. **Responsable:** A2 (contexto) con A5 (memoria). |
| `GCLI-05` | Confianza de workspace por niveles, resuelta por prefijo más largo sobre `realpath` y almacenada de forma atómica y exclusiva | 🆕 Pendiente | Sin fichero adaptado (grep `TRUST_FOLDER\|DO_NOT_TRUST\|isWorkspaceTrusted\|folderTrust` sobre `packages/` → 0 resultados; `packages/runtime/src/TrustBoundary.ts` es marcado de mensajes, no confianza de workspace). **Cableado:** `packages/security/src/WorkspaceTrust.ts` + gate en `evaluateToolCall` (`defaultMode`) y en `apps/desktop/src/main.ts:2505`. **Responsable:** A2. |
| `GCLI-06` | Archivos de gobernanza intocables, secretos (`.env*`) negados y canonicalización de rutas declaradas | 🆕 Pendiente | Sin fichero adaptado. **Cableado:** `packages/security/src/SandboxPathPolicy.ts` (lista `GOVERNANCE_FILES` y `SECRET_FILES`) invocado desde `packages/tools/src/native/fs/NativeFsTool.ts` y `packages/tools/src/native/terminal/NativeTerminalTool.ts`; extender la canonicalización de `packages/tools/src/native/fs/PathValidator.ts:31` a las rutas de la allowlist de permisos. **Responsable:** A2. |
| `GCLI-07` | Aislamiento nativo de proceso por SO (Seatbelt SBPL, `bwrap`, restricted tokens + Job Objects con helper C#) | ⏳ Futura (Fase 11 / P1) | Requiere toolchain nativa por sistema operativo y un modelo "lectura por defecto, escritura por aprobación" que Ego no aplica hoy a `terminal_exec`. Ego solo aísla el renderer (`contextIsolation`, `sandbox`). **Fase destino:** Fase 11 (`SEC-05`), prioridad P1; condicionado a que el terminal nativo enlace con proceso real. **Responsable:** A2/A4. |
| `GCLI-08` | Macros declarativas por fichero con pipeline de procesadores (inyección `@file` antes que shell) y precedencia usuario → proyecto → extensión | 🆕 Pendiente | Sin fichero adaptado. `packages/ui-runtime/src/SlashCommandParser.ts` existe pero **sin caller** (descartado en `HERM-12` por duplicar `apps/desktop/renderer/components/composer-slash.ts`): no debe reutilizarse. **Cableado:** `packages/subegos/src/MacroLoader.ts` con el mismo orden de precedencia y con inyección `@file` antes que shell, validado con `packages/integrations/src/skills/SkillLinter.ts`. **Responsable:** A4/A2. |
| `GCLI-09` | TUI React Ink, acoplamiento Google (Code Assist / OAuth / telemetría Clearcut) y servidor A2A experimental | 🚫 **Descartada (con justificación)** | TUI: primitive de Ink para terminal, incompatible con el renderer Electron de Ego y con el principio de primitives de librería (`AGENTS.md` §4, D3). `packages/core/src/code_assist/` y `packages/core/src/telemetry/clearcut-logger/`: dominio ajeno de Google; violan los principios 7 (multi-modelo + Model Router) y 9 (local-first y propiedad de datos) e introducirían un proveedor propietario y telemetría saliente. `packages/a2a-server/`: experimental (`packages/a2a-server/README.md:3`) y sin equivalente canónico — `packages/integrations/src/mcp/` ya cubre MCP cliente + servidor. |

**Recuento:** 2 `✅ Completada` · 1 `🚫 Descartada` · 5 `🆕 Pendiente` · 1 `⏳ Futura` — **9 tareas**.

---

## 5. Descarte de componente — normalizado a la forma canónica (2026-10-20) ##

Las filas de la matriz §3 usaban la forma `**DESCARTAR**`; se normalizan aquí a
`🚫 Descartada (con justificación)` (AGENTS.md §4) conservando el motivo original:

| Componente Gemini CLI | Veredicto | Fundamento |
| --- | :---: | --- |
| `packages/cli/src/ui/` (TUI React Ink) | 🚫 **Descartada (con justificación)** | La TUI es una primitive de framework para terminal; Ego es Electron 33 + React 19 en renderer y aplica el principio de primitives de librería (`AGENTS.md` §4, D3). No aporta nada al Dynamic Workspace. |
| `packages/core/src/code_assist/` + `packages/core/src/telemetry/clearcut-logger/` | 🚫 **Descartada (con justificación)** | Dominio ajeno de Google (OAuth Code Assist, telemetría Clearcut). Contaminaría el Model Router propio (principio 7) y rompería el local-first con propiedad de datos (principio 9) al introducir telemetría saliente. |
| `packages/a2a-server/` | 🚫 **Descartada (con justificación)** | Experimental (`packages/a2a-server/README.md:3`) y sin equivalente canónico: `packages/integrations/src/mcp/` (`McpClient.ts`, `McpServer.ts`, `McpManager.ts`) ya cubre MCP cliente + servidor. Incorporarlo sería duplicación y sobreingeniería. |
| Modo `YOLO` (`packages/core/src/policy/types.ts:48-53`, `packages/core/src/policy/policies/yolo.toml`) | 🚫 **Descartada (con justificación)** | Un modo que auto-allow-everything (`PRIORITY_YOLO_ALLOW_ALL = 998`, `types.ts:388`) contradice el principio 6 y la postura fail-closed de Ego. Ego ya tiene `GovernanceMode` (`strict` \| `standard` \| `permissive`) en `packages/execution/src/ApprovalEngine.ts:186-222`, donde incluso `permissive` sigue exigiendo aprobación para acciones `destructive`. |
