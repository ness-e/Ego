---
kind: review
status: active
description: "Backlog de revisión y extracción de patrones de gemini-cli hacia el monorepo de Ego."
tags: [ego, gemini-cli, extraction, review, policy-engine, sandbox, governance, project-memory]
schema: "10-column canonical schema (.agents/references/backlog-format.md compatible)"
---

# Backlog de Revisión y Extracción: Gemini CLI (google-gemini/gemini-cli) #

## Gobernanza de herramientas, sandbox de shell, contexto jerárquico de proyecto y confianza de workspace ##

| Campo | Valor |
| --- | --- |
| Estado | Activo — Backlog de revisión y extracción (repo nuevo, sin asimilaciones previas) |
| Repositorio Origen | `repos-referencia/gemini-cli/` (commit `76e4d7c046c7dab5727787da378b9c06bf0948cf`, rama `main`, profundidad 1; Apache-2.0) |
| Total de Tareas | **9** (`GCLI-01..09`) — 2 ✅ · 1 🚫 · 5 🆕 · 1 ⏳ · **0 en el limbo** |
| Fases Impactadas en Ego | Fase 01 (`CORE`), Fase 02 (`ACT`), Fase 03 (`SUB`), Fase 06 (`KB`), Fase 11 (`SEC`) |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Última verificación | 2026-10-20 — grep sobre `packages/` + `apps/desktop/src/` (excluye `test/`, `dist/`, `node_modules/`) |

> **Propósito:** Registro canónico de auditoría, extracción de patrones y adaptación técnica de
> `repos-referencia/gemini-cli` hacia el monorepo de Ego.
> **Regla de Operación:** *No copiar código directamente*. Extraer la lógica de diseño, contratos y
> patrones arquitectónicos, reescribiendo limpiamente en TypeScript estricto, React 19 y Node 22 Main
> Process, apoyándose en VantaDB como sustrato de memoria.
> **Esquema:** Tabla canónica de 10 columnas: `ID`, `Severidad`, `Hallazgo`, `Archivo Gemini CLI`,
> `Esfuerzo`, `Prioridad`, `Estado`, `Descripción & Adaptación en Ego`, `Relaciones Ego`, `Dependencias`.

---

## 0. Verificación de estado (2026-10-20) ##

| Estado | Significado canónico |
| --- | --- |
| `✅ Completada` | Patrón cubierto por un módulo canónico de Ego **con caller en producción verificado**. La celda cita la ruta real. |
| `🚫 Descartada (con justificación)` | El patrón no se aplica en Ego, fue sustituido por otro módulo canónico, o viola un guardrail. La celda contiene el motivo técnico. |
| `🆕 Pendiente` | Capacidad asimilable identificada pero **sin fichero adaptado**. La celda dice el cableado exacto y quién lo ejecuta. |
| `⏳ Futura (fase)` | Diferido a una fase posterior, con fase destino explícita. |

**Nota de alcance (repo nuevo):** `gemini-cli` se incorpora por primera vez al catálogo de
extracciones. Ningún patrón de este repositorio ha sido asimilado *desde* él: los dos hallazgos
`✅ Completada` no proceden de este repo, sino que están **ya cubiertos** por módulos canónicos de Ego
(`@ego/security`, `@ego/tools`) que satisfacen la misma necesidad — se documentan para dejar constancia
de que no procede re-importación y para cerrar la compuerta con evidencia, no para atribuir una
asimilación inexistente.

**Búsquedas de verificación ejecutadas** sobre `packages/` + `apps/desktop/src/`:

```text
Select-String "evaluateToolCall"     packages/ apps/desktop/src/ -> main.ts:2515, register-ipc.ts:1880
Select-String "TerminalCommandPolicy" packages/ apps/desktop/src/ -> NativeTerminalTool.ts:69
Select-String "TerminalCommandPolicy" packages/ apps/desktop/src/ -> terminal-policy.ts:60, register-ipc.ts:1914
Select-String "TRUST_FOLDER|DO_NOT_TRUST|isWorkspaceTrusted|folderTrust" packages/ -> 0 resultados
Select-String "SlashCommandParser" packages/ apps/desktop/src/ -> 0 callers fuera de packages/ui-runtime/src/
```

---

## 1. Resumen Ejecutivo de Tareas de Extracción ##

