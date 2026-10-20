# Plan A4 — Aplicación desktop: main, preload, renderer, IPC

**Agente:** A4 (sesión `ses_eaa0dfc5effexbINnkYPueEk9J`) · **Persona:** `.opencode/agents/ego-desktop.md`
**Zona exclusiva:** `apps/desktop/**` (EXCEPTO `apps/desktop/renderer/floating/vendor/avatar/**` → zona de A6)
**Prohibido:** `packages/**`, `docs/**`, `.github/**`, `tests/**`

## Objetivo

Cerrar las fugas de seguridad de la app, arreglar la regresión de crash del chat que introdujo el P0, y dejar la superficie IPC realmente validada y performante.

## Contexto técnico

- 79 canales `invoke` + 8 `push`, contrato en `apps/desktop/src/ipc.ts`, schemas en `apps/desktop/src/ipc/schema.ts`.
- `contextIsolation=true`, `sandbox=true`, `nodeIntegration=false`, CSP en 2 capas, `setWindowOpenHandler` deny-by-default. **Son innegociables.**
- `PathValidator` (`packages/tools/.../PathValidator.ts`) y `resolveScopeDirs()` (`main.ts:1920`) existen pero solo se aplican en `ipc.terminal.spawn` (`main.ts:5211`).
- `validateSSRFUrl` (`packages/security/src/netPolicy.ts`) existe y **nunca se invoca**.

## Tareas

### T1 — Arreglar el crash del chat virtualizado (`EGO-FIND-20`) — **CRÍTICO**
`apps/desktop/renderer/components/ego-chat.tsx:1543` (`<Virtualizer>` de `virtua`) itera el array local `messages` (estado React) y `:1560` renderiza `<ThreadPrimitive.MessageByIndex index={index}>`, que resuelve contra el store de assistant-ui (`aui.thread.message({index})` → `useClientLookup`). Al añadir un turno, el store se actualiza un tick después → **desync de índice → `useClientLookup: index N out of bounds`**. `MessageRenderBoundary` (`:72`,`:137`) no envuelve al `MessageByIndex` (`:1560`), así que el throw escapa.
- **Solución**: `ThreadPrimitive.Unstable_MessageById` + `unstable_useThreadMessageIds` (la API que la propia librería documenta para windowing: *"renders null rather than throwing"*), o clonar la lista local al store antes de renderizar para garantizar `index < thread.messages.length`.
- **Test de regresión obligatorio**: montar **60+ mensajes y luego añadir un turno** (el caso que hoy falla). El test actual (`test/ChatVirtualization.test.tsx:92`) solo monta 200 mensajes estáticos.
- Además: `itemSize={120}` fijo → usa `measureElement` de `virtua` para alturas variables, o documenta por qué el alto fijo es aceptable.

### T2 — Cerrar la lectura arbitraria de disco (4 handlers) (`EGO-FIND-26`) — **SEGURIDAD**
`main.ts:4648` (`ipc.knowledge.ingest`), `:4655` (`ipc.knowledge.explainArtifact`), `:4081` (`ipc.skills.listLocal`), `:4942` (`ipc.domains.engineering.status`) aceptan `filePath`/`searchPaths`/`workspaceRoot` del renderer **sin validar scope** → `fs.readFile` de cualquier ruta del SO.
- Centraliza un helper `assertPathInScope(p, workspaceRoot)` en `apps/desktop/src/` y aplícalo a los 4 handlers (reutiliza `isPathInScope`/`resolveScopeDirs` de `main.ts:1834/1920`).
- Test por handler: una ruta fuera del scope → error tipado; una dentro → OK.

### T3 — SSRF + fuga del Bearer (`EGO-FIND-27`) — **SEGURIDAD**
`main.ts:2797` (`ipc.net.fetch`): `isAllowedFetchUrl` solo comprueba protocolo + credenciales embebidas + loopback; el `validateSSRFUrl` de `@ego/security` (bloquea RFC1918 y `169.254.169.254`) **nunca se invoca**; y el handler adjunta `Authorization: Bearer <EGO_API_TOKEN>` al host arbitrario solicitado.
- Usa `validateSSRFUrl` de `@ego/security` (import, no reimplementación).
- **No adjuntes `Authorization` a hosts fuera de una allowlist** explícita (API de modelos, GitHub, etc.).
- Test: `http://169.254.169.254/`, `http://10.0.0.1/`, `http://[::1]/` → rechazados.

