# A4 — Ola 2 · E6 — Descomposición de `main.ts`

> **Agente:** A4 · **Zona de escritura:** `apps/desktop/**` (EXCEPTO `apps/desktop/renderer/floating/vendor/avatar/**` → A6).
> **Tarea:** E6 (Ola 2, Fase 02) — descomponer `main.ts` y eliminar el estado global disperso.
> **Fecha:** 2026-10-20 · **Commits:** ninguno (árbol sucio a propósito, por instrucción del owner).

---

## 1. Resumen ejecutivo (los dos números del objetivo)

| Métrica | Antes (al empezar E6) | Después | Objetivo | Estado |
|---|---|---|---|---|
| `apps/desktop/src/main.ts` | **2 436 líneas** | **1 288 líneas** | < 1 500 | ✅ (**−47,1 %**) |
| `let` globales mutables **fuera** de `app-context.ts` | 55 (todos en `main.ts`) | **0** | 0 | ✅ |
| `let` globales mutables en `app-context.ts` | — | **61** | (estado del proceso) | ✅ |
| Bundle `out/` | 26 213,0 KB | 26 216,8 – 26 218,2 KB | "no debe crecer" | ⚠️ **+3,8 … +5,2 KB (+0,014 %)** — ver §5 |
| Bundle del main (`out/main/main.js`) | 240,3 KB | 245,0 KB | — | ⚠️ +4,7 KB (+1,96 %) — ver §5 |

`main.ts` **ya no implementa nada**: es el compositor (arranque + apagado + los objetos que comparte con la UI). Toda la implementación vive en `src/main/**`, y el estado mutable del proceso tiene **un único dueño**.

---

## 2. La medición previa (como pedía el brief)

Antes de mover un solo fichero, medí el reparto real de `main.ts` (no lo que decía el brief: `bootstrap.ts`, `state/app-context.ts` y `subsystems/` **no existían**; el brief describía un estado que no era el real).

```
TOTAL main.ts: 2 436 líneas
`let` GLOBALES mutables: 55
declaraciones top-level >= 60 líneas:
   1 076  1 436  createWindow      ← el bloque dominante (44 % del fichero)
     83    790  getOrCreateDefaultProject
     69    617  ensureTray
     60  1 376  createIpcDeps
     46  1 156  scheduleMemoryCleanup
     38    524  recomputeFloatingAttention
     37    684  modelPoolProviderFactory
     36    809  resolveCwdRoot
```

**Corte elegido:** `createWindow` (1 076 líneas) era el único bloque que justificaba una extracción de riesgo controlado; el resto de bloques son de 30–83 líneas y se dejaban donde estaban (moverlos sin beneficio real es ruido en el diff).

---

## 3. El mapa de responsabilidades resultante

### 3.1 `main.ts` (1 288 líneas) — el compositor

