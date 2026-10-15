# Isla Flotante Ego Completa Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Terminar la isla flotante de Ego (minimizado/segundo plano) con paridad funcional de Coucou reconstruida en contratos Ego + criatura `repos-referencia/avatar` + UploadCanvas completo.

**Architecture:** `BackgroundEngine/AttentionStateMachine -> FloatingWindowManager -> FloatingWindow (BrowserWindow frameless) -> floating.html (ego-avatar mini + vistas + ticker + UploadCanvas) -> WidgetHitlBridge -> ApprovalEngine`. FSM pura sin Electron, física Spring/Tracked, sonido procedural avatar, click-through event-driven sin polling 60Hz, tray tricolor como espejo.

**Tech Stack:** Electron 33 + electron-vite 5, React 19 + TypeScript strict, ego-avatar ESM (`<ego-avatar>` WebComponent, `PresenceStateMachine`, `sound.js` 28 recetas), VantaDB via EgoMemoryAdapter (solo main), IPC tipado Zod via preload, vitest + playwright.

**Decisiones owner (2026-10-15, HITL):**
- D1 Visual = criatura `repos-referencia/avatar` (NO Mochi; LICENSE-ASSETS prohibe clon).
- D2 Minimizar = auto-mostrar flotante si hay trabajo/HITL, click restaura, silencable.
- D3 Sonido = `avatar/src/runtime/sound.js` procedural (28 recetas, cero WAV binarios).
- D4 Drop = UploadCanvas completo porteado (UploadSeq + canvas + ingest background).
- Guardrails: `contextIsolation=true sandbox=true nodeIntegration=false`, NO VantaDB en renderer, NO `Client vantadb/WASM`, solo `NativeVantaDB`, Renderer = presentación, aprobación solo resuelve acción exacta, `🚫 Descartada` solo con justificación.

---

## Compuerta Opción B (leer antes de codificar)

- Ficha: `docs/extractions/coucou.md` §6-7,14,28-29,39,49-51 (FSM pura, NO notch como arquitectura).
- Backlogs: `docs/review/backlog-coucou.md` COUC-06/17/18/19/20/21, `docs/roadmap/Backlog.md` WIDG-01..05 CANV-11 TASK-05/06.
- Fuentes Coucou: `repos-referencia/coucou/windows/src/island/island.ts+fsm.ts+hooks.ts+integrations.ts`, `core/anim.ts+layout.ts+sound.ts+bridge.ts+state.ts`, `mochi/engine.ts+greeting.ts+minibots.ts`, `views/*.ts`, `upload/sequence.ts+canvas.ts`, `src-tauri/src/island.rs+tray.rs`, `NotchBuddy/IslandStateMachine.swift+IslandWindowController.swift+AppState.swift+HookServer.swift+DemoEngine.swift+SoundEngine.swift+SafeWebURL.swift+WindowContextCapture.swift`.
- Fuentes avatar: `repos-referencia/avatar/src/index.js`, `core/anim.js+timeline.js+genome.js+config.js`, `runtime/states.js+presence.js+sound.js+avatar-element.js+policy.js`, `studio/sound.js+adapter.js`.
- Estado Ego: `apps/desktop/src/windows/FloatingWindow.ts+FloatingWindowView.ts+WindowStateManager.ts`, `packages/runtime/src/AttentionStateMachine.ts`, `packages/execution/src/WidgetHitlBridge.ts`, `apps/desktop/src/main.ts`, `apps/desktop/src/preload.ts`, `renderer/components/character/`.

### Task 0: Puerta extracción + contrato legal

**Files:**
- Modify: `docs/review/backlog-coucou.md:53-56`
- Create: `docs/agent-ops/tasks/T-isla-gates.md`
- Test: `n/a (documental)`

**Step 1: Write the failing test**

```bash
# grep debe dar 0 Mochi en plan activo
grep -r "mochi\|Mochi\|BOT_STATES" docs/agent-ops/plans/2026-10-15-isla-flotante-ego-completa.md || echo "FAIL: sin gate legal"
```

**Step 2: Run test to verify it fails**

Run: `grep -r "Mochi" docs/agent-ops/plans/2026-10-15-isla-flotante-ego-completa.md; echo $?`
Expected: FAIL / match encontrado antes del gate

**Step 3: Write minimal implementation**

