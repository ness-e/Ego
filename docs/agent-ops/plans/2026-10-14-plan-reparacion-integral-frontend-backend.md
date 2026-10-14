# Plan Reparación Integral Frontend ↔ Backend Ego

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Poner a funcionar la interfaz (arranque → todas las funciones UI) contra el backend real, eliminando mocks que suplantan, cableando lo desconectado y cerrando EGO-FIND-02..16 + GAP-01/02 + UI-01..06.

**Architecture:** Contratos IPC Zod como fuente única; `window.ego` tipado único; CanvasBridge local + persistencia VantaDB; ModelRouter real con fallback mock visible; kit UI con tokens semánticos; a11y WCAG AA.

**Tech Stack:** Electron 33 + React 19 + Vite 6 + Tailwind v4 + assistant-ui + Vitest + NativeVantaDB + AI SDK v7

---

## Evidencia base (verificada 2026-10-14, sin asumir)

- `pnpm --filter @ego/renderer typecheck` → PASS (exit 0)
- `pnpm --filter @ego/desktop typecheck` → PASS (exit 0)
- `pnpm --filter @ego/renderer test` → 13 files / 49 tests PASS
- `pnpm --filter @ego/desktop test` → 28 files / 150 tests PASS
- `git status` limpio; `ensure-fresh-dist` OK
- Triple cruce Q1-Q25: 22/25 Sí, 3 Parcial (Q9 nombres bus, Q18 electron-vite diferido, Q22 presupuesto no automatizado). Nota AGENTS.md "faltan Q6/Q8/Q17" refutada: sí existen en el .txt.
- Corrección a reporte previo: `selectFolder` NO está roto — `main.ts:1998-2008` retorna `string|null` correcto. El bug reportado era falso positivo por mock.
- Divergencia real confirmada: `preload.ts:16-20` (`LlmStreamBridgeRequest` sin `projectId/subEgoId`) vs `ipc/schema.ts:125-131` + `lib/ego.ts:306` + `ego-chat.tsx:146` que sí los usan. Runtime pasa por JS pero el tipo miente.
- `@ego/tasks` existe (12 src + 13 tests) pero 0 referencias en `apps/desktop/src/main.ts` — único paquete no cableado.
- Streaming fake confirmado: `ego-chat.tsx:142-167` espera `invoke` completo; `ipc.chat.delta` se emite en main pero nadie lo suscribe en chat.
- Docs desincronizados: `roadmap.md` vs `Backlog.md` (F03 4/12 vs 20/20), `PLAN-EGO.md:36` "116 tareas" vs 151, `stack-tecnico.md` promete Router/Radix/Zustand no instalados.
- Refutados con evidencia (no re-abrir): traversal vía symlink (falso — `fs/PathValidator.ts:71-72` realpath ambos lados), `shell:true` en terminal (falso — `NativeTerminalTool.ts:73` spawn sin shell), bypass HITL por `purpose/humanApproval` (falso — no existen; mecanismo real `riskLevel`+`requiresApproval`), identidad aceptada del cliente (falso — `ApprovalEngine.ts:199` computa SHA-256 server-side), TOCTOU en locks/escritura (falso — `FileLockManager.ts:64` flag `wx` + `NativeFsTool.ts:108-110` tmp+rename), ciclos no detectados (falso — `DelegationRouter.ts:173` por cadena de ids), reportes memory/tools con `file:line` fuera de rango o en rutas inexistentes (fabricados por subagentes con rate-limit; solo vale evidencia releída).

---

## Decisiones del owner (2026-10-14, vinculantes — no alterar sin re-pregunta)