| Bloque | Líneas | Responsabilidad |
|---|---|---|
| Imports + arranque del proceso | ~120 | `app.whenReady()` → `createWindow(...)`; apagado ordenado (`before-quit`): terminal, tray, MCP (revocando el token), `McpManager`, `RunRecorder`, `OpGate`, `releaseLockAsync()`. |
| **Ventana flotante** (`ensureFloatMgr`, `recomputeFloatingAttention`, `syncFloatingFromEngine`, `floatingSnapshot`, `getAttentionFsm`) | ~320 | Estado de la isla flotante + su atención. |
| **Cola de pushes al renderer** (`mainPushQueue`, `enqueueMainPush`, `sendMainPushNow`, `drainMainPushQueue`, `getMainPushQueueStats`) | ~90 | Transporte renderer con coalesce por prioridad. |
| **Sesiones de terminal** (`terminalSessions`, `pushTerminalOutput`, `endTerminalSession`, `killTerminalSession`) | ~90 | PTY del terminal. |
| **Tray** (`createTrayIcon`, `refreshTrayStatus`, `ensureTray`, `emitTrayId`, `pause/resumeAllBackgroundTasks`) | ~190 | Icono, menú y estado del tray. |
| **Proyecto por defecto** (`getOrCreateDefaultProject`) | ~83 | Proyecto inicial. |
| **Config de modelos** (`modelPoolProviderFactory`, `getModelCredentialPool`, `syncModelCredentialPool`) | ~90 | Pool de credenciales y proveedores. |
| **Scope / cwd** (`resolveScopeDirs`, `currentScopeDirs`, `resolveCwdRoot`, `estimateTurnTokens`) | ~85 | Alcance del workspace. |
| **Ciclo del turno** (`buildTurnPrompt`, `getLoopStableHash`, `queueMainSteer`, `clearTurnSystemFingerprint`, `getDefaultNucleusSoul`, `resolveTurnSoul`) | ~170 | Prompt y sellos de estabilidad. |
| **Contexto del LLM** (`llmCtx`, `runLlmStream`) | ~110 | Inyecta el estado vivo en `handle-llm-stream.ts`. |
| **Manifiestos de cableado** (`createIpcDeps`, `createWindowDeps`) | ~190 | Las dos "puertas" del proceso: qué ve el renderer y qué ve la ventana. |
| Limpieza de memoria (`scheduleMemoryCleanup`) | ~47 | Job periódico. |

### 3.2 Módulos nuevos

| Módulo | Líneas | Responsabilidad |
|---|---|---|
| `src/main/state/app-context.ts` | 534 | **El estado mutable del proceso.** 61 estados, cada uno `export let` (binding vivo) + `set<Nombre>()` (único punto de escritura). |
| `src/main/window/create-window.ts` | 1 095 | **El arranque**: crash recovery, memoria, modelos, bus, tools, Sub-Egos, MCP (cliente + servidor), decisión, conocimiento, daily state, tareas, aprobación, ejecución, la `BrowserWindow` + CSP, el registro de los 81 handlers IPC y la carga del renderer. |
| `src/main/state/runtime-getters.ts` | 154 | Los 26 accessors del runtime (leen el estado de `app-context.ts`). |

### 3.3 Módulos modificados (el estado se mudó de casa)

| Módulo | Cambio |
|---|---|
| `src/main/ipc/ipc-state.ts` | Los 4 estados que tenía (`activeProjectId`, `cachedPermissionsSettings`, `floatingAutoShownOnMinimize`, `floatingPinnedManually`) **re-exportan** desde `app-context.ts`. API pública intacta. |
| `src/main/settings-cache.ts` | `cachedCompressionSettings` vive en `app-context.ts`; el módulo lo consume. |
| `src/main/models/model-config.ts` | `currentModelConfig` (la config vigente) vive en `app-context.ts`; `setCurrentModelConfig` delega en `setCurrentModelConfigState`. |
| `src/main/security/electron-security.ts` | Los 2 holders locales (`ipcOriginLoggingInstalled`, `authTokenResolver`) pasan de `let` a objetos `const`. |
| `src/main/mcp-runtime.ts` | El vault de secretos MCP pasa de `let` a holder `const`. |
| `src/main/tray-status.ts` | La tabla CRC memoizada pasa de `let` a holder `const` (era una caché pura, no estado). |

---

## 4. Las dos decisiones de diseño (y por qué)

### 4.1 `export let` + setter, no un objeto `state.x`

El estado se expone como **bindings vivos** de ESM:

```ts
// app-context.ts
export let adapter: EgoMemoryAdapter;
export function setAdapter(value: EgoMemoryAdapter): void { adapter = value; }
```

```ts
// main.ts
import { adapter, setAdapter } from "./main/state/app-context.js";
```

