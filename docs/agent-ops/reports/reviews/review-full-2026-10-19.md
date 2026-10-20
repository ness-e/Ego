# Unified Review — full — 2026-10-19

**Profile:** Ego (detección automática) · **Modo:** full · **Quality Gate:** ❌ FAIL
**Alcance:** repo completo (18 paquetes + `apps/desktop` + 266 docs + 9 repos de referencia)
**Método:** 8 auditores Flash de solo lectura en paralelo (A1–A8) + verificación propia del orquestador sobre los hallazgos críticos.
**Documento de contraste:** `docs/research/Arquitectura y Diseño de Sistemas para Plataformas y Agentes de IA.md` (22 secciones)

---

## Resumen ejecutivo

Ego es un producto real, no un prototipo. La ingeniería por paquete es sólida y verificable: 603 tests en el núcleo, 678 en las capas de ejecución, typecheck estricto en verde, cero `@ts-ignore`, cero TODOs reales, cero secretos reales en el repo, gates mecánicos fail-closed (`verify-dist.cjs`, `ensure-fresh-dist.cjs`), y una security posture Electron correctamente endurecida (`contextIsolation`/`sandbox`/`nodeIntegration` correctos, CSP doble, deny-by-default en `window.open`, 79/79 handlers IPC con validación Zod).

**El problema no es la calidad del código: es la falsedad del estado.** Tres capas de verdad están rotas y ninguna está protegida por un gate que corra:

1. **CI nunca se ejecuta.** Los 6 workflows disparan sobre `branches: [main]`; la rama del repo es `master`. Solo corren los dos que se disparan por cron. El pipeline de verificación —lint, typecheck, test, build— no se ha ejecutado jamás en push. Por eso `pnpm test` puede estar en rojo y nadie lo sabe.
2. **Dos de los siete commits del Plan P0 arreglaron código que no se instancia.** `ContextCompactionJob`, `DreamConsolidator`, `DelegationRouter` y `MemoryCurator` tienen **0 instanciaciones** en todo `src/` (verificado). El P0 elevó la calidad interna de módulos que no están en el producto.
3. **El P0 introdujo una regresión en la superficie principal.** `ego-chat.tsx:1560` renderiza `ThreadPrimitive.MessageByIndex` dentro de un `Virtualizer` (`ego-chat.tsx:1543`) que itera un array local de React. El índice del virtualizador y el índice del store de assistant-ui se desincronizan al añadir un turno, y `useClientLookup` lanza `index out of bounds`. El test del P0 solo monta 200 mensajes estáticos: nunca ejercita el append.

A esto se suma un hallazgo legal sin cerrar: el motor de avatar se deriva de código MIT de terceros, **7 ficheros de fuente remiten a un `LICENSE.md` que no existe** en ninguna de las dos copias dentro de Ego, y uno de ellos (`ara-head.js`) es declarado "COPIA LITERAL" de `agent-robot-avatar/core.js`.

La alineación con el documento maestro se estima en **~43 % bruto / ~57 % contra el subconjunto adaptado al alcance Ego**. Las cifras previas (51 % y 68 %) son sobreestimaciones: compararon contra las 22 secciones completas sin descontar las ~4 que ADR-0011 ya descartó formalmente.

---

## Scoreboard

| Auditor | Ámbito | Veredicto | Nota /10 | Hallazgos C/H/M |
|---|---|---|---|---|
| **A1** | Salud documental | ⚠️ | 5.5 | 2 / 7 / 9 |
| **A2** | Núcleo cognitivo (9 paquetes) | ⚠️ | 5.5 | 2 / 9 / 8 |
| **A3** | Capas de ejecución y producto | ⚠️ | 6.5 | 1 / 6 / 9 |
| **A4** | Desktop: main / preload / renderer | ❌ | 5.5 | 1 / 6 / 11 |
| **A5** | Extracción de repos de referencia | ⚠️ | 6.0 | 2 / 6 / 11 |
| **A6** | Subsistema avatar | ❌ | 5.5 | 2 / 5 / 7 |
| **A7** | Calidad / CI / seguridad / deps | ❌ | 4.5 | 6 / 3 / 11 |
| **A8** | Documento maestro (22 secciones) | ⚠️ | 5.5 | 0 / 4 / 9 |
| **ORQUESTADOR** | Consolidación | ❌ **FAIL** | **5.3** | **16 / 46 / 75** |

**Quality Gate:** ❌ FAIL — 16 hallazgos críticos, uno de ellos bloqueante de release (CI inerte).

---

## Top hallazgos críticos

### 🔴 C-01 — CI inerte: los 6 workflows apuntan a una rama inexistente
**Verificado por el orquestador.** `.github/workflows/ci.yml:5` (`push: branches: [main]`) y `:7` (`pull_request: branches: [main]`); `release-please.yml:7` idéntico. La rama real es `master` (`git branch -r` → solo `origin/master`).
**Consecuencia:** el job `verify` (lint + typecheck + test + build) no se ejecuta jamás en push. `coverage.yml` y `nightly.yml` corren por cron; `docs-lint.yml` corre en PR; `smoke-native.yml` corre por `workflow_dispatch`.
**Impacto:** todo lo demás de esta tabla es invisible para el equipo. Nada de lo que sigue está protegido.
**Acción:** `branches: ['main','master']` en los 6 workflows. 15 minutos.

### 🔴 C-02 — `pnpm test` está en ROJO y el gate que lo detectaría no corre
**Verificado por A7 (ejecutado).** `tests/e2e/floating-minimize.test.ts:281,296` — 2 asserts que inspeccionan texto de fuente obsoleto (`shouldAutoShow(floatingSnapshot())` ya no existe; `floating.html` ya no tiene `id="ticker"`). El test se creó en `24e6a6d`; el código cambió en `d50a050`.
**Nota crítica:** 25 ficheros de test (8 % del total) hacen `expect(src).toContain(...)` sobre el código fuente. Un refactor rompe el test sin cambio de comportamiento — exactamente lo que pasó aquí. Es la causa raíz de la clase de fallos "verde que no significa nada".