Escribir en `T-isla-gates.md`:
```markdown
# Gates isla (Opción B)
- Asimilar: fsm.ts->PresenceStateMachine/avatar presence.js->AttentionStateMachine, anim.ts Spring/Tracked, sound.js 28 recetas, UploadSeq aritmética, Approval ACK 800ms/timeout 110-115s, SafeWebURL http/https-only, PollGate->event-driven setIgnoreMouseEvents.
- Adaptar: island.ts shell->FloatingWindow+ свежfloating.html, views->cards Ego, tray.rs->main.ts ensureTray tricolor, TurnRecorder->RunRecorder (ya existe), DemoEngine->SyntheticRuntime (ya existe).
- Descartar: Mochi engine/greeting/minibots visual (marca), CloudKit, NSPanel/SwiftUI, Tauri Rust backend, 60Hz mouse polling, TOOL_LABELS francés, PROJECT_COLORS.
- Legal: MIT código sí con copyright; LICENSE-ASSETS Mochi/sonidos/imagen NO.
```

**Step 4: Run test to verify it passes**

Run: `grep -ri "mochi" docs/agent-ops/tasks/T-isla-gates.md | grep -v "NO.*Mochi\|sin Mochi\|no Mochi" ; echo "gate ok"`
Expected: PASS (solo menciones de descarte)

**Step 5: Commit**

```bash
git add docs/agent-ops/tasks/T-isla-gates.md
git commit -m "docs: gates extraccion isla flotante coucou+avatar"
```

---

### Task 1: AttentionStateMachine paridad Coucou/avatar

**Files:**
- Modify: `packages/runtime/src/AttentionStateMachine.ts`
- Test: `packages/runtime/test/AttentionStateMachine.test.ts`

**Step 1: Write the failing test**

```ts
// packages/runtime/test/AttentionStateMachine.isla.test.ts
import { describe, it, expect } from "vitest";
import { AttentionStateMachine } from "../src/AttentionStateMachine.js";
describe("isla parity", () => {
  it("home->compact 15s, compact->hidden 60s, pinned bloquea", async () => {
    const m = new AttentionStateMachine({ homeMs: 15_000, compactMs: 60_000 });
    m.requestAttention({ id: "a", priority: 50, state: "expanded", title: "t" });
    expect(m.getState()).toBe("expanded");
    m.setPinned(true);
    m.tick(16_000);
    expect(m.getState()).toBe("expanded"); // pinned bloquea colapso
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ego/runtime test AttentionStateMachine.isla -v`
Expected: FAIL (`setPinned/tick/homeMs` no existen)

**Step 3: Write minimal implementation**

```ts
// en AttentionStateMachine.ts añadir:
private pinned = false;
private homeMs: number; private compactMs: number;
setPinned(v: boolean) { this.pinned = v; if (!v) this.evaluateNextState(); }
tick(ms: number) { /* avanza collapseTimer; si pinned return; expanded->compact tras homeMs; compact->hidden tras compactMs */ }
```