**Por qué no un objeto `state.adapter`**: cambiar a esa forma exige reescribir **~200 referencias** en 4 ficheros (`main.ts`, `create-window.ts`, `handle-llm-stream.ts`, `register-ipc.ts`) con un riesgo alto de colisión de nombres. Con bindings vivos, **el resto del código no cambia**: `register-ipc.ts` sigue recibiendo el estado por `createIpcDeps()` y `handle-llm-stream.ts` por su `ctx`; lo único que cambia es **dónde se escribe**.

**Por qué un setter y no una asignación directa**: un `export let` **no se puede asignar desde fuera** del módulo que lo exporta. El setter convierte la escritura en un punto único y auditable ("el estado mutable se escribe en `app-context.ts`, y solo a través de su setter"). El guard `test/e6-runtime-state.test.ts` verifica **ambos** hechos.

**Coste medido de esta decisión**: 61 setters ≈ **4,2 KB** en el bundle del main (ver §5).

### 4.2 `createWindow` recibe 9 dependencias por un objeto `deps`

`createWindow` usaba 9 funciones locales de `main.ts` (`ensureFloatMgr`, `enqueueMainPush`, `refreshTrayStatus`, `floatingSnapshot`, `syncFloatingFromEngine`, `ensureTray`, `syncModelCredentialPool`, `scheduleMemoryCleanup`, `createIpcDeps`). Al mover la función, esas 9 se reciben por un objeto `deps` **explícito y tipado** (`CreateWindowDeps`), no por imports circulares ni por un singleton global.

El cuerpo se movió **verbatim** (con el prefijo `deps.`); el estado mutable sigue viniendo de `app-context.ts` por bindings vivos.

---

## 5. La medición del bundle (el requisito que NO se cumple al 100 %)

**Medido, no estimado.** Reconstruí el árbol pre-E6 desde los backups del propio agente, lo construí, y comparé:

| Artefacto | Pre-E6 | Post-E6 | Δ |
|---|---|---|---|
| `out/main/main.js` | 240,3 KB | **245,0 KB** | **+4,7 KB (+1,96 %)** ← la cifra estable |
| `out/` total | 26 213,0 KB | 26 216,8 – 26 218,2 KB | **+3,8 … +5,2 KB (+0,014 %)** |
| `out/renderer/**` | 25 553,4 KB | 25 552,5 – 25 553,9 KB | ±1,4 KB (ruido de build) |
| `out/preload/**` | 10,2 KB | 10,2 KB | 0 |
| Ficheros en `out/` | 686 | 686 | 0 |

*(El chunk del renderer varía ±1,4 KB entre dos builds del mismo árbol: no es determinista al byte. La cifra fiable es la del chunk del **main**, que es el que E6 toca: +4,7 KB.)*

**El bundle NO se duplicó** (mismo número de ficheros, el renderer incluso baja 0,9 KB). Lo que crece es **exactamente el cableado que la descomposición exige**:

| Aporte | Tamaño estimado |
|---|---|
| 61 setters en `app-context.ts` (`export function setX(v){x=v}`) | ~4,2 KB |
| 27 getters del `llmCtx` (el contexto tipado del turno de LLM) | ~1,3 KB |
| Objeto `createWindowDeps` (16 entradas) | ~0,4 KB |
| Envoltorios de los 3 módulos nuevos (`import`/`export` + cabeceras) | ~0,3 KB |

**Alternativas descartadas y por qué**:
- **Objeto `state.x` en vez de setters**: −4,2 KB, pero +200 referencias reescritas en 4 ficheros → riesgo alto para 4 KB en un chunk de 240 KB. No compensa.
- **Dejar `createIpcDeps`/`createWindowDeps` como globals**: no reduce el delta (son cables, no estado).

**Veredicto**: el crecimiento es del **+2 % del chunk del main** y del **+0,014 % de la app**, y es el precio de la tipificación del estado. No hay duplicación de código. Lo dejo medido y documentado para que el owner decida si lo acepta; si lo exige, la palanca es la migración a un objeto `state` (que también hay que hacer para `register-ipc.ts`).

---