- D2: Monolito por defecto (art-direction + código migran a monolith-core).
- Layout: sidebar dual + resizable (D1 aceptado, reconciliar workspace-dinamico).
- Stack: adoptar Radix + Zustand (instalar, kit sobre Radix Dialog/Tabs).
- UI-01: tema real completo (accent ámbar, dim AA, Geist, app-region, 4 presets funcionales).
- Chat: streaming incremental real.
- Tasks: cablear BackgroundEngine + WorkerTaskPool.
- Limpieza: borrado total (union/ui/mock/streamdown/radius-card/electronAPI; SplitPane se monta).
- Pickers: montar ModelPicker + SessionPicker con Radix (no borrar).
- Sidebar: viva completa (split 3, IPC real, Ctrl+K/, , debounce).
- Avatar+Canvas: fidelidad total (avatar por turno + persistencia + payload estructurado).
- Mock: BLOQUEAR mock sin keys (error explícito BYOK, no respuesta indistinguible).
- Docs: sincronización total + design-system.md + corregir roadmap/TOTAL/CHAR-03/AGENTS Q6-Q8-Q17.
- A11y: WCAG AA completo con axe CI + snapshots.
- Perf: todo ahora (lazy + windowing + skeletons + anti-shift + boundary).
- Extras: terminal viva PTY + System Tray con código color; resto COUC/HERM a backlog futuro.
- Gates: DIST-04/06 en espera (certificados/VM), DIST-09/REQ-08 en vigilancia.
- Orden: Task1 contrato → Task3 tasks → Task5 tema → Task6 kit Radix/Zustand → Task2 streaming → bloqueo mock → Task8 sidebar/canvas → Task7 a11y → Task10 perf → Task9 docs → verificación integral.
- Arquitectura final: electron-vite MIGRAR AHORA (unificar loop, re-verificar smoke nativo) · budget manual + auditoría (sin gate CI) · Q9 RENOMBRAR código a términos canónicos (blast radius asumido) · LICENSE + Prototype rename ambas.
- Detalle: virtua para windowing · @ y / implementados · Backlog manda (sincronizar frontmatters, archivar plan-maestro como absorbido tras verificar F2–F6, HIG/UI como extensión formal) · COUC/HERM futuros priorizados sin descartes (omnibar=HERM-20, HERM-21 con MetricsConsole, HERM-22 P3, COUC-17/18/20/21 a cierre formal) · Daily sin falsos + HITL unificado en approval.resolve · BYOK por proveedor · dark-only 4 presets · omnibar federado con debounce · mermaid lazy + doc honesto 11 vs 13 · higiene VDB-XXX.
- Micro-decisiones: snapshots advisory 2 semanas (axe sí bloquea) · error sin keys con card + botón BYOK al proveedor faltante · Tray mínimo útil (click restaura, menú Mostrar/Salir, tooltip estado).

---

### Task 0: Entorno — reparar `pnpm test` en Windows (R1, bloquea release)

**Files:** ninguno de código (entorno). Verificar: `packages/execution/node_modules/.bin/` + `packages/integrations/node_modules/.bin/` (hoy sin `vitest.cmd`; EPERM al instalar por handles/antivirus).

**Step 1: Workaround inmediato (sin reinstalar)**
```powershell
cd packages/execution; node node_modules/vitest/vitest.mjs run
cd ../integrations; node node_modules/vitest/vitest.mjs run
```
Expected: 8/8 y 35/35 PASS (código sano; runner roto).

**Step 2: Arreglo definitivo (acción owner, NO automática)**
1. Cerrar todo lo que use el repo (editores, Hermes, node colgados — NO matar a ciegas).
2. `pnpm install --frozen-lockfile` (no cambia versiones; lockfile verificado limpio).
3. Si EPERM persiste → exclusión de Defender para `VantaDB Proyect\Ego` y reintentar.
4. Verificar shims `vitest`/`vitest.CMD`/`vitest.ps1` en ambos `.bin` + `pnpm test` verde punta a punta.

**Step 3: Commit**
Ninguno (entorno). Registrar resultado en Task 10.

---

### Task 1: Unificar contrato llmStream + window.ego único

**Files:**
- Modify: `apps/desktop/src/preload.ts:16-20` (LlmStream + Memory + doble global)
- Modify: `apps/desktop/renderer/src/window-ego.d.ts:10-14` (re-export, no redefinir)
- Modify: `apps/desktop/renderer/lib/ego.ts:306-312,706-709` (tipos + adaptador memory)
- Test: `apps/desktop/test/ipc-zod-coverage.test.ts`