### T4 — Fail-closed en los 2 handlers permisivos (`EGO-FIND-30`, `EGO-FIND-31`)
- `main.ts:5116` (`ipc.floating.toggle`): type assertion `rawReq as {state?}`; `FloatingToggleSchema` existe en `ipc.ts:140` y está muerto → usa `FloatingToggleSchema.safeParse` y **rechaza** si falla (además acepta cualquier string fuera de la unión).
- `main.ts:3878` (`ipc.llm.cancel`): **fail-open** — si Zod falla, `turnId` queda `undefined` → aborta **todos** los turnos. Si `!parsed.success` → **return error**. Solo abortar todos cuando el payload es `{}` explícito.

### T5 — 44 px y eliminación de selects nativos (`EGO-FIND-55`, `EGO-FIND-56`)
- **Regresión STAB-13 parcialmente corregida**: `apps/desktop/renderer/src/App.tsx:240` sigue en `h-7 w-7` (28 px); `components/activity-tray/ActivityTray.tsx:352,362,372` en `min-h-[28px]`; y `components/ui-kit/Button.tsx:56` **fuerza** `min-h-[28px]` — con `test/ui-kit-nine-states.test.tsx:86` **afirmando** ese valor (el test codifica la regresión).
- **7 `<select>` nativos vivos**: `DomainCanvasView.tsx:536,548,670`, `ShortcutsPanel.tsx:126`, `FormView.tsx:97`, `QueryView.tsx:79`, `CronPanel.tsx:158`. El commit `87fc3ad` afirmó eliminarlos.
- **Decisión del owner (D3): migrar a Radix.** `components/ui-kit/Select.tsx` es **custom**, no Radix — `@radix-ui/react-select` está en `package.json` pero **nadie lo importa** (0 usos). **Reescribe `Select.tsx` usando `@radix-ui/react-select`** (la dependencia ya está declarada) y elimina los 7 `<select>` nativos.
  - Radix aporta combobox/listbox/option correctos, teclado y foco battle-tested → eliminas el riesgo de que nuestra implementación ARIA tenga un hueco.
  - Renderiza el listbox en `Radix.Portal` para que no lo recorte el `overflow: hidden`.
  - Reescribe `test/Select.test.tsx` para Radix (asserts de rol, teclado, foco, `aria-expanded`).
- **Principio general del owner (D3)**: *los componentes de librerías y framework se utilizan siempre; no se recrean desde cero si ya existe una primitive de librería o del framework.* Revisa el resto del `ui-kit` (`Button`, `Input`, `Modal`, `Tabs`, `Badge`): si Radix/React Aria ofrece un equivalente y el nuestro no aporta nada, **migra**; si lo conservas, **justifícalo por un motivo concreto** (no por comodidad) y documéntalo.
- **Refuerza `test/Targets44.test.tsx`** para **barrer todo el árbol** del renderer, no solo Sidebar/App/SettingsModal. Ese test debe FALLAR hoy (rojo demostrado) y pasar al final.

### T6 — `EditorView` (CodeMirror 6) que edita de verdad (`EGO-FIND-57`)
`components/canvas/EditorView.tsx:129,135`:
- **No persiste cambios**: no hay `onChange`.
- **Remonta en cada cambio**: `props.code` está en el array de deps del `useEffect` → destrucción/recreación → pierde cursor, selección e undo.
- El **fallback a tabla estática enmascara el fallo** sin error visible.
- **Solución**: separar montaje (deps estables) de actualización de documento (`view.dispatch({changes})`); añadir `onChange`; exponer el error de montaje al usuario.
- **Limpia la deuda muerta del propio P0**: `renderer/package.json` sigue declarando `prosemirror-model|state|view` y `vite.config.ts:37` mantiene el chunk `vendor-prosemirror` → **elimina las 3 dependencias ProseMirror y el chunk**.