### 🔴 C-03 — Regresión P0: el chat revienta con >60 mensajes + envío de turno
**Verificado por A4 y A8, confirmado por el orquestador.** `apps/desktop/renderer/components/ego-chat.tsx:1543` (`<Virtualizer>`) → `:1560` (`<ThreadPrimitive.MessageByIndex index={index}>`). El `Virtualizer` itera el array local `messages` (estado React), pero `MessageByIndex` resuelve contra `aui.thread.message({index})` (store de assistant-ui). Al añadir un turno, el store se actualiza un tick después → desync → `useClientLookup: index 71 out of bounds (length: 70)`.
La librería documenta la alternativa correcta para windowing: `ThreadPrimitive.Unstable_MessageById` ("renders null rather than throwing"). Además el `MessageRenderBoundary` (`:72`, `:137`) **no envuelve** al `MessageByIndex` (`:1560`), así que el throw escapa.
**El test del P0 (`ChatVirtualization.test.tsx:92`) solo monta 200 mensajes estáticos — nunca exercise el append.** El caso que falta es exactamente el que rompe.

### 🔴 C-04 — Dos de los siete commits del P0 arreglaron código muerto
**Verificado por el orquestador (búsqueda recursiva en `apps/desktop/src` + `packages/*/src`, excluyendo `test/`).**

| Símbolo | Instanciaciones en src | Estado |
|---|---|---|
| `new ContextCompactionJob` | **0** | código muerto — el commit `86c4f80` ("LLM inyectable") no llega al producto. `main.ts:2387` solo *archiva* el historial en `kb/history_archive` sin compactar ni resumir |
| `new DreamConsolidator` | **0** | código muerto — el commit `1532e38` mejoró una clase que no se ejecuta. `MemoryCurator` tampoco se instancia |
| `new DelegationRouter` | **0** | código muerto — la delegación de Sub-Egos no existe en producción pese a estar declarada |
| `registerDelegationTools` | 0 (solo la *definición* en `DelegationTools.ts:330`) | 6 tools de delegación nunca registradas |
| `new MemoryCurator` | **0** | código muerto |
| `new ProactivityEngine` | 1 (`main.ts:3175`) | instanciado pero **0 triggers** registrados → ni cron ni file-watch disparan |
| `new ToolExecutionLoop` | 1 (`main.ts:3290`) | ✅ cableado |

### 🔴 C-05 — 64 advisories de seguridad, 4 críticos
**Verificado por A7 (`pnpm audit --json`).** 4 críticos (`tinypool` ×2 RCE por prototype pollution, `node-tar` DoS, `vitest` UI ejecución arbitraria) + 24 altos (`electron` ×10 — la rama 33.4.11 es **EOL** con 25+ CVE; `node-tar` ×7 traversal; `vite` bypass de `fs.deny`; `electron-updater` fuga de credenciales). `AGENTS.md` §4 exige "renderer untrusted" y "acciones sensibles requieren aprobación".
**No hay `pnpm audit` en CI.** Agrava C-01: nada lo bloquearía aunque se arreglara.

### 🔴 C-06 — Violación de licencia MIT activa en el motor de avatar
**Verificado por A6.** El upstream `repos-referencia/avatar` es MIT y su `LICENSE.md` es una **tabla de atribuciones obligatoria** que declara cada fichero derivado de MIT de Louis Raillart (coucou) y CX ArtLab (agent-robot-avatar). Ni `packages/avatar/` ni `apps/desktop/renderer/floating/vendor/avatar/` incluyen `LICENSE` ni `LICENSE.md`, pese a que **7 ficheros de fuente remiten a `LICENSE.md`** y `src/render/ara-head.js:2-3` es declarado "COPIA LITERAL" de `agent-robot-avatar/core.js:261` bajo MIT.
La cláusula MIT exige incluir el aviso de copyright en todas las copias. Esto debe cerrarse **antes de cualquier distribución pública** (repo Apache-2.0 + terceros MIT) y antes del Definition of Done de `AGENTS.md` §4.

### 🔴 C-07 — Triple copia del motor de avatar, ninguna canónica
**Verificado por A6 + A5 + A7.** Hay tres copias: `repos-referencia/avatar/src` (upstream, 9 964 LOC), `packages/avatar/src` (byte-idéntica a la vendorizada, **38/44 idénticos al upstream, 6 bifurcados — Ego va por delante**), y `apps/desktop/renderer/floating/vendor/avatar/` (la que **efectivamente se ejecuta**).
**`packages/avatar` es un paquete huérfano**: 0 imports de `@ego/avatar` en todo el repo; `pnpm-lock.yaml` lo lista con `{}`; está fuera del grafo de chunks de Vite. `packages/avatar/package.json` tiene `typecheck: node -e "process.exit(0)"` (no-op), `build` que emite un stub de 33 B, y **sin script `test`** → los 265 tests del upstream no se ejecutan jamás en Ego.
Además, A5 detectó que el motor contiene **puertos verbatim del HTML "Mochi"** (`packages/avatar/src/studio/render/{body,ears,eyes,mouth,accessories}.js`) y conserva el preset `'coucou-mochi'` (`avatar-element.js:2052`), contradiciendo la decisión canónica *"ningún nombre, dibujo, sonido ni icono de Mochi entra al producto"* y la regla "no copiar código directamente — extraer patterns y adaptar".

### 🔴 C-08 — Lectura arbitraria de disco desde el renderer (4 handlers IPC)
**Verificado por A4.** `PathValidator` y `resolveScopeDirs()` existen en `main.ts:1834/1920` pero se aplican **solo** en `ipc.terminal.spawn`:

| Canal | Línea | Alcance |
|---|---|---|
| `ipc.knowledge.ingest` | `main.ts:4648` | `filePath` = `z.string().optional()` sin scope → `fs.readFile` de **cualquier ruta del SO** |
| `ipc.knowledge.explainArtifact` | `main.ts:4655` | ídem (lectura de disco indirecta) |
| `ipc.skills.listLocal` | `main.ts:4081` | `searchPaths`/`projectRoot` del renderer sin scope → escaneo recursivo de rutas arbitrarias |
| `ipc.domains.engineering.status` | `main.ts:4942` | `workspaceRoot` sin validar → `scanWorkspace()` + `getGitStatus()` + `listWorktrees()` sobre cualquier ruta |

### 🔴 C-09 — SSRF + fuga del token Bearer en `ipc.net.fetch`
**Verificado por A4.** `main.ts:2797` → `isAllowedFetchUrl` solo comprueba protocolo + credenciales embebidas + loopback. El `validateSSRFUrl` de `packages/security/src/netPolicy.ts` (que bloquea RFC1918 y `169.254.169.254`) **nunca se invoca**. Y el handler inyecta `Authorization: Bearer <EGO_API_TOKEN>` al host arbitrario solicitado.
Relacionado: `McpClient.ts:347` → `env: { ...process.env, ...env }` — el **token real** viaja al subproceso MCP. No existe proxy `{{SECRET:…}}`.

### 🔴 C-10 — Falsos verdes en el backlog de extracción
**Verificado por A5.** `docs/review/backlog-openclaw.md:50-51` marca **OCLW-16** (`packages/tools/src/HotReloadToolLoader.ts`) y **OCLW-17** (`packages/tools/src/WorkspaceFileWatcher.ts`) como "✅ Completada" — **ninguno de los dos ficheros existe** (`Select-String "HotReload|FileWatcher|watch("` en `packages/` → 0 coincidencias). `docs/roadmap/Backlog.md:42` sigue anunciando "hot-reloading de tools y file watcher".
Otros: KHOJ-04 (`FactExtractor`) "Completada" sin un solo consumidor; `DataContract` (CARP-01) y `UntrustedContentSanitizer` (CARP-04) sin caller; `SchemaMigrator` (DSEK-04) sin caller; `getVersionHistory`/`getAtTimestamp` (DSEK-02) sin caller.
**Y el guardrail duro de `AGENTS.md` §4 no se cumple: 0 filas `🚫 Descartada (con justificación)` en los 7 backlogs de revisión (81 filas).** 32 patrones están "asimilados pero no cableados" — sin terminar en ✅ ni 🚫, exactamente el limbo que el protocolo prohíbe.

---

## Hallazgos de alta severidad (46)