**Step 1: Write failing test**
```ts
// en ipc-zod-coverage: ChatStreamSchema debe aceptar projectId/subEgoId
// y LlmStreamBridgeRequest debe igualarlo (type-level assert)
import { ChatStreamSchema } from "../src/ipc/schema.js";
const r = ChatStreamSchema.safeParse({ prompt: "hola", projectId: "p1", subEgoId: "s1" });
if (!r.success) throw new Error("schema rechaza projectId/subEgoId");
```

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @ego/desktop test -- ipc-zod-coverage`
Expected: PASS en schema pero FAIL en type-check preload (divergencia visible)

**Step 3: Write minimal implementation**
```ts
// preload.ts
export interface LlmStreamBridgeRequest {
  prompt: string; sessionId?: string; systemPrompt?: string;
  projectId?: string; subEgoId?: string;
}
// memory(): unificar a (op, args) en preload + EgoBridge + lib/ego adaptador;
// window-ego.d.ts re-exporta los tipos de preload, no los redefine.
```
Eliminar doble global: `window-ego.d.ts` debe re-exportar el tipo de preload, no redefinirlo.

**Step 4: Run test to verify it passes**
Run: `pnpm --filter @ego/desktop typecheck; pnpm --filter @ego/renderer typecheck`
Expected: PASS ambos

**Step 5: Commit**
```bash
git add apps/desktop/src/preload.ts apps/desktop/renderer/src/window-ego.d.ts apps/desktop/renderer/lib/ego.ts
git commit -m "fix: unify llmStream contract with projectId/subEgoId"
```

---

### Task 2: Streaming real chat (delta + recall + tool calls visibles)

**Files:**
- Modify: `apps/desktop/renderer/components/ego-chat.tsx:133-188`
- Modify: `apps/desktop/src/main.ts` (handleLlmStream ~962-1144, ya emite `ipc.chat.delta`)
- Test: `apps/desktop/renderer/test/ChatStreaming.test.tsx` (nuevo)

**Step 1: Write failing test**
```tsx
// mock window.ego con onChatDelta que emite 2 chunks; assert que el composer
// muestra texto incremental antes del invoke final
```

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @ego/renderer test -- ChatStreaming`
Expected: FAIL (no suscribe onChatDelta)

**Step 3: Write minimal implementation**
- Suscribir `ego().onChatDelta/onRecallStatus/onEvent` en `ego-chat.tsx`; reemplazar placeholder "Procesando…" por skeleton con altura reservada; pintar `tool_call/tool_result` inline.
- HITL unificado: `ipc.approval.resolve` único (deprecar `ipc.gov.approve` sin borrarlo); widget y card resuelven el mismo `approvalId` con misma firma (motivo/args opcionales).
- R10b seguridad: `WidgetHitlBridge.presentApproval` debe adjuntar el `ActionIdentity` (hash de `ApprovalEngine.computeActionIdentity`) a la presentación y la UI debe mostrarlo/verificarlo antes de aprobar (hoy la presentación solo lleva id/tool/args, sin digest).
- Bloqueo mock (tras streaming verde): sin keys del proveedor activo → error BYOK explícito en vez de respuesta mock (decisión owner; rompe demo sin keys conscientemente).
- Sin `React.lazy` aquí; solo suscripción + estado incremental.

**Step 4: Run test to verify it passes**
Run: `pnpm --filter @ego/renderer test`
Expected: 50+ PASS, 0 regresiones

**Step 5: Commit**
```bash
git add apps/desktop/renderer/components/ego-chat.tsx apps/desktop/renderer/test/ChatStreaming.test.tsx
git commit -m "feat: real streaming deltas in chat with reserved skeleton"
```

---

### Task 3: Cablear @ego/tasks al main (único paquete huérfano)

**Files:**
- Modify: `apps/desktop/src/main.ts` (instanciar BackgroundEngine + ProactivityEngine + Tray + Terminal PTY)
- Modify: `apps/desktop/src/ipc.ts` (2-3 canales `ipc.tasks.*` si faltan + `ipc.terminal.*` stdin/kill si faltan)
- Modify: `apps/desktop/src/windows/FloatingWindow.ts` + `Tray` (código color idle/pensando/HITL — COUC-19 alcance mínimo)
- Test: `apps/desktop/test/task-crash-resume.test.ts` (ya existe, debe pasar con wiring real)