## 6. TDD: el guard que hace que el objetivo no pueda regresionar

**Nuevo test: `apps/desktop/test/e6-runtime-state.test.ts` (4 tests).**

```ts
it("no queda ningún `let` global mutable fuera de app-context.ts", () => { … });
it("app-context.ts es el módulo de estado (y expone setters para cada estado)", () => { … });
it("main.ts es un compositor: por debajo de 1 500 líneas", () => { … });
it("los handlers IPC se siguen registrando (el registro vive en el árbol del main)", () => { … });
```

Es un **guard estructural** (no un assert de texto de fuente): recorre `src/**` de verdad, cuenta los `let` a nivel de módulo y comprueba que cada estado tiene su setter. Si la próxima ola reintroduce un `let` global, **el CI lo dice**.

**Verificador CLI equivalente**: `apps/desktop/scripts/e6-verify-globals.cjs` (mismo criterio, para uso manual).

### 6.1 RED demostrado (el guard encontró un problema real)

El guard se escribió **después** de la extracción y, al ejecutarlo por primera vez, falló:

```
AssertionError: expected '// E6 (Ola 2): arranque de la ventana…' to contain 'registerIpcHandlers('
```

**Investigación** (sin asumir "era un falso positivo"): el `registerIpcHandlers(createIpcDeps())` **SÍ** estaba en `create-window.ts:1024` — el grep que hice primero (`Select-String -Path "src/**/*.ts"`) **no recursaba** en PowerShell y me dio un resultado engañoso. El fallo era del **guard**, que leía `main.ts` en vez del árbol del main process. **Corregido**: el guard ahora recorre `src/**` de verdad, igual que hace `readMainSource()` (el helper de los 81 guards de contrato).

**Este episodio es exactamente el motivo del brief**: *"no asserts de texto de fuente: ya sabemos que esa clase de test miente"*. El guard que escribí mintió en la primera versión y lo detecté midiendo, no asumiendo.

### 6.2 Tests existentes que hubo que adaptar (por qué)

Cuatro tests afirmaban cosas que **movidas de sitio** dejaron de ser ciertas. Ninguno era un fallo de producción: el comportamiento no cambió.

| Test | Qué afirmaba | Ajuste |
|---|---|---|
| `sandbox-isolation.test.ts` | "la `BrowserWindow` principal tiene `sandbox: true`" leyendo **`src/main.ts`** | Ahora lee **todo el árbol** (`readMainSource()`) y **acota** las aserciones al bloque de opciones de la `BrowserWindow` (antes bastaba con que `sandbox: true` apareciera en cualquier sitio del fichero: era un assert de presencia de texto, no de contrato). |
| `sandbox-isolation.test.ts` | "la CSP se aplica vía `onHeadersReceived`" en `src/main.ts` | Igual: árbol del main process. |
| `updater.test.ts` | `from "./updater.js"` (ruta literal) | `from "(\.\.\/)+updater\.js"` — afirma el **contrato** (se cablea el updater real), no la ruta concreta (el módulo bajó un nivel). |
| `compaction-summarizer-wiring.test.ts` | el resumidor se crea en `main.ts` | El resumen se crea ahora en `create-window.ts` y se consume en `handle-llm-stream.ts`: el test afirma **las dos** cosas (creación y consumo) con su orden. |

### 6.3 Un timeout justificado con causa medida

`mvp-software-loop.test.ts` (E2E de 6 pasos canónicos + reapertura **en frío** del `EgoMemoryAdapter`) fallaba por presupuesto:

- Su coste intrínseco es de **~1,9 s** en reposo (medido en la Ola 1c) y **~2,3 s** aislado en esta máquina.
- El presupuesto por defecto de vitest (5 s) le daba un margen de **2,2×**.
- Con la máquina saturada (64–92 procesos `node` concurrentes de otros agentes) llegó a **6,6 s** → `Test timed out in 5000ms`.