| Grupo de Trabajo | Rango IDs | Tareas | Fases de Ego Impactadas | Prioridad | Beneficio Principal |
| --- | --- | :---: | --- | :---: | --- |
| **A. Motor de política de herramientas** | `GCLI-01`, `GCLI-03` | 2 | Fase 02 (`ACT`), Fase 11 (`SEC`) | P0 | Veredicto ternario fail-closed y tabla de reglas priorizadas con identidad MCP/subagente |
| **B. Seguridad de ejecución de shell** | `GCLI-02`, `GCLI-06`, `GCLI-07` | 3 | Fase 02 (`ACT`), Fase 11 (`SEC`) | P0 | Allowlist deny-by-default, gobernanza intocable, secretos negados y aislamiento nativo diferido |
| **C. Contexto jerárquico y confianza de workspace** | `GCLI-04`, `GCLI-05` | 2 | Fase 01 (`CORE`), Fase 06 (`KB`), Fase 11 (`SEC`) | P1 | Resolución de contexto por jerarquía de directorios y veredicto de confianza del proyecto |
| **D. Comandos declarativos por fichero** | `GCLI-08` | 1 | Fase 03 (`SUB`) | P1 | Macros versionables por proyecto con pipeline de inyección seguro |
| **E. Descarte de dominio y de stack** | `GCLI-09` | 1 | — | P1 | Tasa de contaminación de dominio acotada y sin filas en el limbo |
| **TOTAL** | `GCLI-01..09` | **9** | **Fases 01, 02, 03, 06, 11** | — | — |

### MATRIZ DE DISTRIBUCIÓN POR FASE ###

```text
FASE 01 CORE (chat + memoria)      GCLI-04  contexto jerarquico del proyecto
FASE 02 ACT  (tool calling)        GCLI-03  reglas priorizadas del policy engine
FASE 03 SUB  (Sub-Egos)            GCLI-08  macros declarativas por proyecto
FASE 06 KB   (knowledge)            GCLI-04  dedup por identidad + persistencia VantaDB
FASE 11 SEC  (sandbox + permisos)  GCLI-01 [OK]  GCLI-02 [OK]  GCLI-03  GCLI-05
                                   GCLI-06  GCLI-07 [FUTURA P1]
DESCARTES                         GCLI-09  TUI Ink + dominio Google + A2A experimental
```

#### Recuento de estados (verificado sobre las 9 filas de la tabla §2) ####

| `✅ Completada` | `🚫 Descartada` | `🆕 Pendiente` | `⏳ Futura` | Total |
| :---: | :---: | :---: | :---: | :---: |
| 2 | 1 | 5 | 1 | **9** |

---

## 2. Catálogo Detallado de Extracción (10 Columnas Canónicas) ##