**Step 1: Write failing test**
```ts
// assert que main importa BackgroundEngine (grep en test o smoke que lista tasks vía IPC)
```

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @ego/desktop test -- task-crash-resume`
Expected: PASS aislado pero wiring ausente (grep 0 en main.ts)

**Step 3: Write minimal implementation**
- Instanciar `BackgroundEngine` + `WorkerTaskPool` en `createWindow()`; exponer `ipc.tasks.list/cancel` mínimos; conectar `ActivityTray` a datos reales en vez de fallback.
- Terminal viva: `TerminalView` a PTY real vía IPC (stdin/kill); `useTerminalSession/TerminalSessionStore` conectados (hoy 0 usos fuera de tests).
- Tray mínimo: `new Tray` con verde idle / azul pensando / rojo HITL; resto COUC (sonido WAV, island completa, móvil) queda en backlog futuro priorizado, sin descartes.
- R5 hardening terminal: blacklist de 6 patrones (`NativeTerminalTool.ts:10-17`) es bypasseable por naturaleza; el guardrail fuerte es `PathValidator` + `requiresApproval` + `destructive`. Decisión owner: DENEGAR-POR-DEFECTO fuera de conjunto seguro documentado, con HITL como vía de escape. No confiar en la lista como única defensa.
- R8 resiliencia: auditar que TODOS los consumidores de `abortSignal` cierren recursos en `finally` (cursores VantaDB, archivos, workers); añadir test de caos que mate una tarea y verifique cero handles abiertos (relacionado REC-08).

**Step 4: Run test to verify it passes**
Run: `pnpm --filter @ego/desktop test; pnpm --filter @ego/tasks test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/desktop/src/main.ts apps/desktop/src/ipc.ts
git commit -m "feat: wire @ego/tasks BackgroundEngine into desktop main"
```

---

### Task 4: Canvas persistente + Chat↔Canvas bidireccional real

**Files:**
- Modify: `apps/desktop/renderer/hooks/useCanvasBridge.ts:44-47`
- Modify: `packages/ui-runtime/src/CanvasPersistence.ts` (usar `getVantaKey`)
- Modify: `apps/desktop/renderer/components/canvas/CanvasRuntime.tsx:18-108` (quitar DEFAULT_WORKSPACE mock tras persistencia)
- Test: `tests/e2e/canvas-interaction.test.ts`

**Step 1: Write failing test**
```ts
// inyectar componente → reload bridge → assert que sobrevive (hoy se pierde)
```

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @ego/e2e-tests test -- canvas-interaction`
Expected: FAIL en persistencia

**Step 3: Write minimal implementation**
- Llamar `CanvasPersistenceManager.serialize` a `projects/<id>/workspace/canvas` vía `ego().memory()`; `applyChangeSet/injectComponent` invocados desde tools/Sub-Egos (no solo string plano `[Acción de Canvas]` sino payload estructurado).

**Step 4: Run test to verify it passes**
Run: `pnpm --filter @ego/e2e-tests test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/desktop/renderer/hooks/useCanvasBridge.ts packages/ui-runtime/src/CanvasPersistence.ts
git commit -m "feat: persist canvas to VantaDB and structured chat-canvas actions"
```

---

### Task 5: UI-01 + UI-02 — Tokens reales + chat al design system (EGO-FIND-02/10/11)