Valores: `homeToCompact 15_000`, `compactToHidden 60_000`, `greetAuto 600`, `greetHover 10_000`, `finishedPin 5_200` (Stop->idle pin, hooks.ts:233 + avatar notify Stop).

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ego/runtime test -v`
Expected: PASS (suite previa + nueva verdes)

**Step 5: Commit**

```bash
git add packages/runtime/src/AttentionStateMachine.ts packages/runtime/test/AttentionStateMachine.isla.test.ts
git commit -m "feat: attention FSM parity isla 15s/60s/pinned"
```

---

### Task 2: Criatura avatar mini en flotante (D1)

**Files:**
- Create: `apps/desktop/renderer/floating/floating-avatar.tsx`
- Create: `apps/desktop/renderer/floating/avatar-bridge.ts`
- Test: `apps/desktop/renderer/test/floating-avatar.test.tsx`

**Step 1: Write the failing test**

```tsx
// floating-avatar.test.tsx
import { describe, it, expect } from "vitest";
import { avatarStateFor } from "../floating/avatar-bridge.js";
describe("avatar bridge", () => {
  it("mapea AttentionState->avatar state", () => {
    expect(avatarStateFor("hitl_approval")).toBe("approval");
    expect(avatarStateFor("hidden")).toBe("idle");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ego/renderer test floating-avatar -v`
Expected: FAIL (módulo no existe)

**Step 3: Write minimal implementation**

```ts
// avatar-bridge.ts — NO importar Mochi; usar ego-avatar
// seed determinista por SubEgo: seed=`subego:${activeSubEgoId ?? "ego"}`
// states.js: idle/thinking/working/searching/approval/question/error/finished/sleeping
export function avatarStateFor(a: string): string {
  if (a === "hitl_approval" || a === "alert") return "approval";
  if (a === "expanded") return "working";
  if (a === "compact") return "thinking";
  return "idle";
}
// floating-avatar.tsx: <ego-avatar seed size=120 state presence=compact>
// importa '.../avatar/src/index.js' via bundle local (copiar src, no CDN), reduced-motion -> motion="reduce"
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ego/renderer test floating-avatar -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/desktop/renderer/floating/
git commit -m "feat: avatar mini bridge para flotante"
```

---

### Task 3: Ventana flotante real con contenido (WIDG-02 fix)

**Files:**
- Create: `apps/desktop/renderer/floating/floating.html`
- Create: `apps/desktop/renderer/floating/floating.tsx`
- Modify: `apps/desktop/src/windows/FloatingWindowView.ts:26-84`
- Modify: `apps/desktop/src/preload.ts`
- Test: `apps/desktop/test/FloatingWindow.test.ts`

**Step 1: Write the failing test**

```ts
// añadir a FloatingWindow.test.ts
it("createWindow carga floating.html y expone floating:state", () => {
  const w = new FloatingWindow({ width: 180, height: 180 });
  const win = w.createWindow();
  expect((win as any).__loadedURL ?? "").toMatch(/floating/);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ego/desktop test FloatingWindow -v`
Expected: FAIL (ventana vacía, sin loadURL)

**Step 3: Write minimal implementation**

```ts
// FloatingWindowView.createWindow(): tras new BrowserWindow:
const devUrl = process.env.ELECTRON_RENDERER_URL?.replace(/\/$/, "") + "/floating/floating.html";
if (devUrl?.startsWith("http")) win.loadURL(devUrl);
else win.loadFile(join(__dirname, "../renderer/floating/floating.html"));
// floating.html: <ego-avatar> + <div id=ticker> + <div id=approval-card> + countdown bar
// preload: contextBridge.exposeInMainWorld("egoFloating", { onState(cb), approve(id), deny(id), setMuted(b) })
```

Seguridad: `will-navigate file:` only + `setWindowOpenHandler deny` (ya existe, mantener).

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ego/desktop test FloatingWindow -v && pnpm --filter @ego/desktop typecheck`
Expected: PASS + tsc 0

**Step 5: Commit**

```bash
git add apps/desktop/src/windows/FloatingWindowView.ts apps/desktop/renderer/floating/ apps/desktop/src/preload.ts
git commit -m "feat: floating window con contenido avatar"
```

---

### Task 4: Auto-mostrar al minimizar / segundo plano (D2)

**Files:**
- Modify: `apps/desktop/src/main.ts` (imports, minimize/close, backgroundEngine wiring)
- Modify: `apps/desktop/src/windows/FloatingWindow.ts` (toTrayStatus ya existe, añadir `syncFromAttention`)
- Test: `apps/desktop/test/floating-autoshow.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { shouldAutoShow } from "../src/windows/FloatingWindow.js";
describe("autoshow", () => {
  it("muestra si hay tasks activas o HITL y no muted", () => {
    expect(shouldAutoShow({ active: 1, hitl: 0, muted: false })).toBe(true);
    expect(shouldAutoShow({ active: 0, hitl: 0, muted: false })).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ego/desktop test floating-autoshow -v`
Expected: FAIL (`shouldAutoShow` no existe)

**Step 3: Write minimal implementation**

```ts
// FloatingWindow.ts
export function shouldAutoShow(s: { active: number; hitl: number; muted: boolean; disabled: boolean }): boolean {
  if (s.muted || s.disabled) return false;
  return s.active > 0 || s.hitl > 0;
}
// main.ts: instanciar UNA vez
import { FloatingWindowManager, shouldAutoShow } from "./windows/FloatingWindow.js";
let floatMgr: FloatingWindowManager | null = null;
// en ready: floatMgr = new FloatingWindowManager();
// win.on("minimize", () => { if (shouldAutoShow(snapshot())) { win.hide(); floatMgr?.show(); } });
// tray click restore: win.show(); floatMgr?.hide();
// onTaskEvent + approvalPolicy.onApprovalRequired -> floatMgr.updateState({attentionState}) + refreshTrayStatus()
// settings: presencia persistente on/off + mute (persistir WindowStateManager flotante)
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ego/desktop test floating-autoshow tasks-wiring -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/desktop/src/main.ts apps/desktop/src/windows/FloatingWindow.ts apps/desktop/test/floating-autoshow.test.ts
git commit -m "feat: autoshow flotante al minimizar con trabajo/HITL"
```

---

### Task 5: Física springs + geometría (COUC-18 real)

**Files:**
- Create: `apps/desktop/renderer/floating/floating-anim.ts`
- Modify: `apps/desktop/renderer/floating/floating.tsx`
- Test: `apps/desktop/renderer/test/floating-anim.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { islandSize } from "../floating/floating-anim.js";
describe("geometria", () => {
  it("compact < expanded", () => {
    expect(islandSize("compact").w).toBeLessThan(islandSize("expanded").w);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ego/renderer test floating-anim -v`
Expected: FAIL

**Step 3: Write minimal implementation**

Portar de `avatar/core/anim.js` (a su vez Coucou `anim.ts`): `Spring/Tracked/Ease/cubicBezier/closeCurve`.
```ts
// open spring 0.5/0.72, close 340ms ease (.45,0,.2,1) — island.rs + IslandWindowController
// islandSize(mode): hidden 240x6 strip | compact NOTCH_W | expanded 720x320 | hitl 720x400
// RAF loop: busy->stop cuando hidden (ahorra CPU); resize via win.setSize animado
// click-through: setIgnoreMouseEvents(true,{forward:true}) por defecto; false solo en hitl_approval (ya en Manager)
```

Prohibido polling 60Hz; usar `mouseenter/leave` + `Bridge.setIslandRect` equivalente IPC.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ego/renderer test floating-anim -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/desktop/renderer/floating/floating-anim.ts
git commit -m "feat: springs y geometria isla flotante"
```

---

### Task 6: Vistas flotante (overview/pill/approval/question/ticker)

**Files:**
- Create: `apps/desktop/renderer/floating/views.tsx`, `ticker.ts`, `countdown.tsx`
- Test: `apps/desktop/renderer/test/floating-views.test.tsx`

**Step 1: Write the failing test**

```tsx
// approval card construye botones 1 vez, no traga click
import { describe, it, expect } from "vitest";
describe("approval view", () => {
  it("expone approve/deny/inspect", async () => {
    const { buildApproval } = await import("../floating/views.js");
    expect(typeof buildApproval).toBe("function");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ego/renderer test floating-views -v`
Expected: FAIL

**Step 3: Write minimal implementation**

Portar mecanismo `coucou/views/*.ts` sin copy visual:
- `ViewHost{el/sync/tick/focus}`, `overview ticker-vs-card`, `pillBadge` solo si `focusId!=id`, `approval botones 1 vez`, `question 1-4q/2-4opts`, `finished/error/confused/note`, `CompactMiniGrid 2x2`, `CountdownBar 15s (window=min(10,autoClose*0.6))`, `header tabs overview/prompt/upload + settings/sound`.
- Ticker: `MAX_QUEUE 4, ROW_H 22, DURATION 380, cubic(.4,0,.2,1)` sin CSS transitions.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ego/renderer test floating-views -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/desktop/renderer/floating/views.tsx apps/desktop/renderer/floating/ticker.ts
git commit -m "feat: vistas flotante approval/question/ticker"
```

---

### Task 7: HITL completo flotante<->main (WIDG-04)

**Files:**
- Modify: `packages/execution/src/WidgetHitlBridge.ts`
- Modify: `apps/desktop/src/main.ts`, `apps/desktop/src/preload.ts`
- Test: `packages/execution/test/WidgetHitlBridge.test.ts`

**Step 1: Write the failing test**

```ts
it("ACK 800ms: sin UI no bloquea, fallback a main", async () => {
  const b = new WidgetHitlBridge({ ackMs: 800 });
  const p = b.presentApproval({ requestId: "r1", tool: "Bash" } as any);
  await expect(p).resolves.toMatchObject({ fallback: true });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ego/execution test WidgetHitlBridge -v`
Expected: FAIL (timeout/cuelgue)

**Step 3: Write minimal implementation**

```ts
// presentApproval(): send floating:approval -> espera ACK 800ms
// si ACK: mantiene pending + isPinned + focus=pillId + sonido approval
// si NO ACK: fallback main window (approval.resolve) sin colgar executor
// resolve solo si ActionIdentity exacta: runId+taskId+subEgoId+toolId+invocationId+inputDigest (SHA-256 keys ordenadas)
// timeout 115s (110s copilot), duplicado->decline inmediato, cierre externo->"Handled in X"
// decisión NUNCA solo por toolName
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ego/execution test -v`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/execution/src/WidgetHitlBridge.ts apps/desktop/src/main.ts
git commit -m "feat: HITL flotante con ACK y fallback"
```

---

### Task 8: Sonido desde avatar (D3, COUC-20)

**Files:**
- Create: `apps/desktop/renderer/floating/floating-sound.ts`
- Modify: `apps/desktop/renderer/floating/floating.tsx`
- Test: `apps/desktop/renderer/test/floating-sound.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { soundFor } from "../floating/floating-sound.js";
describe("sound map", () => {
  it("approval->approval, error->error", () => {
    expect(soundFor("hitl_approval")).toBe("approval");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ego/renderer test floating-sound -v`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// envolver avatar/src/runtime/sound.js createSoundEngine()
// SOUND_NAMES 28 literales, STATE_SOUND/EMOTE_SOUND/ACTION_SOUND, volume 0.12 bounds [0,0.2], idle suspend 1500ms
// mapa: peek/open/close/hover/blip + work/finish/error/approval/question/approve + think/search/rate/sleep
// muted desde FloatingWindowState.muted; sin AudioContext -> no-op; NUNCA assets WAV binarios nuevos
import { createSoundEngine, STATE_SOUND } from "../../../../repos-referencia/avatar/src/runtime/sound.js";
// copiar a packages o renderer/floating/vendor con LICENSE nota MIT Louis Raillart
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ego/renderer test floating-sound -v`
Expected: PASS (Node no-op, browser suena)

**Step 5: Commit**

```bash
git add apps/desktop/renderer/floating/floating-sound.ts
git commit -m "feat: sonido procedural avatar en flotante"
```

---

### Task 9: UploadCanvas completo + drop + URL segura (D4)

**Files:**
- Create: `apps/desktop/renderer/floating/upload-seq.ts`, `upload-canvas.ts`
- Modify: `apps/desktop/src/main.ts` (ingest IPC), `apps/desktop/src/preload.ts`
- Test: `apps/desktop/renderer/test/floating-upload.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { progressAt } from "../floating/upload-seq.js";
describe("upload seq", () => {
  it("progreso monotono", () => {
    expect(progressAt(0)).toBeLessThanOrEqual(progressAt(1000));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ego/renderer test floating-upload -v`
Expected: FAIL

**Step 3: Write minimal implementation**

Portar `coucou/upload/sequence.ts+canvas.ts` (100% mecanismo):
```ts
// USC, eOut/eIn/eBack, squeezeY/X, follow spring 0.35/lock 0.18, LOCK_IN 60/OUT 90, progress curva 60/32/8, simulateTo 240Hz
// UploadCanvas.draw(f,wallTime): zone/bar/choose/mochi->avatar/file, suck strips 28 + clip mouth, overlay botones invisibles
// drop en flotante -> ingestFile background + stepSequence(tick 10%+✓) via ipc knowledge.ingest (ya existe), NO bloquear UI
// SafeWebURL: solo http/https + host (bloquear file:/smb:/custom) antes de shell.openExternal
// ContextProvider: attach-window-context opcional al prompt
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ego/renderer test floating-upload -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/desktop/renderer/floating/upload-*
git commit -m "feat: UploadCanvas completo en flotante"
```

---

### Task 10: Tray completo + persistencia flotante (WIDG-05, COUC-19 cierre)

**Files:**
- Modify: `apps/desktop/src/main.ts:424-460`, `apps/desktop/src/windows/WindowStateManager.ts`
- Test: `apps/desktop/test/tasks-wiring.test.ts`, `apps/desktop/test/floating-persist.test.ts`

**Step 1: Write the failing test**

```ts
it("flotante persiste pos/mute/disabled", () => {
  expect(typeof (global as any).__floatingPersist).toBe("function");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ego/desktop test floating-persist -v`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// WindowStateManager: extender de main_window a floating_window {x,y,muted,disabled,presenceMode}
// restore/track/debounce 500ms/persist VantaDB system/window-state + window-state.json + validateBoundsAgainstDisplays
// Tray: menú Open/Settings/Pause/Quit + emit tray:id, tooltip verde idle/azul pensando/rojo HITL (ya existe, completar Pause)
// repositionToDisplay() en screen-changed + display-metrics-changed
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ego/desktop test tasks-wiring floating-persist -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/desktop/src/windows/WindowStateManager.ts apps/desktop/src/main.ts
git commit -m "feat: persistencia flotante y tray completo"
```

---

### Task 11: Tests + validación + verificación

**Files:**
- Modify: `apps/desktop/test/FloatingWindow.test.ts`, `packages/runtime/test/*`, `packages/execution/test/*`
- Create: `tests/e2e/floating-minimize.test.ts`, `tests/gui/specs/floating-island.spec.ts`
- Test: full suites

**Step 1: Write the failing test (E2E)**

```ts
// tests/e2e/floating-minimize.test.ts
import { test, expect } from "@playwright/test";
test("minimizar con task activa muestra flotante y restaura", async () => {
  // 1. inicia task background 2. minimize 3. espera floating visible 4. click restaura 5. HITL approval en flotante resuelve
  expect(true).toBe(false); // rojo inicial
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test floating-minimize -v`
Expected: FAIL rojo

**Step 3: Write minimal implementation**

Checklist verificación:
```bash
pnpm --filter @ego/desktop typecheck      # tsc 0
pnpm --filter @ego/renderer test           # vitest flotante + anim + views + sound + upload verdes
pnpm --filter @ego/runtime test
pnpm --filter @ego/execution test
pnpm build && pnpm smoke:native            # electron-vite out/main+preload+renderer + verify-dist
pnpm test:e2e floating-minimize            # minimize->float->restore->HITL
# caos: kill mid-task -> resume desde checkpoint (TASK-10)
# a11y: reduced-motion desactiva springs/ticker, foco visible, Esc colapsa, Enter aprueba
# perf: RAF detenido en hidden, 0% CPU idle, ring-buffer terminal intacto
# packaging: DIST NSIS/DMG incluye floating.html + avatar vendor, Wayland limit documentado
```

**Step 4: Run test to verify it passes**

Run: `pnpm build && pnpm --filter @ego/desktop test && pnpm smoke:native`
Expected: PASS todo verde

**Step 5: Commit**

```bash
git add tests/e2e/floating-minimize.test.ts
git commit -m "test: e2e isla flotante minimize/HITL"
```

---

### Task 12: Cierre docs + backlog

**Files:**
- Modify: `docs/roadmap/Backlog.md:336-339,426`, `docs/review/backlog-coucou.md:53-56`, `docs/architecture/character-system.md`, `docs/product/ux-ui.md`, `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` (si workaround)
- Test: `grep -r "apps/desktop/main/windows" docs/roadmap/Backlog.md` debe dar 0

**Step 1: Write the failing test**

```bash
grep -r "apps/desktop/main/windows" docs/roadmap/Backlog.md && echo "FAIL path obsoleto"
```

**Step 2: Run test to verify it fails**

Run: `grep -r "apps/desktop/main/windows" docs/roadmap/Backlog.md`
Expected: FAIL (match = path obsoleto WIDG-02)

**Step 3: Write minimal implementation**

- Corregir WIDG-02 path a `apps/desktop/src/windows/FloatingWindow.ts` + `renderer/floating/floating.html`.
- COUC-17/18 ✅ Completada real (implementación isla Tasks 3-7/10, no solo absorbida T09), COUC-19 ✅ Completada (tray tricolor + Pause + persist), COUC-20 ✅ Parcial procedural (WAV futuro P2 documentado, sin descarte).
- Actualizar `character-system.md §7` + `ux-ui.md D8`: Widget in-app vs Tray OS vs Flotante desktop-float.
- Si hubo workaround VantaDB: registrar `VDB-BUG-*` obligatorio (DoD).

**Step 4: Run test to verify it passes**

Run: `grep -r "apps/desktop/main/windows" docs/roadmap/Backlog.md; echo $?`
Expected: PASS (exit 1, 0 matches)

**Step 5: Commit**

```bash
git add docs/roadmap/Backlog.md docs/review/backlog-coucou.md docs/architecture/character-system.md
git commit -m "docs: cierre formal isla flotante COUC-17/18/19/20"
```

---

## Orden ejecución

`0 gates -> 1 FSM -> 2 avatar -> 3 ventana -> 4 autoshow -> 5 física -> 6 vistas -> 7 HITL -> 8 sonido -> 9 upload -> 10 tray/persist -> 11 tests/e2e -> 12 docs`

Regla fase: `IMPLEMENTADO + INTEGRADO + FUNCIONAL + ERROR + PERSISTENCIA + SIN REGRESIONES + UX`.