### Seguridad
- **A4** — `ipc.llm.cancel` (`main.ts:3878`) es **fail-open**: si Zod falla, `turnId` queda `undefined` → aborta **todos** los turnos en vez de rechazar el payload.
- **A4** — `ipc.floating.toggle` (`main.ts:5116`) usa type assertion sin Zod; `FloatingToggleSchema` existe en `ipc.ts:140` y está muerto. Acepta cualquier string fuera de la unión.
- **A3** — La ruta del agente de terminal (`NativeTerminalTool.ts:51-57`) usa **solo denylist de 6 regex**; la allowlist `TERMINAL_SAFE_COMMANDS` se aplica únicamente al panel interactivo (`main.ts:5194`). Bypass trivial: `rm -fr /`, `Remove-Item -Recurse -Force C:\`, `cmd /c del /s /q`, `powershell -enc`.
- **A3** — `NativeTerminalTool.ts:75` → `env: { ...process.env }` inyecta el entorno completo (tokens, rutas) al subproceso PowerShell.
- **A2** — `UntrustedContentSanitizer.ts:22-58` = 7 regex, **solo en inglés**; sin taint tracking, sin P-LLM/Q-LLM, sin dual-LLM. La cápsula `<untrusted_content>` no genera ninguna marca que el runtime consuma.
- **A8 (B6)** — El sanitizador **no neutraliza lo que detecta**: los patrones incluyen `instruction`, `developer_mode`, `ego_internal` (`:40`) pero `wrapUntrustedContent` solo neutraliza `system`, `prompt`, `tool_call` (`:109-112`). Fuga directa.
- **A8 (B9)** — Sin DOMPurify ni CSP en el chat (lo que el doc §21.2 exige explícitamente). No hay `img-src` → el vector de exfiltración por Markdown image sigue abierto.
- **A7** — 5 de 6 workflows sin bloque `permissions:`; 48 acciones `uses:` sin pin de SHA; sin `dependabot.yml`, sin `CODEOWNERS`, sin `actionlint`.

### Producto / arquitectura
- **A3** — Solo **6 tools** registradas en producción (`fs_read_file`, `fs_write_file`, `git_status`, `git_diff`, `terminal_exec`, `canvas_render`), pero los manifiestos de los 5 dominios y los templates de Sub-Ego declaran **20+ nombres de tool que no existen**.
- **A3** — Ego **no implementa MCP Server**, contra `AGENTS.md` §7 ("Ego = MCP Client + MCP Server"). 0 handlers `tools/list`/`resources/list`/`prompts/list` propios.
- **A3** — El Dynamic Workspace **no es dinámico**: `DomainCanvasView.tsx` resuelve con 10 ramas `domainId === "..."` hardcodeadas; `componentKind` (15 views declaradas) es metadato muerto (0 matches en el renderer).
- **A3** — `ComponentRegistry` (`canvas/registry.ts:49-61`) es un `Record` estático y cerrado de 11 tipos: no hay hot-swap ni registro dinámico.
- **A3** — `McpManager.ts:116-119` → `connectServer` pasa siempre `overrideExisting: true` → un servidor MCP puede **sobrescribir una tool nativa** (`fs_read_file`, `terminal_exec`).
- **A3** — No existe `manage_background_task`: el agente no puede lanzar ni governar tareas en background (la `BackgroundEngine` es API in-process sin tool ni IPC).
- **A2** — El **Cognitive Path no existe**: `assembleContext/recall/consolidate/reinforce/checkpoint` del contrato `EgoMemory` no están implementados y `vantadb-mcp` **no se invoca en ningún punto del repo**. `memory_recall` es solo un string en los manifiestos.
- **A2** — `DecisionCascade` (niveles 2 y 3 de la cascada de decisión) es **código muerto**: `main.ts:3103` usa `new DecisionRouter()` (1 nivel, regex). `JevProvider` solo aparece en tests.
- **A2** — `ModelRouter`: sin backoff exponencial con jitter ante 429 (solo rota credencial, y puede repetir la misma key); el fallback "a cualquier modelo disponible" **ignora `requiredCapabilities`** (puede devolver un modelo sin `tool_calling` a quien lo exige); `maxCostPerCallUsd` se configura y **nunca se lee**.
- **A2** — `HybridSearch.ts:116` — MMR **decorativo**: relevancia = score BM25 sin acotar (0..>10) frente a Jaccard ∈[0,1] → con λ=0.7 la diversidad pesa ≤0.3 y nunca cambia el orden. Y usa Jaccard de *palabras*, no coseno.
- **A2** — `GraphRagEngine.ts:137-145` — la expansión **consulta la BD de verdad** (✅ commit `1532e38` correcto) **pero el descubrimiento de la arista sigue siendo heurístico**: metadata (`supersedes`, `doc_id`) + regex `\b(doc_[a-f0-9]{8,16}|fact_…)\b` (`:211-251`). El 2.º salto no consulta el grafo.
- **A2** — `graphQuery` (IQL) y `insertNode/addEdge/getNode` tienen **0 callers**: el "grafo" no usa el grafo de VantaDB.
- **A2** — Ejecución de tools **en serie** (`ToolExecutionLoop.ts:387`, `for … await`) desaprovechando `maxConcurrentExecutions: 5`.
- **A3** — `DailyStateEngine.ts:44` — contadores no paginados: `decisionsCount` = longitud de una página de 50, no del namespace; 5 `catch {}` silenciosos convierten un fallo de lectura en "0 aprobaciones".
- **A3** — `apps/desktop/renderer/components/sub-egos.tsx:108-144` — el renderer **escribe directo en memoria** para editar/borrar Sub-Egos, saltándose la validación de manifiesto del main.
- **A3** — `DreamConsolidator.ts:125` — `JSON.parse(fact.payload)` sin try/catch dentro del bucle: un payload corrupto aborta el lote y el `catch {}` externo lo silencia → dedup parcial e invisible.

### Documentación / trazabilidad
- **A1** — `docs/roadmap/roadmap.md:63-89` afirma **"0 de 6 tareas completadas"** en Fase 03.1 mientras `Backlog.md:27` marca 6/6 ✅. Contradicción directa entre los dos documentos de estado.
- **A1** — **40 rutas citadas en docs canónicos no existen** (37 en la columna `Archivo:línea` del Backlog — patrón dominante: falta el segmento `src/`; `apps/desktop/renderer/components/shell.tsx` no existe en absoluto).
- **A1** — Colisión de numeración ADR: `0006-approval-identity.md` y `0006-docs-site.md`. 6 de 12 ADRs no están en `docs/index.md`. ADR-0001 dice "SUPERSEDED by T11" en el cuerpo pero su campo `Estado` sigue "Aceptado".
- **A1** — **5 decisiones ya en producción sin ADR**: CodeMirror 6, `virtua`, Radix Select, Shiki Web Worker, `ContextCompaction` con LLM inyectable. Y `stack-tecnico.md:57` sigue declarando "Monaco Editor" (0 hits de `monaco` en ningún `package.json`).
- **A1** — `packages/avatar` **no aparece en ningún documento canónico**; `docs/product/mascota.md:10` afirma que "el personaje NO es un avatar" y lo sitúa en `components/character/`. Coexisten **dos motores de personaje** vivos.
- **A1** — `AGENTS.md:79-93` desactualizado: lista 6 paquetes (hay **18**) y "128 archivos .md" (hay **266**).
- **A1** — `CHAR-03` marcada "✅ Completada" cita `docs/research/character-prototypes/character-prototypes.html` — **el artefacto no existe**.
- **A1** — El documento maestro está **duplicado byte-idéntico** en la raíz del repo y en `docs/research/`, ambos **sin trackear en git**. `git log --all -- "*Arquitectura*"` → vacío.
- **A5** — `docs/extractions/README.md:66-72` declara rangos obsoletos (COUC-01..16 vs 22 reales; HERM-01..19 vs 22; OCLW-01..15 vs 17; KHOJ-01..05 vs 6). `Backlog.md`, `review/README.md` y `extractions/README.md` dan **tres recuentos distintos** de las mismas tareas.
- **A5** — `WorkbenchView.tsx:88` apunta a `packages/memory/src/SessionLifecycleLocks.ts` — **`packages/memory/src/` no existe** (los ficheros están en la raíz del paquete).
- **A5** — `NetPolicy` real (`packages/tools/src/native/security/NetPolicy.ts`) **sin caller**; la política viva es una "réplica léxica" en `packages/security/src/ToolPermissions.ts:147,346` **sin DNS**.
- **A6** — `docs/architecture/character-system.md` y `docs/product/character-art-direction.md` describen el motor **legacy** (`CharacterEngine`): 0 menciones de `@ego/avatar`. `character-system.md:15` dice "motor real (~2000 líneas) pero 0 tests dedicados" — son 998 líneas y hay 2 ficheros de test.
- **A6** — `CharacterCanvas.tsx` y `CharacterMiniBadge.tsx` están **definidos y nunca renderizados** (0 usos JSX). La `CharacterStateMachine` de 14 estados nunca se instancia: solo se importa su *tipo*.

### Calidad / CI
- **A7** — `vantadb-node: file:../../../VantaDB/vantadb-node` → dependencia **fuera del repo**; CI compila un **stub no-op** (`put(){}`/`get(){return null}`) → el CI "verde" nunca ejercita VantaDB real. 3 workflows hacen checkout de `ness-e/Vantadb@develop` (rama mutable) → build no reproducible.
- **A7** — `tests/gui` **no es miembro del workspace pnpm** → `pnpm -r test` nunca corre la suite Playwright (16 specs). Además 12 de 13 specs están `test.describe.skip("requiere backend Electron vivo")`.
- **A7** — `.oxlintrc.json` solo activa **7 reglas `deny`** de corrección. No hay `no-explicit-any`, `no-empty`, `no-console`. `pnpm lint` no usa `--max-warnings` → 136 warnings no bloquean.
- **A7** — 12 `any` en producción sin justificación (viola `AGENTS.md` §4), incluidos 5 `as any` en `ApprovalEngine.ts:393-422` (mutan identidades de aprobación — **ruta sensible de seguridad**).
- **A7** — 18 `catch {}` vacíos (13 en producción), 59 llamadas sync I/O en `packages/*/src`, 10 `eslint-disable-next-line` **huérfanas** (reglas de ESLint que oxlint no ejecuta → no suprimen nada).
- **A7** — 47 ficheros duplicados byte-idénticos (46 del avatar vendorizado + `TerminalSessionStore.ts`) **sin script de sincronización** → divergencia silenciosa garantizada.
- **A8 (B5)** — 6 hallazgos WCAG AA vivos en 3 de 4 presets (bordes 1.59–2.14:1, texto 2.24–4.43:1) registrados como `it.fails` — el rojo es *esperado*, la deuda persiste sin SLA.

---

## Refutaciones: afirmaciones previas que resultaron incorrectas

| Afirmación previa | Realidad |
|---|---|
| "GraphRAG no consulta la BD" | **REFUTADA.** `GraphRagEngine.ts:137-145` llama `adapter.get(ns, key)`. (Matiz: el *descubrimiento* de la arista sigue siendo heurístico por metadata+regex.) |
| "DreamConsolidator ignora lo que pase de 50" | **REFUTADA en código.** Paginación por cursor real (`listPaged` → `db.list({namespace, limit, cursor})`). (Matiz: la clase no se instancia → irrelevant en producto.) |
| "Chat sin virtualizar" | **REFUTADA** — pero con regresión de crash. |
| "Sin Web Workers" | **REFUTADA.** `workers/shiki.worker.ts` existe y el bundle genera el chunk. |
| "Editor ProseMirror" | **REFUTADA.** CodeMirror 6 real. (Matiz: `renderer/package.json` **sigue declarando** `prosemirror-model|state|view` y `vite.config.ts:37` mantiene el chunk `vendor-prosemirror` → deuda muerta del propio P0.) |
| "`query_vector: []` es un bug" | **REFUTADA como bug.** Es un *workaround upstream registrado* (`Workaround: VDB-REQ-02`); los guards de VantaDB exigen array aunque la búsqueda sea BM25 puro. |
| "Select usa Radix" (mensaje del commit `87fc3ad`) | **REFUTADA.** `Select.tsx` es **custom** (role=combobox/listbox/option propio). `@radix-ui/react-select` está en `package.json` pero **nadie lo importa** (0 usos). El mensaje del commit afirma algo falso. |
| "Se eliminaron los `<select>` nativos" (commit `87fc3ad`) | **REFUTADA.** Quedan **7**: `DomainCanvasView.tsx:536,548,670`, `ShortcutsPanel.tsx:126`, `FormView.tsx:97`, `QueryView.tsx:79`, `CronPanel.tsx:158`. `Targets44.test.tsx` solo cubre Sidebar/App/SettingsModal. |
| "44px aplicado" (commit `87fc3ad`) | **REFUTADA.** Regresión STAB-13 **parcialmente** corregida: `App.tsx:240` sigue en `h-7 w-7` (28 px), `ActivityTray.tsx:352,362,372` en `min-h-[28px]`, y `ui-kit/Button.tsx:56` **fuerza** `min-h-[28px]` — con `ui-kit-nine-states.test.tsx:86` **afirmando** ese valor. El test codifica la regresión. |
| "ZeroContextKernel está en `packages/tools/src/sandbox/`" | **REFUTADA.** Vive en `packages/execution/src/ZeroContextKernel.ts` y está bien endurecido (worker + `node:vm`, null-proto, `codeGeneration` off, bridge eliminado, watchdog, `maxToolCalls`). |
| "El sanitizador es el problema" | **MATIZADA.** El problema mayor es que **no neutraliza lo que detecta** (A8/B6), no el número de regex. |

---

## Estado real del Plan P0 (7 commits)

| Commit | Prometía | Realmente hace | Veredicto |
|---|---|---|---|
| `1532e38` | GraphRAG real + paginación de Dream | GraphRAG consulta la BD ✅ (descubrimiento de arista sigue heurístico). Dream pagina ✅ **pero la clase no se instancia** | ⚠️ **Mitad** |
| `86c4f80` | Compactación con LLM inyectable | Módulo de 520 líneas + 14 tests, **`compactSync()` ignora `opts.summarizer`** (cae al heurístico), `autoMemory` declarado y no implementado, **0 instanciaciones** | ❌ **Muerto** |
| `b411524` | fs/promises en hot paths | `NativeFsTool` y `CrashRecoveryEngine` migrados ✅ (spies verifican 0 llamadas sync). **Persisten** `FileLockManager` (6 sync), `PathValidator.existsSync`, `SkillScanner`, `SnapshotManager`, `SchemaMigrator` | ⚠️ **Parcial** |
| `a31a4b5` | Virtualización con `virtua` | Mecánica correcta (`Virtualizer` + `keepMounted` + umbral 60). **PERO introduce crash** en >60 msgs + append | ❌ **Regresión** |
| `87fc3ad` | Radix Select + 44px + sin selects nativos | Select **custom** (no Radix). 44px parcial. 7 selects nativos vivos. El test afirma 28px | ⚠️ **Parcial + mensajes falsos** |
| `85d87f1` | Inventario de skips + contraste WCAG | 25 tests verdes, ratios WCAG deterministas ✅. 6 `it.fails` = deuda viva. Paletas **hardcodeadas en el test** (divergen del CSS en silencio) | ✅ **Correcto con deuda** |
| `135afdc` | CodeMirror 6 + Shiki Web Worker | CodeMirror real ✅. Worker existe ✅ pero `manualChunks` mete shiki en `vendor-shiki` (**9.87 MB**) importado **estáticamente** en el chunk index → el offload no reduce el bundle. `EditorView` **no persiste cambios** (sin `onChange`) y remonta en cada cambio de `props.code` | ⚠️ **Parcial** |

**Balance: 0 de 7 commits llegan íntegros a la superficie del producto.** 3 son correctos, 3 parciales y 1 es una regresión.

---

## Estado por fase del roadmap

Estimación sobre el Backlog Maestro (`docs/roadmap/Backlog.md`, 151 tareas canónicas + 17 `EGO-FIND-*`):

| Fase | Requisito de AGENTS.md | Estado real |
|---|---|---|
| 01 Core | chat + memoria + streaming + persistencia | 🟢 Base sólida. Falla la compactación (no integrada) |
| 02 Acción | tool calling + execution manager + approval | 🟡 ExecutionManager ✅ (timeout/abort/cuota). Faltan tools avanzadas, `manage_background_task`, ejecución paralela |
| 03 Sub-Egos | crear + ejecutar + memoria compartida + delegación | 🟡 Crear ✅, memoria compartida ✅, **delegación ❌ no cableada** |
| 04 Canvas | workspace dinámico + component registry | 🔴 **Registry estático**, workspace hardcodeado por dominio |
| 05 Intelligence | decision router + clasificación + fallback | 🟡 Router ✅, cascada de 3 niveles ❌ (1 nivel en producción) |
| 06 Knowledge | importar + búsqueda híbrida + data views | 🟡 Import ✅, **híbrida ❌** (BM25 puro + MMR decorativo) |
| 07 Tasks | background execution + proactividad | 🟡 Background ✅, **proactividad ❌ sin triggers** |
| 08 Daily State | briefing dinámico al abrir | 🟢 Funciona, con contadores imprecisos |
| 09 Dominios | Knowledge, Product, Engineering, Analytics, CRM | 🟡 5 dominios con sustancia ✅, pero allowlists apuntan a tools inexistentes |
| 10 Recovery | export/import + crash recovery + migraciones | 🟢 Lo más maduro del repo (heartbeat atómico, caos, bitemporal) |
| 11 Security | permisos, sandbox, IPC validation, audit | 🟡 Permisos ✅, IPC ✅ (79/79), **sandbox débil**, **4 fugas de path/SSRF** |
| 12 Distribution | installer + firma + auto-update | 🔴 Sin firma, sin auto-update, `vantadb-node` por `file:` |

---

## Extracción de repos de referencia

| Repo | Patrones declarados | ✅ Asimilado + en producción | ⚠️ Asimilado sin cablear | ❌ No existe | ⏳ Limbo | Nota |
|---|---|---|---|---|---|---|
| coucou | 22 | 10 | 11 | 0 | 1 (COUC-22) | 6.5 |
| hermes-agent | 22 | 14 | 7 | 0 | 1 (HERM-22) | 7.5 |
| khoj | 6 | 4 | 1 | 0 | 1 (KHOJ-06) | 7.0 |
| openclaw | 17 | 6 | 8 | **2** | 1 (OCLW-18) | **5.0** |
| helmor | 5 | 4 | 1 | 0 | 0 | 7.5 |
| career-ops | 4 | 2 | 2 | 0 | 0 | 6.0 |
| deepseek-harness | 5 | 3 | 2 | 0 | 0 | 6.5 |
| **Total** | **81** | **43** | **32** | **2** | **3** | **6.0** |

**Contaminación de dominio: LIMPIA ✅.** Cero entidades, schemas, constantes o imports del dominio ATS/empleos de `career-ops`; cero scrapers, `sentence-transformers`/`gte-small`, Twilio o Stripe de `khoj`. Los únicos hits de `khoj` son comentarios de atribución, y `bulk_import.py` es el sidecar propio de Ego. La regla dura de `AGENTS.md` §2 se respeta.

**Pero**: 32 patrones en limbo (asimilados sin cablear), 2 falsos verdes con fichero inexistente, 2 IDs huérfanos (COUC-22, OCLW-15), **0 filas `🚫 Descartada`** en los 7 backlogs, y el motor de avatar con puertos verbatim de Mochi.

---

## Subsistema avatar — respuesta directa

1. **Sí hay copia en Ego, y son tres**: upstream (`repos-referencia/avatar/src`), paquete (`packages/avatar/src`) y vendorizada (`apps/desktop/renderer/floating/vendor/avatar/`). Las dos de Ego son **byte-idénticas entre sí** (44/44, 0 diff).
2. **No es un espejo del upstream**: 38/44 idénticos, **6 bifurcados** (Ego va por delante: fix hsl→hex, `preset` en `observedAttributes`, `toSVGString()`, `setPointerFollow()`, preset `ego-nucleus`, DPR, `applyGenomeToStudio`).
3. **El motor está sano**: `node --test repos-referencia/avatar/tests/` → **265/265 pass** en 3.74 s.
4. **En Ego el motor está 0 % verificado**: sin `tests/`, sin script `test` → los 265 tests no corren jamás.
5. **`packages/avatar` es huérfano**: 0 imports de `@ego/avatar`; el runtime carga la copia vendorizada.
6. **`vendor/` no es dependencia de runtime** (0 imports; el propio `LICENSE.md` lo declara "solo referencia").
7. **El determinismo genoma→organismo es real**: `xmur3` + `mulberry32`, orden de extracción fijo, `deriveSeed` por capa, `uidFor` determinista. *"NINGÚN módulo de identidad usa Math.random()".*
8. **Los 14 estados runtime están conectados al chat real**: `ego-chat.tsx:773` → `approval_required`, `error`, `searching`, `using_tool`, `thinking`, `generating`, `listening`, `idle` — mapeados por `CharacterBadge.mapCharacterStateToAvatarState`.

---

## Métricas consolidadas

| Métrica | Valor |
|---|---|
| Paquetes workspace | 18 (`packages/`) + `apps/desktop` + `tests/gui` (**fuera del workspace**) |
| Documentos markdown en `docs/` | 266 (+1 duplicado en la raíz, sin trackear) |
| Ficheros de test | 304 (+16 specs Playwright) · ~1 936 bloques `it()` |
| Tests del núcleo (9 paquetes) | 603 |
| Tests de ejecución/producto (8 paquetes) | 678 |
| Líneas en god files | `main.ts` 5 401 · `avatar-element.js` 2 156 (×2) · `ego-chat.tsx` 2 067 · `EgoMemoryAdapter.ts` 1 208 · `DelegationRouter.ts` 997 · `ToolExecutionLoop.ts` 860 |
| Ficheros >800 líneas | 14 |
| `any` en producción | 12 (5 en `ApprovalEngine`, sin justificar) |
| `@ts-ignore` / `@ts-expect-error` | **0** ✅ |
| `catch {}` vacíos | 18 (13 en producción) |
| I/O síncrono en `packages/*/src` | 59 |
| `eslint-disable` huérfanas | 10 (reglas que oxlint no ejecuta) |
| TODO/FIXME/HACK reales | **0** ✅ |
| Duplicación byte-idéntica | 47 ficheros sin script de sync |
| Secretos reales en el repo | **0** ✅ (23 canarios sintéticos, con test de redacción) |
| Advisories de seguridad | 64 (4 críticos · 24 altos) |
| Reglas `deny` en oxlint | 7 (de ~50 posibles) |
| Tools registradas en producción | **6** (frente a 20+ declaradas en manifiestos) |
| Patrones de extracción en limbo | 32 / 81 |
| Hallazgos AA vivos | 6 (contrastados como `it.fails`) |
| Finds de contraste pendientes | 6 en 3 de 4 presets |
| Workflows que nunca disparan | 4 de 6 |

---

## Plan de remediación

### 🔴 Bloque 0 — Restablecer la capacidad de decidir (1 día)
Sin esto, todo lo demás es invisible.
1. `branches: ['main','master']` en los 6 workflows. *(C-01)*
2. Arreglar `tests/e2e/floating-minimize.test.ts` → `pnpm test` en verde. *(C-02)*
3. Añadir `pnpm audit --json` como job bloqueante + `permissions: {contents: read}` + pin de SHA en las 48 acciones.
4. Mover `tests/gui` al workspace pnpm y ejecutar la suite Playwright en el job `verify`.

### 🔴 Bloque A — Integridad de la remediación P0 (1 semana)
Cada entregable con test que falle hoy.
1. **A1 — Conectar o borrar la compactación**: instanciar `ContextCompactionJob` en `main.ts` con el `ModelRouter` como `summarizer`, o eliminarlo. Verificable: `grep -rn "new ContextCompactionJob" apps packages --include=*.ts | grep -v test` ≥ 1 + test que compacta un hilo >60 turnos.
2. **A2 — Arreglar la virtualización**: `ThreadPrimitive.MessageByIndex` → `ThreadPrimitive.Unstable_MessageById` (+ `unstable_useThreadMessageIds`), o clonar la lista local al store antes de renderizar. Añadir el test que falta: **60+ msgs + append → 0 excepciones**. *(C-03)*
3. **A3 — Conectar o eliminar `DreamConsolidator`, `DelegationRouter` + sus 6 tools, `MemoryCurator`**. Si `DelegationRouter` se conecta: registrar `registerDelegationTools(toolRegistry, router)` y añadir test de humo main→delegate. *(C-04)*
4. **A4 — Cerrar la regresión 44px**: `App.tsx:240`, `ActivityTray` ×3, `ui-kit/Button.tsx:56` → 44 px, y **corregir `ui-kit-nine-states.test.tsx:86` que hoy afirma 28 px**. Eliminar los 7 `<select>` nativos. **Reforzar `Targets44.test.tsx` para barrer todo el árbol**, no 3 componentes.
5. **A5 — Declarar la verdad en los mensajes de commit**: corregir `package.json` para que importe Radix o borrar la dependencia; añadir `onChange` a `EditorView` y separar mount/update; mover shiki a `shiki/core` con subset de langs para quitar los 9.87 MB del chunk inicial; limpiar el chunk `vendor-prosemirror` muerto.

### 🔴 Bloque B — Seguridad (1-2 semanas)
Es la sección del documento maestro con mayor retorno: **§11 es la única sección completa ausente que NO está descartada por decisión.**
1. **B1 — Cerrar las 4 fugas de path**: helper `assertPathInScope(p, workspaceRoot)` aplicado a `knowledge.ingest`, `knowledge.explainArtifact`, `skills.listLocal`, `domains.engineering.status`. *(C-08)*
2. **B2 — SSRF + token**: usar `validateSSRFUrl` de `@ego/security` en `ipc.net.fetch`; no adjuntar `Authorization` fuera de allowlist.
3. **B3 — Fail-closed en los 2 handlers permisivos**: `floating.toggle` → `FloatingToggleSchema.safeParse`; `llm.cancel` → rechazar payload inválido.
4. **B4 — Terminal**: aplicar la allowlist también en `NativeTerminalTool` con normalización + parseo del head PowerShell; `env` allowlist explícita (`PATH`, `SystemRoot`, `TEMP`, `HOME`).
5. **B5 — Taint tracking + canal P-LLM/Q-LLM** (doc §11.2): propagar el flag en `ModelMessage` y filtrar en el prompt assembly; corregir el sanitizador para que neutralice lo que detecta (`:109-112`); ampliar patrones ES.
6. **B6 — Secret proxy `{{SECRET:…}}`**: no pasar el token real al subproceso MCP (`McpClient.ts:347`).
7. **B7 — DOMPurify + CSP `img-src`** en el chat.
8. **B8 — Actualizar electron/tinypool/node-tar/vite/vitest**. *(C-05)*

### 🟡 Bloque C — Honestidad documental y de estado (1 semana, puede paralelizarse)
1. Reconciliar `roadmap.md` ↔ `Backlog.md` ↔ `PLAN-EGO.md` ↔ `index.md`.
2. Corregir las **40 rutas rotas** del Backlog (normalizar `src/`).
3. **5 ADRs nuevos** (CodeMirror 6, `virtua`, Radix Select, Shiki Worker, ContextCompaction-LLM) + renumerar el `0006` duplicado + corregir `Estado` de ADR-0001.
4. **Guardrail de descarte**: añadir `🚫 Descartada (con justificación)` a los 7 backlogs (81 filas) y resolver las 32 filas en limbo a ✅ o 🚫.
5. **Resolver OCLW-16/17** (fichero inexistente) y crear filas para COUC-22 / OCLW-15.
6. Actualizar `AGENTS.md` (18 paquetes, 266 docs) y `stack-tecnico.md:57` (Monaco → CodeMirror 6).
7. **Unificar el duplicado del documento maestro**: borrar la copia de la raíz, marcar `docs/research/` como "research externo — no normativo" con nota de conflicto con ADR-0011.
8. **Documentar `packages/avatar`** y resolver el doble motor de personaje (`CharacterEngine` vs `@ego/avatar`) con un ADR.

### 🟡 Bloque D — Avatar (1 semana)
1. **Licencia primero**: portar `LICENSE` + `LICENSE.md` a **ambas** copias; añadir `NOTICE`. *(C-06)*
2. **Portar `tests/`** (29 ficheros) y añadir `"test": "node --test tests/"` → 265/265 en CI. *(C-07)*
3. **Decidir la fuente canónica**: `packages/avatar` como canónico + script `sync:avatar` que genera el vendor con verificación SHA-256; o eliminar el paquete huérfano.
4. Portar `RESEARCH.md`, `demo/`, `captures/`, `vendor/` (como corpus de atribución, no runtime) → sanea los 6 enlaces rotos del README.
5. `build` y `typecheck` reales; `files`, `description`, `license`, `keywords` en `package.json`.
6. **Eliminar los puertos verbatim de Mochi** o registrar excepción formal del owner; normalizar las cabeceras al formato `Adapted from Louis-CFM/coucou (MIT), <ruta>`.
7. Reescribir `character-system.md` y `character-art-direction.md` contra `@ego/avatar`; eliminar `CharacterCanvas.tsx` / `CharacterMiniBadge.tsx` (0 usos).

### 🟢 Bloque E — Motor y deuda (post-Bloque A)
- Embeddings reales + RRF vía `vantadb-mcp` (cuando VantaDB 0.9+ lo permita) → convierte `query_vector: []` en búsqueda semántica real y arregla el MMR.
- `cache_control` en el provider Anthropic; routing por complejidad/multimodalidad con aliases `fast`/`smart`.
- Backoff exponencial con jitter + filtro de capabilities en los fallbacks del router.
- Herramientas en paralelo por tanda (`allSettled`); circuit breaker por tool MCP; quota por Sub-Ego.
- Tools FS avanzadas (`fs_read_file` con offset/limit, `fs_glob`, `fs_grep`, `fs_edit_patch` con dry-run) + `manage_background_task`.
- **MCP Server de Ego** (`tools/list` desde `ToolRegistry.list()`, `resources/list`, `prompts/list`) — cumple `AGENTS.md` §7.
- Component Registry dinámico + resolver `DomainView.componentKind` contra el registry (elimina las 10 ramas hardcodeadas).
- Descomponer `main.ts` (5 401 → <1 500) en `src/main/{bootstrap,ipc/*,subsystems/*,security/*,state/*}`.
- OKLCH + `docs/design/DESIGN.md` + `@container` + `prefers-contrast`; limpiar los 6 hallazgos AA.
- `correlationId` end-to-end + sink de disco para `StructuredLogger` y `DecisionTelemetry` (hoy 500 muestras en RAM).

---

## Desviaciones entre auditores (transparencia metodológica)

| Discrepancia | Resultado |
|---|---|
| ¿Radix Select? | **No usa Radix.** `Select.tsx` es custom; `@radix-ui/react-select` está declarado pero no importado (0 usos) |
| ¿`ZeroContextKernel` en `packages/tools`? | **No**: vive en `packages/execution/src/` y está mejor endurecido de lo que sugería el informe previo |
| ¿El upstream avatar es idéntico a la copia? | **No**: 6/44 ficheros bifurcados (Ego por delante) + working tree upstream sucio |
| ¿`ContextCompaction` está integrado? | **No** — confirmado por el orquestador: 0 instanciaciones en src |
| ¿La virtualización funciona? | **Mecánica sí, producto no** — crash al append |
| ¿El chat revienta en producción? | **Probable pero no reproducido en la app real** (el auditor reprodujo el `useClientLookup` en test; el find A4 lo reprodujo también en test) — la llamada real en la app requiere el backend Electron vivo, que está skipado |

**Límites de esta revisión:** no se ejecutó la app Electron real (E2E skipado), no se auditó `docs/agent-ops/reports/2026-10-13-auditoria-diseno-frontend-ego.md` (95 KB), no se evaluó el estado real de los runs de GitHub Actions (sin acceso a la API), y la alcanzabilidad de los 64 advisories no se confirmó contra el grafo de llamadas.

---

_Generado por la skill `unified-review` (modo full). 8 auditores Flash + verificación del orquestador. Hallazgos: 16 críticos · 46 altos · 75 medios · 31 bajos/info._