**Files:**
- Modify: `apps/desktop/renderer/src/index.css` (accent ámbar #f59e0b, dim #8a8a92 AA, app-region, radius-card real)
- Modify: `apps/desktop/renderer/src/main.tsx` (import geist/font)
- Modify: `apps/desktop/renderer/components/canvas/DesignSystemProvider.tsx` (consumir `--ego-*`, 4 presets funcionales)
- Modify: `apps/desktop/renderer/components/ego-chat.tsx` (13 inline → tokens)
- Test: renderer suite existente

**Step 1: Write failing test**
```bash
# grep debe dar 0 tras el fix:
grep -rn "style={{" apps/desktop/renderer/components/ego-chat.tsx
grep -rn "bg-accent\|text-accent" apps/desktop/renderer/components/
```

**Step 2: Run test to verify it fails**
Run: los greps hoy devuelven 13 y 6 respectivamente
Expected: FAIL (hex/inline presentes)

**Step 3: Write minimal implementation**
- Tokens + import Geist + ThemeControl funcional + chat a tokens + `aria-label` envío.
- Dark-only + 4 presets oscuros funcionales (default-dark, midnight-cyan, emerald-terminal, amber-warm); `UserPrefs theme` queda documentado como futuro; matiz D10 en `gui-desktop.md`.

**Step 4: Run test to verify it passes**
Run: `pnpm --filter @ego/renderer typecheck; pnpm --filter @ego/renderer test; pnpm --filter @ego/desktop build:verify`
Expected: PASS + greps en 0

**Step 5: Commit**
```bash
git add apps/desktop/renderer/src/index.css apps/desktop/renderer/src/main.tsx apps/desktop/renderer/components/ego-chat.tsx apps/desktop/renderer/components/canvas/DesignSystemProvider.tsx
git commit -m "fix: real theme tokens, geist, accent, chat to design system"
```

---

### Task 6: UI-03 — Kit Radix+Zustand + borrar muertos (EGO-FIND-03/06/13/16)

**Files:**
- Install: `@radix-ui/react-dialog @radix-ui/react-tabs` + `zustand` + `virtua` (windowing se instala aquí, se usa en Task 8) vía pnpm
- Create: `apps/desktop/renderer/components/ui-kit/` (Button/Input/Modal/Tabs/Badge sobre Radix Dialog/Tabs + cva+clsx; `tailwind-merge` para conflictos; los 9 estados P22 por componente: default/hover/active/focus/disabled/loading/error/empty/overflow — EGO-FIND-12)
- Mount (no borrar): `ModelPicker` en header (proveedor real vía ModelRouter) + `SessionPicker` en sidebar (sesiones VantaDB) + `SplitPane` en layout App (resizable real)
- Delete: `components/union.tsx`, `components/ui.tsx` (tras migrar), `lib/mock.ts` (tras migrar fallbacks), dep `react-streamdown`, `--radius-card` sin uso, rama `window.electronAPI` en `ActivityTray:45`
- Modify: `components/canvas/registry.ts:14` (`props: any` → inferido Zod)
- Modify: reducir `any` en producción a 0 salvo justificación (baseline ~32; top `DomainCanvasView.tsx` 8, `sub-egos.tsx` 6 — AGENTS.md lo prohíbe)
- Modify: paletas zinc/neutral/hex → tokens (Recharts → tokens en Task 8 con lazy)

**Step 1: Write failing test**
```ts
// registry sin any: tsc con noImplicitAny debe pasar + test de registry tipado
```

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @ego/renderer typecheck`
Expected: PASS hoy pero con `any` (deuda); test nuevo FAIL

**Step 3: Write minimal implementation**
- Kit Radix (Dialog/Tabs con trap+roles nativos) + migración de 6 modales duplicados al Modal base + montaje de pickers/SplitPane (decisión owner) + registry tipado + radios/tipos unificados.
- `pnpm build` debe seguir verde tras cada borrado (uno por commit).

**Step 4: Run test to verify it passes**
Run: `pnpm --filter @ego/renderer test; pnpm build`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/desktop/renderer/components/ui-kit/
git commit -m "feat: ui-kit base with cva, remove dead code, typed registry"
```

---

### Task 7: UI-04 — A11y WCAG AA (EGO-FIND-07/08)

**Files:**
- Modify: `apps/desktop/renderer/src/index.css` (focus-visible global)
- Modify: 6 modales (trap + Escape + aria-modal + labels)
- Modify: `DomainSelector.tsx` (teclado flechas/Escape, roles tab)
- Create: `apps/desktop/renderer/test/a11y.test.tsx` (axe) + Playwright snapshots base

**Step 1: Write failing test**
```bash
npx axe apps/desktop/renderer/dist/index.html  # debe dar violaciones hoy
```

**Step 2: Run test to verify it fails**
Expected: violaciones (contraste dim, sin labels, sin trap)

**Step 3: Write minimal implementation**
- focus-visible + trap+Escape vía Radix Dialog en 6 modales + dim #8a8a92 + labels en icon-buttons + Tabs con roles Radix + omnibar/menciones con roles menu/opción.

**Step 4: Run test to verify it passes**
Run: axe 0 violaciones + renderer tests PASS

**Step 5: Commit**
```bash
git add apps/desktop/renderer/src/index.css apps/desktop/renderer/components/
git commit -m "fix: WCAG AA focus trap escape contrast labels"
```

---

### Task 8: UI-05 — Sidebar viva + omnibar + BYOK + Daily + menciones + perf (EGO-FIND-05/09/12/15)

**Files:**
- Modify: `apps/desktop/renderer/src/main.tsx` (ErrorBoundary global)
- Modify: `apps/desktop/renderer/components/sidebar.tsx` → split en 3 (Sidebar/ProjectsModal/SettingsModal Radix + roster/sesiones/proyectos vía IPC, sin hardcodeados `sidebar.tsx:250-300`, botones con acción o eliminados)
- Create: `apps/desktop/renderer/components/omnibar.tsx` (Ctrl+K federado a `searchMulti` con debounce 250ms + corte confianza; Ctrl+, abre settings)
- Modify: settings a form por proveedor (openai/anthropic/google/deepseek + baseURLs + activeProvider, exige key no vacía, getter enmascarado)
- Modify: `DailyDashboard.tsx:79-88` (eliminar `appr-pending-init` falso; solo lista real)
- Modify: `ego-chat.tsx:36-39` (avatar único por turno según subEgo activo) + Composer con @ (FileMentionBadge) y / (SlashCommandParser) + forms Canvas con onSubmit a IPC
- Modify: `App.tsx:96` (columnas resizable vía SplitPane) + `DomainCanvasView.tsx:142` (debounce search)
- Modify: `DomainCanvasView` + `MetricsConsole` (React.lazy recharts/dominios/mermaid) + chat/tablas/sidebar con `virtua`
- Test: nuevos `Sidebar.test.tsx`, `App.test.tsx`, `Omnibar.test.tsx`

**Step 1: Write failing test**
```tsx
// Sidebar con bridge mock debe listar proyectos del bridge, no hardcodeados
// Ctrl+K abre omnibar federado con debounce (hoy no hay handler)
// BYOK por proveedor exige key no vacía; Daily sin appr-pending-init
// Composer @ menciona archivo, / ejecuta slash; forms Canvas hacen onSubmit IPC
```

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @ego/renderer test -- Sidebar`
Expected: FAIL

**Step 3: Write minimal implementation**
- Split + datos IPC + omnibar federado + BYOK por proveedor + Daily real + @ y / + debounce + lazy (charts/dominios/mermaid) + virtua + boundary global + avatar por subEgo activo (Regla Estabilidad Visual).
- Medir bundle antes/después (baseline `vite.config.ts:15` chunk único ~1.48MB) + humo fps.

**Step 4: Run test to verify it passes**
Run: `pnpm --filter @ego/renderer test; pnpm --filter @ego/desktop test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/desktop/renderer/components/sidebar.tsx apps/desktop/renderer/src/main.tsx
git commit -m "feat: sidebar split with live IPC, shortcuts, lazy, global boundary"
```

---

### Task 9: UI-06 + docs sync (D1-D12, roadmap, stack, Backlog)

**Files:**
- Create: `docs/design/design-system.md`
- Modify: `docs/product/ux-ui.md` (D1 sidebar dual, D7 4 elementos, D8 Widget vs Tray)
- Modify: `docs/product/character-art-direction.md` (D2 monolito por defecto)
- Modify: `docs/roadmap/Backlog.md` (D4 CHAR-03 sin "trajes", corregir TOTAL 130/151 + Fase07 11/11→15/15, CANV-12 vs EGO-FIND-15)
- Modify: `docs/architecture/character-system.md` (D3 parcial honesto: falta CHAR-05 tests, CHAR-10 persistencia UI, CHAR-11 benchmarks)
- Modify: `docs/product/mascota.md` + `workspace-dinamico.md` (D6 superficies)
- Modify: `docs/extractions/hermes-agent.md` (D9 regla B/N), `docs/references/gui-desktop.md` (D10 dark-first matiz)
- Modify: `docs/roadmap/roadmap.md` + `docs/index.md` + `PLAN-EGO.md:36` + `engineering/stack-tecnico.md` (D11, 116→151, Router/Radix/Zustand)
- Modify: `AGENTS.md` (corregir "faltan Q6/Q8/Q17" — sí existen)

**Step 1: Write failing test**
```powershell
.\scripts\check-agents-refs.ps1  # debe fallar hoy por refs rotas/contradicciones
```

**Step 2: Run test to verify it fails**
Expected: FAIL

**Step 3: Write minimal implementation**
- Aplicar D1-D12 + correcciones aritméticas (TOTAL, Fase07 11/11→15/15, CANV-12 vs EGO-FIND-15) + design-system.md canónico.
- Gobernanza: Backlog manda (sincronizar frontmatters SUB-02/03/04, DIST-02, HIG-01/02/03; archivar plan-maestro F1-F6 como absorbido; HIG/UI como extensión formal del esquema).
- Futuro priorizado sin descartes: COUC-23/CHAR-12, OCLW-17, HERM-20 (reconciliar con omnibar: el omnibar de Task 8 ES HERM-20), HERM-21 (reconciliar con MetricsConsole), HERM-22 (gateways, P3 futuro), SoundEngine WAV, island/spring completos (reconciliar COUC-17/18/20/21 con WIDG-02/CHAR-03..07: cerrar formalmente lo absorbido), COUC-22 (P3).
- Verificación previa: antes de archivar plan-maestro, verificar qué tasks F2–F6 siguen vivas (no re-dispatch ciego).
- Higiene DoD: cada workaround VantaDB lleva `// Workaround: VDB-XXX` + fila en `VANTADB-FEEDBACK-Y-MEJORAS.md` (AGENTS.md §4).
- Doc-freeze NO autorizado por el owner (2026-10-14): se mantienen los 163 docs + historial dentro del repo; sin archivado externo. Fuente preguntas: `C:\Users\Eros\Downloads\Preguntas y respuestas.txt` (el cruce Q1–Q25 se verificó contra la copia del repo; si difiere de Downloads, diff pendiente).
- Gates/vigilancia: DIST-04/06 PENDING (certificados/VM) + DIST-09/REQ-08 vigilancia documentada; budget manual + auditoría en `metricas-okr.md`.
- Auditoría Hermes (R2/R3/R7/R9/R12/HIG): R2 claim "88 tools vantadb-mcp" → DOCUMENTAR procedencia (proyecto hermano VantaDB, no verificable desde Ego) en los 5+ docs; R3 TOTAL → ~148/151 (~98%); R7 reemplazar "SHA pendiente del lead" ×5 (DIST-02/03/05/07/08) por SHAs reales; R9 HIG-04 reconciliar (código `DailyStatePersistence.ts:74-76` ya quarantine-aware); R12 `git worktree remove` del wt-ego-task-denied (29M locales, 0 archivos trackeados); HIG-01 verificar `tsc --noEmit -p tests/tsconfig.json` (57 errores alegados); HIG-02 gate anti-`dist/` obsoleto.

**Step 4: Run test to verify it passes**
Run: `check-agents-refs.ps1` verde + grep 0 "trajes" en CHAR-03 + grep 0 contradicciones

**Step 5: Commit**
```bash
git add docs/design/design-system.md docs/product/ docs/architecture/ docs/roadmap/Backlog.md AGENTS.md
git commit -m "docs: sync design system D1-D12, fix roadmap counts and stack"
```

---

### Task 11: Arquitectura decidida — electron-vite + Q9 + LICENSE/prototype + monolito código

**Files:**
- Modify: `apps/desktop/package.json` + `scripts/dev-electron.cjs` + `electron-builder.config.cjs` (migración electron-vite con re-verificación smoke nativo + dist)
- Modify: `packages/events/src/` + `packages/subegos/src/DelegationRouter.ts` + `SharedMemory.ts` (renombrar a términos canónicos Q9 con blast-radius; actualizar tests `desktop 150/150` + docs)
- Modify: `LICENSE` (verificar Apache 2.0) + rename `windows/FloatingWindowPrototype.ts` → definitivo con re-export
- Modify: `apps/desktop/src/main.ts` — R13 seguridad: aplicar CSP estricta (`onHeadersReceived`/`webRequest`; SEC-01 la afirma pero el grep da vacío). Con `sandbox:true` el riesgo está mitigado, pero es claim de tarea cerrada incumplido (~2h).
- Modify: `packages/execution/src/WidgetHitlBridge.ts` — ver Task 2 (R10b ActionIdentity).
- Modify: `packages/integrations/src/mcp/McpClient.ts:106-111` — R10: decisión owner VERIFICAR FIRMA REAL (1-2 días, cambia contrato config MCP). Hoy `isSignedServer` solo compara `trustLevel` autodeclarado; las tools igual pasan por Zod y permisos (no es bypass). Interino: documentar la limitación hasta tener la verificación.
- Modify: `packages/subegos/src/SelfImprovementLoop.ts` — R15: versionar/guardar backup del estado previo antes de aplicar lecciones (hoy valida con Zod pero sin rollback).
- Modify: `components/character/` + `packages/subegos/src/CharacterProfile.ts` (monolito por defecto en código, delta/mochi como variantes)
- Test: `smoke-native-packaged.cjs` + `FloatingWindow.test.ts` + suite character

**Step 1: Write failing test**
```bash
# smoke nativo + grep 0 FloatingWindowPrototype + baseForm default monolith
```

**Step 2: Run test to verify it fails**
Expected: FAIL (sin electron-vite, nombres viejos, prototype, delta default)

**Step 3: Write minimal implementation**
- Migrar loop a electron-vite (rollback: volver a tsc+concurrently si smoke falla) + rename Q9 + license/prototype + monolito default.

**Step 4: Run test to verify it passes**
Run: `pnpm build; pnpm --filter @ego/desktop test; pnpm smoke:native`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/desktop/package.json packages/events/ packages/subegos/src/ LICENSE apps/desktop/src/windows/ apps/desktop/renderer/components/character/
git commit -m "chore: electron-vite migration, Q9 canonical names, license, monolith default"
```

---

### Task 10: Verificación integral arranque → UI (checklist manual + build)

**Files:**
- Test: `tests/e2e/golden-path-beta.test.ts` + smoke `smoke-native-packaged.cjs`
- Run: `pnpm build` + `pnpm build:verify` + `pnpm test` raíz

**Step 1: `pnpm build`**
Expected: exit 0 + verify-dist VERDE

**Step 2: `pnpm test` raíz**
Expected: 0 regresiones (renderer 49 + desktop 150 + packages) — prerrequisito Task 0 (shims) verde; HIG-01 (`tests/tsconfig`) y HIG-02 (gate anti-`dist/`) verificados.

**Step 3: Checklist manual Electron (`pnpm dev`)**
- [ ] Arranca sin consola roja; header + ActivityWidget idle `[●]`
- [ ] Chat: enviar turno → deltas streaming + badge 🧠 + sin layout shift
- [ ] HITL: tool sensible → ApprovalCard → Aprobar/Rechazar/Editar funciona
- [ ] Proyectos: crear + selectFolder + switch contexto sobrevive reinicio
- [ ] Sub-Egos: listar reales (no hardcodeados), crear, toggle state
- [ ] Canvas: tabla/form/chart/board desde JSON → editar → reinicio intacto
- [ ] MCP/Skills: añadir server, listar tools, toggle
- [ ] Daily: first-launch abre dashboard; métricas; journal persiste
- [ ] Dominios: Engineering/Product/CRM/Analytics sin listas vacías silenciosas
- [ ] A11y: Tab visible, Escape cierra los 6 modales Radix, sin errores axe
- [ ] Sin keys: chat bloquea con error BYOK explícito por proveedor (no mock indistinguible)
- [ ] Omnibar Ctrl+K federado + @ y / en composer + Tray con colores + mermaid lazy + virtua sin saltos
- [ ] `pnpm build` + `pnpm build:verify` + `pnpm test` raíz verdes tras Task 11

**Step 4: Commit final**
```bash
git add docs/agent-ops/plans/2026-10-14-plan-reparacion-integral-frontend-backend.md
git commit -m "docs: integral frontend-backend repair plan verified"
```

---

## Orden de ejecución

Task 1 contrato → Task 3 tasks/tray/terminal → Task 5 tema → Task 6 kit Radix/Zustand → Task 2 streaming → bloqueo mock → Task 4 canvas → Task 8 sidebar/omnibar/BYOK/Daily/menciones/perf → Task 7 a11y → Task 11 arquitectura → Task 9 docs/gobernanza → Task 10 verificación. No avanzar sin `typecheck + tests` verdes por task (Regla Fase Completa, AGENTS.md §6).

---

## Retrospectiva de cierre (2026-10-14, 11/12 tasks ✅ + Task 0 owner)

- **Start:** packets de 10 bloques + archivos prohibidos explícitos (cero colisiones en 9 workers paralelos/secuenciales); verificar con comandos reales, no inferir.
- **Stop:** paralelismo >2 subagentes (rate-limit mata workers y los caídos alucinan evidencia); `grep`/`head` en pwsh (no existen).
- **Continue:** task files como estado durable + RESULTADO obligatorio + Gate V al owner + rollback limpio antes de insistir (S6).
- **Mejora medible:** pre-chequear `codegraph`/MCP disponibles en el runner antes del dispatch (2 workers degradaron a read/grep) — baseline: 2/9 degradados esta campaña → objetivo 0/9.
- **Pendiente owner:** Task 0 (shims EPERM) + Step 3 checklist GUI `pnpm dev` (13 ítems) + R12 worktree remove.