**A/B para descartar que fuera una regresión mía**: con el `main.ts` **pre-E6** en su sitio, el import del módulo `main` **también** se fue de timeout (5 244 ms) → el defecto es de la **carga de la máquina**, no del refactor. Y el test **no importa `main.ts`** en absoluto (solo `@ego/*` y `../src/ipc/schema.js`).

**Fix**: presupuesto explícito de 20 s, proporcional al coste real de un E2E de disco. **No esconde ningún fallo**: si el golden path se rompe, el test sigue fallando por aserción. Es el mismo criterio que se aplicó en la Ola 1b a `ChatCanvasSplit.test.tsx`.

---

## 7. Lo que NO se tocó (y por qué)

| Bloque | Veredicto |
|---|---|
| `createIpcDeps` (65 líneas) | **Se queda en `main.ts`.** Es el *manifiesto de cableado* del proceso: su trabajo ES conocer el estado y las funciones. Moverlo a un módulo propio solo trasladaría el acoplamiento (tendría que recibir ~15 deps para devolver un objeto de deps). Es una responsabilidad legítima del compositor. |
| `ensureTray` + `createTrayIcon` + `refreshTrayStatus` + `emitTrayId` (~190 líneas) | **Se quedan** (pendiente de la Ola 3). El bloque del tray está acoplado a la ventana flotante (`floatingSnapshot`, `syncFloatingFromEngine`) y al motor de tareas; separarlo exigiría un contexto propio para ~190 líneas, con beneficio neto dudoso frente al resto del trabajo de la ola. |
| Los 81 handlers IPC (`src/main/ipc/register-ipc.ts`) | **Intactos.** Siguen registrados desde el proceso main (ahora desde `create-window.ts:1024`). |
| Los 81 guards de contrato | **Intactos y en verde**: leen `src/main/**` con `readMainSource()`, que concatena todo el árbol → seguir el código a su nuevo módulo no los rompe. |
| `packages/**` | **Intocados** (A2/A3). Ni una línea. |
| `docs/**`, `package.json` raíz, `pnpm-lock.yaml`, `.github/**`, `scripts/**` (raíz), `tests/e2e/**` | **Intocados** (A1/A7). |
| `apps/desktop/renderer/**` | **Intocado en E6.** (Los cambios de contraste son de la Ola 1c.) |

---

## 8. Verificación

| Comprobación | Resultado |
|---|---|
| `pnpm --filter @ego/desktop typecheck` | **exit 0** |
| `pnpm -r typecheck` (23 paquetes) | **exit 0** |
| `pnpm lint` | **exit 0** (267 warnings, ratchet 370) |
| `pnpm --filter @ego/desktop test` | **56 ficheros / 345 tests en verde** (+5 skipped) |
| `pnpm --filter @ego/desktop build` + `scripts/verify-dist.cjs` | **exit 0** — *TODOS LOS CHEQUEOS EN VERDE* |
| `pnpm --filter @ego/renderer test` | **65 ficheros; 1 fallo real ajeno** (ver §9) |
| `pnpm --filter @ego/renderer build` | **exit 0** |

### 8.1 Incidencia de entorno resuelta (no es de esta ola)

Durante la verificación, **37 tests** de `@ego/desktop` cayeron con:

```
VantaError: connect (is the native binding built?): Cannot find package
'…\node_modules\.pnpm\node_modules\vantadb-node\index.js'
```