| ID | Severidad | Hallazgo | Archivo Gemini CLI | Esfuerzo | Prioridad | Estado | Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `GCLI-01` | Crítica | **Veredicto ternario fail-closed con negación dominante** | `packages/core/src/policy/types.ts:10-14` · `policy-engine.ts:298-301,370-372,1010-1012` | — | P0 | ✅ Completada | Semántica `allow \| deny \| ask_user` con default `ASK_USER` en interactivo y `DENY` en headless. Cubierto por `packages/security/src/ToolPermissions.ts:25` (`ToolDecision`), `:264-269` (`defaultMode` fail-closed) y `:364-371` (`isDenied` / `needsApproval`). **Evidencia:** `apps/desktop/src/main.ts:56` (import) y `:2515` (`evaluateToolCall` en `governance.permissionCheck`); `apps/desktop/src/main/ipc/register-ipc.ts:44` (import) y `:1880` (gate deny-gana de `terminal.spawn`). No procede re-importación. | Ego: `SEC-05`, `ACT-06` | — |
| `GCLI-02` | Crítica | **Allowlist deny-by-default de comandos, segmentación y flags de escape** | `packages/core/src/sandbox/utils/commandSafety.ts` · `packages/core/src/services/environmentSanitization.ts` | — | P0 | ✅ Completada | Clasificación de comandos conocido-seguro / desconocido / peligroso y filtrado del entorno heredado. Cubierto por el módulo canónico `packages/tools/src/native/terminal/TerminalCommandPolicy.ts:39-70` (cabezas y subcomandos), `:146-154` (separadores y construcciones prohibidas), `:284-335` (`evaluate`), `:551-620` (`PROCESS_ENV_ALLOWLIST`, `sanitizeProcessEnv`). **Evidencia:** `packages/tools/src/native/terminal/NativeTerminalTool.ts:69`; `apps/desktop/src/main/terminal-policy.ts:19,44,60`; `apps/desktop/src/main/ipc/register-ipc.ts:49,1914`. Cobertura previa (EGO-FIND-32), no derivada de este repo. | Ego: `SEC-05`, `ACT-04` | — |
| `GCLI-03` | Crítica | **Motor de reglas priorizadas + identidad MCP/subagente + degradación por heurística de shell** | `packages/core/src/policy/policy-engine.ts:129-240,255-263,365-445,447-675` · `policy/config.ts:66-86,108-174,227-284` · `policy/toml-loader.ts:39-70` | 2-3d | P0 | 🆕 Pendiente | Sin fichero adaptado. **Cableado:** extender `packages/security/src/ToolPermissions.ts` (hoy cadena de `if` en `:277-360`) con una tabla `PolicyRule[]` ordenada por prioridad, con comodín `mcp_{server}_*`, `mcpName`, `subagent` y `argsPattern`, y conectarla al `permissionCheck` de `apps/desktop/src/main.ts:2505`; añadir degradación a `requireApproval` por cwd fuera de workspace, comando peligroso y redirección. Las bandas de precedencia usuario/proyecto/extensión y la prohibición de que una extensión auto-aprobe (`config.ts:240-255`) se aplican sobre `packages/execution/src/SafeConfigMutation.ts:25`. **Responsable:** A2 (motor de permisos), revisión A4. | Ego: `SEC-05`, `ACT-01`, `ACT-06`, `ACT-09` | `GCLI-01` |
| `GCLI-04` | Alta | **Contexto jerárquico de proyecto con techo en la raíz del repo, carga JIT por subdirectorio y dedup por inodo** | `packages/core/src/utils/memoryDiscovery.ts:150-207,405-431,463-510,512-648,54-148,209-293` | 2d | P1 | 🆕 Pendiente | Sin fichero adaptado. **Cableado:** `packages/knowledge/src/HierarchicalContextResolver.ts` que resuelva el contexto del proyecto activo por recorrido ascendente acotado por la raíz del repositorio, amplíe el contexto bajo demanda al entrar en un subdirectorio y deduplique por identidad `dev:ino` (no por cadena de ruta, para no duplicar en sistemas case-insensitive); alimentar el Context Assembly en `packages/runtime/src/ToolExecutionLoop.ts:335`. Los hechos derivados se persisten en VantaDB (`projects/*`, `kb/*`), **no** en ficheros planos. **Responsable:** A2 (contexto) con A5 (memoria). | Ego: `CORE-06`, `CORE-07`, `KB-01`, `KB-11`, `SUB-04` | `GCLI-05` |
| `GCLI-05` | Alta | **Confianza de workspace por niveles con prefijo más largo y persistencia atómica** | `packages/core/src/utils/trust.ts:18-22,47-83,157-197,199-271,333-363` | 1-2d | P1 | 🆕 Pendiente | Sin fichero adaptado: el concepto no existe en Ego (grep `TRUST_FOLDER\|DO_NOT_TRUST\|isWorkspaceTrusted\|folderTrust` sobre `packages/` → 0 resultados; `packages/runtime/src/TrustBoundary.ts` marca *mensajes* no confiables, no *workspaces*). **Cableado:** `packages/security/src/WorkspaceTrust.ts` con tres niveles (`TRUST_FOLDER` / `TRUST_PARENT` / `DO_NOT_TRUST`), resolución por regla más específica sobre `realpath` normalizado y almacén escrito con tmp+rename en modo `0600` bajo lockfile; gatear `evaluateToolCall` (`defaultMode`) y el `permissionCheck` de `apps/desktop/src/main.ts:2505` con el veredicto. **Responsable:** A2. | Ego: `SEC-05`, `CORE-07` | `GCLI-03` |
| `GCLI-06` | Alta | **Archivos de gobernanza intocables, secretos (`.env*`) negados y canonicalización de rutas** | `packages/core/src/services/sandboxManager.ts:198-212,216-224,243-283,371-454` · `sandbox/windows/WindowsSandboxManager.ts:96-106` | 1-2d | P1 | 🆕 Pendiente | Sin fichero adaptado. Ego bloquea directorios reservados del sistema (`packages/security/src/ToolPermissions.ts:97-108`) pero **no** protege los ficheros de gobernanza del repositorio (`.gitignore`, `.git`) ni niega la lectura de `.env*`. **Cableado:** `packages/security/src/SandboxPathPolicy.ts` con las listas `GOVERNANCE_FILES` y `SECRET_FILES` y con el barrido de secretos (`findSecretFiles`), invocado desde `packages/tools/src/native/fs/NativeFsTool.ts` y `packages/tools/src/native/terminal/NativeTerminalTool.ts`; extender la canonicalización de `packages/tools/src/native/fs/PathValidator.ts:31` a las rutas declaradas por el usuario en la allowlist de permisos. **Responsable:** A2. | Ego: `SEC-05`, `SEC-09`, `CARP-03` | `GCLI-02` |
| `GCLI-07` | Futura | **Aislamiento nativo de proceso por SO (Seatbelt SBPL / `bwrap` / restricted tokens)** | `packages/core/src/sandbox/macos/baseProfile.ts:14-17,163-211` · `sandbox/macos/MacOsSandboxManager.ts:73-140` · `sandbox/linux/bwrapArgsBuilder.ts` · `sandbox/windows/WindowsSandboxManager.ts:61-106` | 3-5d | P1 | ⏳ Futura (Fase 11 / P1) | **Motivo del diferimiento:** exige toolchain nativa por sistema operativo (perfil SBPL en macOS, `bwrap` en Linux, restricted tokens + Job Objects con helper `GeminiSandbox.exe` compilado desde C# en Windows) y un modelo "lectura por defecto, escritura por aprobación" que Ego no aplica hoy a `terminal_exec`. Ego solo aísla el renderer (`contextIsolation`, `sandbox`) y valida rutas/comandos de forma léxica. **Fase destino:** Fase 11 (`SEC-05`), prioridad P1; condicionado a que el terminal nativo enlace con proceso real. La parte portable ya está cubierta por `GCLI-06`. **Responsable:** A2/A4. | Ego: `SEC-05` | `GCLI-06` |
| `GCLI-08` | Media | **Macros declarativas por fichero con pipeline de processors seguro** | `packages/cli/src/services/FileCommandLoader.ts:55-71,95-145,205-247,301-320,331-357,396-406` | 2d | P1 | 🆕 Pendiente | Sin fichero adaptado. Macros versionables en el repositorio, con esquema Zod (`prompt` + `description`), nombre derivado de la ruta sanitizado y precedencia usuario → proyecto (gateada por confianza) → extensiones; la inyección `@file` se ejecuta **antes** que la de shell para que el contenido inyectado no pueda generar rutas maliciosas, y `ConfirmationRequiredError` devuelve el control a la UI. **Cableado:** `packages/subegos/src/MacroLoader.ts` validado con `packages/integrations/src/skills/SkillLinter.ts` antes de registrarse. **No reutilizar** `packages/ui-runtime/src/SlashCommandParser.ts`: está descartado en `HERM-12` por duplicar `apps/desktop/renderer/components/composer-slash.ts`. **Responsable:** A4/A2. | Ego: `SUB-01`, `SUB-02`, `ACT-11`, `HERM-12` | `GCLI-05` |
| `GCLI-09` | Media | **TUI React Ink, acoplamiento Google (Code Assist / OAuth / Clearcut) y servidor A2A experimental** | `packages/cli/src/ui/` (`packages/cli/package.json:52`) · `packages/core/src/code_assist/` · `packages/core/src/telemetry/clearcut-logger/` · `packages/a2a-server/` | 0 | P1 | 🚫 Descartada (con justificación) | **TUI:** primitive de Ink para terminal, incompatible con el renderer Electron de Ego y con el principio de primitives de librería (`AGENTS.md` §4, D3); no aporta nada al Dynamic Workspace. **Code Assist + Clearcut:** dominio ajeno de Google; violan los principios 7 (multi-modelo + Model Router propio) y 9 (local-first y propiedad de datos) e introducirían un proveedor propietario y telemetría saliente. **A2A server:** experimental (`packages/a2a-server/README.md:3`) y sin equivalente canónico — `packages/integrations/src/mcp/` (`McpClient.ts`, `McpServer.ts`, `McpManager.ts`) ya cubre MCP cliente + servidor; incorporarlo sería duplicación y sobreingeniería. **Nótese** que `GCLI-07` no es un descarte: es un diferimiento explícito a Fase 11. | Ego: — (guardrails §4, principios 7 y 9) | — |

---

## 3. Integración en el Flujo de Construcción de Ego ##

Cada tarea `GCLI-*` se ejecuta como **pre-requisito de diseño y código** de las fases del Backlog
Maestro (`docs/roadmap/Backlog.md`):

```text
FASE 01 CORE (CORE-06, CORE-07)  ──────►  GCLI-04  contexto jerarquico + dedup
                                        GCLI-05  veredicto de confianza del workspace
FASE 02 ACT  (ACT-01, ACT-06, ACT-09) ───►  GCLI-03  policy engine con reglas priorizadas
                                        GCLI-06  gobernanza intocable + secretos negados
FASE 03 SUB  (SUB-01, SUB-02)      ──────►  GCLI-08  macros por proyecto
FASE 06 KB   (KB-01, KB-11)        ──────►  GCLI-04  persistencia de los hechos en VantaDB
FASE 11 SEC  (SEC-05, SEC-09)      ──────►  GCLI-01 [OK]  GCLI-02 [OK]
                                        GCLI-03  GCLI-05  GCLI-06
                                        GCLI-07 [FUTURA P1]  aislamiento nativo por SO
DESCARTES (sin destino en el backlog) ──►  GCLI-09  TUI Ink / dominio Google / A2A
```

### Protocolo de Extracción por Tarea ###

1. **Lectura y Aislamiento:** inspeccionar el fichero fuente en `repos-referencia/gemini-cli/`,
   identificando dependencias externas (TOML, `shell-quote`, `proper-lockfile`, SDK de MCP).
2. **Eliminación de Acoplamiento y reescritura canónica:** descartar el sustrato de ficheros (la
   política y la confianza se persisten en VantaDB), el proveedor de modelo único y la telemetría
   saliente; escribir el módulo en TypeScript estricto dentro de `packages/` o `apps/desktop/`, con
   tipado estricto y las directrices de `AGENTS.md`.
3. **Verificación:** cubrir con tests unitarios y de error antes de integrarlo en el flujo principal
   (regla de deny-gana y fail-closed).
4. **Cierre de Tarea:** marcar `✅ Completada` **solo** con fichero adaptado + caller en producción
   verificado por grep; si el patrón no aplica, `🚫 Descartada (con justificación)`; si no hay
   fichero, `🆕 Pendiente` con el cableado exacto y su responsable; si exige infraestructura aún no
   presente, `⏳ Futura (fase)`.

---

## 4. Deuda abierta derivada de esta verificación (→ handoff) ##

| # | Ítem | Tipo | Owner | Bloqueante |
| --- | --- | --- | --- | --- |
| D1 | `GCLI-03`: `packages/security/src/ToolPermissions.ts` sigue aplicando una cadena de `if` fija; no admite reglas priorizadas, identidad MCP/subagente ni degradación por heurística de shell | Código | A2 | No |
| D2 | `GCLI-05`: no existe veredicto de confianza de workspace en Ego; la política de permisos no puede degradarse por origen del proyecto | Código | A2 | No |
| D3 | `GCLI-06`: `.env*` y los ficheros de gobernanza del repositorio no están protegidos frente a herramientas nativas; solo lo están los directorios reservados del sistema | Código | A2 | No |
| D4 | `GCLI-08`: no hay canal de macros declarativas por proyecto; `packages/ui-runtime/src/SlashCommandParser.ts` sigue sin caller tras `HERM-12` | Decisión | A4/A2 | No (complementa `HERM-12`) |
| D5 | `GCLI-07`: el aislamiento de proceso del terminal es solo léxico; `terminal_exec` no aísla el proceso hijo | Decisión | A2/A4 | Sí (Fase 11, P1) |
| D6 | `GCLI-04`: el contexto de proyecto no tiene resolución jerárquica; el Project Memory Graph (`packages/knowledge/src/ProjectMemoryGraph.ts`) no se puebla desde el árbol de trabajo | Código | A2/A5 | No |