### T7 — Shiki: offload efectivo (`EGO-FIND-58`)
- `vite.config.ts:37` → `manualChunks` mete shiki en `vendor-shiki` (**9.87 MB**) importado **estáticamente** en el chunk index (posición 834) pese al comentario "no entra al bundle inicial" → el offload **no reduce el bundle**.
- Usa `shiki/core` con **subset de langs** (diff/typescript/tsx…) en el worker; quita el import estático de `vendor-shiki` del chunk index.
- `shiki-highlight.tsx:88`: el fallback in-thread degrada **en silencio** (solo `console.warn`) → hazlo visible (`data-shiki-fallback`).
- `shiki-highlight.tsx:116,141`: `pendingRequests` **nunca se limpia** si el worker no responde (fuga de Map) → timeout + `delete(id)` en cleanup; distingue "obsoleto" de "fallo real".

### T8 — Estado del renderer (`EGO-FIND-73`)
- `components/ego-chat.tsx:511` — `messages` es `useState` local (8 useState, 25 refs); 25 renders del componente raíz por delta → cascada de re-renders sobre `ThreadPrimitive`.
- **Store Zustand dedicado** para el transcript, con selector por índice (evita re-render global). Hay ya `packages/ui-runtime`… no: el store de UI está en `renderer/components/ui-kit/store.ts` (zona tuya).
- `src/App.tsx` tiene **0 `useMemo`** y 2 `useCallback` → memoiza.
- **Sin cache de servidor** (0 TanStack Query / SWR): `ipc.projects.list`, `ipc.subegos.list`, `ipc.daily.getSummary` se re-consumen en cada montaje → añade TanStack Query con `staleTime` para lecturas idempotentes. **Dependencia nueva → la anotas en el handoff para A7; NO ejecutes `pnpm install`.**
- 45 ocurrencias de `transition-all` (App 13, ego-chat 9, Sidebar 9, SettingsModal 8) → sustituye por `transition-colors` / `transition-transform` / `transition-opacity`.

### T9 — Contrato IPC completo (`EGO-FIND-59`)
`src/ipc.ts:144-147` — `EgoIpcSchemas` declara solo **2** entradas (`floating.restoreMain`, `floating.toggle`); los otros 77 schemas viven sueltos en `src/ipc/schema.ts`, sin vínculo tipado canal→schema. Declara el mapa completo y tipa canal→schema como `Record` → que un canal nuevo sin schema **no compile**.

### T10 — Contrato de seguridad y renderer (`EGO-FIND-60` parcial, `A4-24`, `A4-30`, `A4-31`, `A4-32`)
- `main.ts:2741` — `logInvokeOrigin` **loguea pero no valida**: el `senderFrame.url` se registra y se descarta. Conviértelo en **allowlist de origen** y rechaza handlers sensibles con origen no permitido.
- `components/canvas/BrowserView.tsx:182` — el iframe usa `sandbox="allow-scripts"` (correcto), pero `workbench-guards.ts` **solo valida el `src` en el submit**, no en cada render → re-valida en mount.
- `src/preload.ts:492-493` — **dos** `exposeInMainWorld` (`ego` y `egoFloating`, el mismo objeto duplicado) → expone solo `window.ego` y lee `ego.floating`.
- `components/ui-kit/Select.tsx:257` — el listbox se renderiza **inline** (sin `Portal`) → puede ser recortado por `overflow: hidden`; y falta `aria-controls` cuando está cerrado → renderiza en `Radix.Portal` (o equivalente propio).

### T11 — Descomposición de `main.ts` (`EGO-FIND-54`)
5 401 líneas: 79 handlers IPC, ~50 `new X()`, 69 globales mutables (56 `let` + 13 `const`), 99 funciones exportadas, un `createWindow()` de 2 900 líneas.
- **Extrae** (en este orden, sin cambiar comportamiento observable):
  1. `src/main/ipc/register-ipc.ts` → `registerAllIpcHandlers(deps)`
  2. `src/main/ipc/{memory,subegos,mcp,projects,knowledge,daily,domains,terminal,sessions,voice,net,hooks}.ts`
  3. `src/main/bootstrap.ts` → creación de ventana + guards + CSP + tray + updater
  4. `src/main/state/app-context.ts` → contexto tipado que sustituye a los 69 globales