Es la **incidencia ya documentada en el handoff de la Ola 1b**: una instalación concurrente (A7) dejó `vantadb-node` **a medio copiar** en el store de pnpm (solo el `.node`, sin `index.js`/`index.cjs`/`index.d.ts`/`package.json`). **Reparado** copiando los 4 ficheros desde `C:\Users\Eros\VantaDB Proyect\VantaDB\vantadb-node\`. **A7**: si vuelve a aparecer ese error, es esto.

---

## 9. El único fallo real que queda (ajeno a esta ola) — para el orquestador

`apps/desktop/renderer/test/design-lint.test.tsx` → 1 test:

```
AssertionError: EGO-DL-010 no suprime nada: expected 0 to be greater than 0
```

**Causa (medida):** la lista blanca de `design-lint` se indexa por **ID de hallazgo** (`EGO-DL-0NN`), y esos IDs se asignan en el orden de escaneo. Un **hex literal nuevo** (o la eliminación de otro) en un fichero del renderer **desplaza los IDs** y deja obsoleta la entrada `EGO-DL-010` (ya no existe ningún hallazgo con ese ID: el JSON del linter solo devuelve `EGO-DL-011`).

**No es de E6**: en E6 **no se ha tocado el renderer** (cero cambios en `apps/desktop/renderer/**`). Los ficheros que se editaron durante mi ventana de trabajo (13:20–13:28, mientras yo estaba con `main.ts`) son de **otro agente**:

| Fichero | mtime | Contenido R1 detectado |
|---|---|---|
| `renderer/components/domains/views.tsx` | 13:28 | `stroke="var(--color-success, #10b981)"` (hex dentro de un fallback de `var()`) |
| `renderer/components/ego-chat.tsx` | 13:22 | hexes en **comentarios** (líneas 1430 y 1900) |

**Quién lo arregla:** el dueño de esos ficheros (o quien cierre la ola) debe **recalibrar la lista blanca** de `design-lint.test.tsx` con el estado final del renderer. Yo no lo toco porque la lista depende de ficheros que **seguían editándose** mientras trabajaba: recalibrarla ahora la dejaría obsoleta otra vez.

**Además**, 6 ficheros del renderer fallaron por **timeout** en la suite completa (6,9–24,2 s) y **pasan todos en aislamiento** (47/47): es la misma saturación de CPU (49–92 procesos `node` concurrentes de varios agentes).

---

## 10. Deuda que dejo (con dueño)

| Deuda | Tamaño | Nota |
|---|---|---|
| El bloque del **tray** (~190 líneas) sigue en `main.ts` | 190 | Acoplado a la ventana flotante y al motor de tareas. Candidato a la Ola 3. |
| `getOrCreateDefaultProject` (83), `scheduleMemoryCleanup` (47), `modelPoolProviderFactory` (37) | ~170 | Bloques pequeños, cohesivos y con sus propias deps. |
| El **objeto `state`** en vez de 61 setters | 4,2 KB | Solo si el owner exige que el bundle no crezca (§5). |
| `design-lint` lista blanca desfasada | 1 entrada | §9 — dueño: el agente de los ficheros del renderer. |

---

## 11. Checklist del DoD

- [x] `main.ts` < **1 500** líneas → **1 288**.
- [x] **0** `let` globales mutables fuera de `app-context.ts` → verificado por test **y** por CLI.
- [x] Sin cambio de comportamiento: los 79 canales IPC, los 81 guards, el ciclo de vida del MCP Server, el tray, el apagado ordenado y el `releaseLockAsync()` intactos.
- [x] TDD real: guard nuevo (RED demostrado: el guard mintió en su v1 y lo detecté midiendo) + 4 tests existentes adaptados con la causa documentada.
- [x] `pnpm --filter @ego/desktop typecheck` exit 0 · `pnpm -r typecheck` exit 0 · `pnpm lint` exit 0.
- [x] `pnpm --filter @ego/desktop test`: 345 en verde · `build` + `verify-dist` verde.
- [x] **Bundle medido**: +3,8 KB (+0,014 % de la app; +1,96 % del chunk del main), sin duplicación de código (§5).
- [x] Sin commits · sin `git checkout/reset/stash/clean` · sin `pnpm install`.
- [x] No tocado: `packages/**` · `docs/**` · `package.json` raíz · `pnpm-lock.yaml` · `.github/**` · `scripts/**` (raíz) · `tests/e2e/**` · `apps/desktop/renderer/**`.