- Objetivo: bajar de 5 401 a **< 3 000** líneas en esta ola (dejar el resto para la Ola 2).
- **Test de humo**: `apps/desktop/test/` debe seguir verde; los 79 canales deben seguir respondiendo.
- **Aplica los handoffs de A2 y A3** cuando lleguen (instanciación de `ContextCompactionJob`, `DecisionCascade`, `createDelegationRuntime`, triggers de proactividad, servidor MCP).

### T12 — Distribución (`EGO-FIND-64` parcial, `A4-15..A4-17`)
- `electron-builder.config.cjs:36-52` — `publish` está comentado → auto-update inactivo (`updater.ts` queda en `idle`). **DIST-04 está bloqueado por el owner (sin certificados)** → no lo toques; documéntalo.
- `apps/desktop/package.json:35` — `vantadb-node: file:../../../VantaDB/vantadb-node` → build no reproducible. **Es dependencia de A7**: hándalo.
- `electron-builder.config.cjs:15-18` — no se empaquetan runtimes MCP (`node/npx/python/python3/uv/uvx/bun/deno` están en la allowlist pero ninguno se empaqueta) → documenta el prerrequisito por OS en `docs/user/` (**hándalo a A1**, `docs/` no es tu zona).
- `main.ts:3498` — listeners de `screen` sin `removeListener` → guarda las refs y remuévelos en `before-quit`.
- `main.ts:5798` — `window-all-closed` → `app.quit()`: **confirmado**, no hay daemon (decisión P1 conocida) → documéntalo en `docs/product` (hándalo a A1).

### T13 — DOMPurify + CSP en el chat (`EGO-FIND-61`)
`renderer/package.json` sin `dompurify`; la única mitigación es que `react-markdown` no habilite `rehype-raw`. El doc maestro §21.2 lo exige.
- Añade sanitización del HTML renderizado y una **directiva CSP `img-src`** que impida la exfiltración por Markdown image.
- **Dependencia nueva → hándalo a A7** (no ejecutes `pnpm install`).

### T14 — Tokens de diseño y `DESIGN.md` (`EGO-FIND-72`)
- `renderer/src/styles/theme-tokens.css` — 37 hex, **0 OKLCH**; 408 hex hardcodeados en el renderer (53 solo en `DesignSystemProvider.tsx`).
- Migra los tokens a **OKLCH** (skill `color-expert` disponible) y elimina los hex de componentes (usa `var(--color-*)`).
- 0 `@container` queries → adopta container queries para el workspace (el panel Chat↔Canvas usa `w-[46%]` fijo).
- `docs/design/DESIGN.md` (tokens, jerarquía, motion, regla 44 px) → **hándalo a A1** (`docs/` no es tu zona).

### T15 — Panel Chat↔Canvas redimensionable (`A4-20` del informe previo)
El panel usa `w-[46%]` fijo; solo sidebar e inspector usan `SplitPane`. Usa `react-resizable-panels` (**dependencia nueva → hándalo a A7**) o el `SplitPane` que ya usas en sidebar/inspector para no añadir dependencia.

## DoD específico

- `pnpm --filter @ego/desktop typecheck` → exit 0.
- `pnpm --filter @ego/desktop test` → 0 regresiones (287 tests hoy).
- `pnpm --filter @ego/desktop build` → compila y `scripts/verify-dist.cjs` verde (8 checks).
- `pnpm --filter @ego/renderer build` → verde, y el chunk index **ya no** importa `vendor-shiki` estáticamente.
- 0 `any` sin justificación; 0 `catch {}` vacío en tu zona (`CharacterBadge.tsx` ×5, `WardrobeSelector.tsx` ×2, `DomainCanvasView.tsx` ×4, `main.ts:3727`).
- 0 `<select>` nativos; 0 target < 44 px (test que barre el árbol entero).
- Los tests de regresión (crash del chat, 4 fugas de path, SSRF, fail-closed) **fallan con el código actual** antes de arreglarse.

## Handoff

`docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A4.md`
Incluye: dependencias nuevas necesarias (para A7), textos de docs a redactar (para A1), y el estado de la descomposición de `main.ts`.
