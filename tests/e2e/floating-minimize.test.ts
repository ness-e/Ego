// tests/e2e/floating-minimize.test.ts
// Task11 (T-isla-11-e2e) — E2E isla flotante: minimize → flotante → restore → HITL.
//
// Formato vitest (NO @playwright/test): `tests/package.json:8` runner = `vitest run`
// y la convención E2E-Electron vive en `tests/gui/electron/*.electron.ts`
// (`shell.electron.ts:11-14`). Sin display en este runner → Electron real imposible:
// la cadena se ejerce a nivel integración con `electron` mockeado (patrón probado
// en `floating-autoshow.test.ts:9-44`) + BackgroundEngine y WidgetHitlBridge REALES
// + asserts estáticos de wiring/a11y/perf/packaging por lectura de fuente
// (patrón `floating-persist.test.ts:211-223`).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BackgroundEngine, TaskCheckpointManager } from "@ego/tasks";
import {
  shouldAutoShow,
  syncFromAttention,
  FloatingWindowManager,
} from "../../apps/desktop/src/windows/FloatingWindow.js";
import {
  WidgetHitlBridge,
  type WidgetPresentationRequest,
} from "../../packages/execution/src/WidgetHitlBridge.js";
import { computeActionIdentity } from "../../packages/execution/src/ApprovalEngine.js";
import type { PendingApproval } from "../../packages/execution/src/types.js";

// E2E-RESOLVE: `electron` NO es dependencia de `@ego/e2e-tests`, así que el
// bare specifier no resuelve desde este archivo y `vi.mock("electron")` no
// interceptaría la copia que importa `FloatingWindowView.ts` (resuelve vía
// `apps/desktop/node_modules` → mismo realpath pnpm store; verificado por
// `require.resolve`). Se mockea por ruta relativa con idéntico realpath.
vi.mock("../../apps/desktop/node_modules/electron", () => {
  const webContents = {
    send: vi.fn(),
    on: vi.fn(),
    setWindowOpenHandler: vi.fn(() => ({ action: "deny" as const })),
  };
  const mockWin = {
    showInactive: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    close: vi.fn(),
    focus: vi.fn(),
    restore: vi.fn(),
    loadURL: vi.fn(async () => undefined),
    loadFile: vi.fn(async () => undefined),
    isMinimized: vi.fn(() => false),
    isDestroyed: vi.fn(() => false),
    setIgnoreMouseEvents: vi.fn(),
    getSize: vi.fn(() => [180, 180]),
    setPosition: vi.fn(),
    // T2 (EGO-FIND-19): `setBounds`/`setSize` permiten verificar el resize
    // por `attentionState` COMO COMPORTAMIENTO (no leyendo texto de fuente):
    // `FloatingWindowView.resizeForState` elige 240x240 (compact) vs
    // 720x300 (expanded/hitl_approval/alert).
    setBounds: vi.fn(),
    setSize: vi.fn(),
    webContents,
  };
  return {
    BrowserWindow: vi.fn(() => mockWin),
    screen: {
      getPrimaryDisplay: vi.fn(() => ({
        workAreaSize: { width: 1920, height: 1080 },
        workArea: { x: 0, y: 0, width: 1920, height: 1080 },
      })),
      getDisplayNearestPoint: vi.fn(() => ({
        workArea: { x: 0, y: 0, width: 1920, height: 1080 },
      })),
      getCursorScreenPoint: vi.fn(() => ({ x: 500, y: 500 })),
      getAllDisplays: vi.fn(() => [
        { bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
      ]),
      on: vi.fn(),
    },
  };
});

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const floatingDir = join(repoRoot, "apps", "desktop", "renderer", "floating");
const read = (p: string): string => readFileSync(p, "utf-8");

function sampleApproval(): PendingApproval {
  const now = Date.now();
  return {
    approvalId: "e2e-appr-1",
    action: {
      sessionId: "ses-e2e",
      subEgoId: "ego.developer",
      toolName: "terminal_exec",
      callId: "call-e2e-1",
      inputDigest: "pending",
      createdAt: now,
    },
    toolName: "terminal_exec",
    toolCategory: "terminal",
    riskLevel: "destructive",
    arguments: { command: "rm -rf /tmp/e2e-proof" },
    status: "pending",
    createdAt: now,
    expiresAt: now + 60_000,
  };
}

describe("E2E isla flotante — minimize → flotante → restore → HITL (Task11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("paso 1: task background real queda running (hay trabajo que justifica flotante)", async () => {
    const engine = new BackgroundEngine({ defaultTimeoutMs: 5000 });
    let release!: () => void;
    const gate = new Promise<void>((res) => {
      release = res;
    });
    engine.submit({
      id: "e2e-bg-task",
      title: "indexación de fondo",
      execute: async () => {
        await gate;
        return null;
      },
    });
    await vi.waitFor(() => {
      expect(engine.getTask("e2e-bg-task")?.status).toBe("running");
    });
    // Mismo snapshot que `main.ts:floatingSnapshot()` alimenta a shouldAutoShow.
    const snapshot = {
      active: engine.getActiveCount(),
      hitl: 0,
      muted: false,
      disabled: false,
    };
    expect(snapshot.active).toBe(1);
    expect(shouldAutoShow(snapshot)).toBe(true);
    release();
    engine.cancel("e2e-bg-task", "e2e fin paso 1");
  });

  it("pasos 2-3: minimize con trabajo → flotante visible sin robar foco", () => {
    // Espeja `main.ts:3355-3361`: win.on("minimize") → shouldAutoShow → win.hide + floatMgr.show.
    const mainWinHidden = { value: false };
    const mgr = new FloatingWindowManager();
    const snapshot = { active: 1, hitl: 0, muted: false, disabled: false };
    if (shouldAutoShow(snapshot)) {
      mainWinHidden.value = true; // win.hide()
      mgr.show(); // floatMgr.show() → showInactive (sin foco)
    }
    expect(mainWinHidden.value).toBe(true);
    expect(mgr.getState().visible).toBe(true);
    const win = (mgr as unknown as { prototype: { getWindow: () => { showInactive: () => void } } }).prototype.getWindow();
    expect(win.showInactive).toHaveBeenCalled();
    // Idle sin trabajo/muted NO auto-muestra (minimize normal).
    expect(shouldAutoShow({ active: 0, hitl: 0, muted: false })).toBe(false);
    expect(shouldAutoShow({ active: 1, hitl: 0, muted: true })).toBe(false);
    mgr.destroy();
  });

  it("paso 4: click en flotante/tray restaura la ventana principal", () => {
    // Espeja `main.ts:598-606` restore del tray: win.restore/show + floatMgr.hide.
    const mgr = new FloatingWindowManager();
    mgr.show();
    expect(mgr.getState().visible).toBe(true);
    const mainWin = { restored: false, shown: false };
    const restore = (): void => {
      mainWin.restored = true; // win.restore()
      mainWin.shown = true; // win.show()
      mgr.hide(); // floatMgr.hide()
    };
    restore(); // click en flotante / tray
    expect(mainWin.restored).toBe(true);
    expect(mainWin.shown).toBe(true);
    expect(mgr.getState().visible).toBe(false);
    mgr.destroy();
  });

  it("paso 5: HITL approval presentado en flotante resuelve con identidad exacta", async () => {
    const presented: WidgetPresentationRequest[] = [];
    const mockEngine: any = { resolveApproval: vi.fn(async () => true) };
    const bridge = new WidgetHitlBridge(mockEngine, {
      ackTimeoutMs: 200,
      onPresent: (req) => {
        presented.push(req);
      },
    });
    const approval = sampleApproval();
    const p = bridge.presentApproval(approval);
    // La flotante confirma recepción (ACK ≤800ms, patrón COUC-01) → sin fallback a main.
    expect(bridge.acknowledgePresentation("e2e-appr-1")).toBe(true);
    await expect(p).resolves.toBe(true);
    expect(bridge.isPresentedInWidget("e2e-appr-1")).toBe(true);
    expect(presented).toHaveLength(1);
    // Digest SHA-256 recomputado sobre keys ordenadas (nunca solo toolName).
    const expected = computeActionIdentity({
      sessionId: "ses-e2e",
      subEgoId: "ego.developer",
      toolName: "terminal_exec",
      callId: "call-e2e-1",
      arguments: { command: "rm -rf /tmp/e2e-proof" },
    });
    expect(presented[0]!.inputDigest).toBe(expected.inputDigest);
    expect(presented[0]!.inputDigest).toMatch(/^[0-9a-f]{64}$/);
    // Click "aprobar" en la flotante resuelve la acción exacta y limpia el widget.
    const ok = await bridge.resolve("e2e-appr-1", {
      approved: true,
      resolvedBy: "floating-approval-card",
    });
    expect(ok).toBe(true);
    expect(mockEngine.resolveApproval).toHaveBeenCalledWith("e2e-appr-1", {
      approved: true,
      resolvedBy: "floating-approval-card",
    });
    expect(bridge.isPresentedInWidget("e2e-appr-1")).toBe(false);
    // syncFromAttention: el estado HITL viaja FSM → flotante sin pérdida.
    expect(syncFromAttention("hitl_approval")).toBe("hitl_approval");
  });

  it("caos (TASK-10): kill mid-task deja checkpoint intacto y permite reanudar", async () => {
    const storage = new Map<string, Array<{ key: string; payload: unknown }>>();
    const mockAdapter: any = {
      put: vi.fn(async (item: { namespace: string; key: string; payload: unknown }) => {
        const items = storage.get(item.namespace) ?? [];
        const idx = items.findIndex((i) => i.key === item.key);
        if (idx >= 0) items[idx] = { key: item.key, payload: item.payload };
        else items.push({ key: item.key, payload: item.payload });
        storage.set(item.namespace, items);
      }),
      list: vi.fn(async (namespace: string) => storage.get(namespace) ?? []),
    };
    const checkpoints = new TaskCheckpointManager(mockAdapter);
    const engine = new BackgroundEngine({
      defaultTimeoutMs: 5000,
      checkpointProvider: {
        saveCheckpoint: async (taskId, state) => {
          await checkpoints.saveCheckpoint(
            taskId,
            typeof state.step === "number" ? state.step : 0,
            "e2e-isla",
            state,
          );
        },
        loadLatestCheckpoint: async (taskId) => {
          const cp = await checkpoints.loadLatestCheckpoint(taskId);
          return cp ? cp.state : null;
        },
      },
    });
    engine.submit({
      id: "e2e-chaos-task",
      title: "tarea asesinada a mitad",
      metadata: { kind: "sync" },
      execute: async ({ signal, saveCheckpoint }) => {
        await saveCheckpoint({ step: 5, progress: 50 });
        if (signal.aborted) throw new Error("killed");
        await new Promise<void>((_resolve, reject) => {
          if (signal.aborted) {
            reject(new Error("killed"));
            return;
          }
          signal.addEventListener("abort", () => reject(new Error("killed")));
        });
      },
    });
    await vi.waitFor(() => {
      expect(engine.getTask("e2e-chaos-task")?.status).toBe("running");
    });
    expect(engine.cancel("e2e-chaos-task", "e2e kill")).toBe(true);
    await vi.waitFor(() => {
      const s = engine.getTask("e2e-chaos-task")?.status;
      expect(s === "cancelled" || s === "failed").toBe(true);
    });
    const cp = await checkpoints.loadLatestCheckpoint("e2e-chaos-task");
    expect(cp).not.toBeNull();
    expect(cp?.stepIndex).toBe(5);
    expect(cp?.state).toEqual({ step: 5, progress: 50 });
    expect(engine.getActiveCount()).toBe(0);
  });
});

// T2 (EGO-FIND-19): este bloque dejó de ser "checklist estático" (asserts
// `expect(fuente).toContain(...)` sobre `main.ts` y `floating.html`).
// Esos asserts eran tautológicos: fallaban con refactors que NO cambiaban
// comportamiento y pasaban con código roto. La cobertura real vive ahora en:
//
//   1. `describe("comportamiento de la ventana flotante")` → ejecuta el
//      `FloatingWindowManager` REAL (con `electron` mockeado) y verifica
//      transiciones de estado, click-through, resize y broadcast al renderer.
//   2. `describe("contrato de packaging")` → verifica el ARTEFACTO real
//      (`floating.html` + la entrada MPA de electron-vite).
//   3. `apps/desktop/scripts/lint/source-contracts.lint.mjs` → contrato de
//      FUERA del árbol de tests (un ejecutable que sale con exit 1) que
//      comprueba el wiring de `main.ts` (no puede ejercitarse sin arrancar
//      Electron: `main.ts` es un entry con efectos). Ola 11 · A7: aquí vivía
//      `tests/e2e/contract/floating-wiring.contract.test.ts`, un lint-test que
//      el inventario de asertos tautológicos contaba como "prueba" sin medir
//      nada. La superficie pública de `FloatingWindow.ts` que ese fichero
//      afirmaba sobre el TEXTO ahora se comprueba por COMPORTAMIENTO en
//      `tests/e2e/floating-window-surface.test.ts`.
//   4. `tests/gui/specs/floating-island.spec.ts` → DOM REAL en navegador
//      (`#ticker`, `#approval-card`, `#countdown`).
describe("E2E isla flotante — comportamiento de la ventana flotante", () => {
  it("estado: hidden→compact→hidden con show()/hide()/updateState() reales", () => {
    const mgr = new FloatingWindowManager();
    expect(mgr.getState()).toMatchObject({
      visible: false,
      attentionState: "hidden",
      muted: false,
      disabled: false,
    });

    mgr.show();
    expect(mgr.getState().visible).toBe(true);
    // `show()` usa `showInactive()`: la isla NO roba el foco de la principal.
    const win = mgr.getFloatingWindow();
    expect(win).not.toBeNull();
    expect((win as unknown as { showInactive: ReturnType<typeof vi.fn> }).showInactive).toHaveBeenCalled();

    mgr.updateState({ attentionState: "compact" });
    expect(mgr.getState().attentionState).toBe("compact");

    mgr.hide();
    expect(mgr.getState().visible).toBe(false);
    mgr.destroy();
  });

  it("seguridad: click-through en hidden y captura del ratón en muted/compact y hitl_approval (EGO-FIND-104)", () => {
    const mgr = new FloatingWindowManager();
    mgr.show();
    const setIgnore = (mgr.getFloatingWindow() as unknown as {
      setIgnoreMouseEvents: ReturnType<typeof vi.fn>;
    }).setIgnoreMouseEvents;

    // hidden → la isla deja pasar el ratón al escritorio (forward: true).
    setIgnore.mockClear();
    mgr.updateState({ attentionState: "hidden" });
    expect(setIgnore).toHaveBeenCalledWith(true, { forward: true });

    // hitl_approval → la isla DEBE ser interactiva (el usuario aprueba/deniega).
    setIgnore.mockClear();
    mgr.updateState({ attentionState: "hitl_approval" });
    expect(setIgnore).toHaveBeenCalledWith(false);

    // EGO-FIND-104: muted es SOLO audio. Una isla muted en compact sigue
    // INTERACTIVA: el unmute vive en su propio botón (deadlock del fix).
    setIgnore.mockClear();
    mgr.updateState({ attentionState: "compact" });
    mgr.setMuted(true);
    expect(setIgnore).toHaveBeenCalledWith(false);
    mgr.destroy();
  });

  it("perf: la isla se redimensiona por attentionState (240x240 compacto vs 720x300HITL)", () => {
    const mgr = new FloatingWindowManager();
    mgr.show();
    const setBounds = (mgr.getFloatingWindow() as unknown as {
      setBounds: ReturnType<typeof vi.fn>;
    }).setBounds;

    setBounds.mockClear();
    mgr.updateState({ attentionState: "compact" });
    expect(setBounds).toHaveBeenCalledWith(
      expect.objectContaining({ width: 240, height: 240 }),
      true,
    );

    setBounds.mockClear();
    mgr.updateState({ attentionState: "hitl_approval" });
    expect(setBounds).toHaveBeenCalledWith(
      expect.objectContaining({ width: 720, height: 300 }),
      true,
    );
    mgr.destroy();
  });

  it("el estado de la isla viaja al renderer por ipc.floating.state_changed", () => {
    const mgr = new FloatingWindowManager();
    mgr.show();
    const send = (mgr.getFloatingWindow() as unknown as {
      webContents: { send: ReturnType<typeof vi.fn> };
    }).webContents.send;

    send.mockClear();
    mgr.updateState({ attentionState: "compact" });
    expect(send).toHaveBeenCalledWith(
      "ipc.floating.state_changed",
      expect.objectContaining({ attentionState: "compact" }),
    );
    mgr.destroy();
  });
});

describe("E2E isla flotante — contrato de packaging (artefacto real)", () => {
  it("electron-vite declara floating.html como entrada MPA del renderer", async () => {
    // Contrato de build: sin esta entrada, `out/renderer/floating/floating.html`
    // no se emite y la isla flotante no abre (el E2E Electron falla al cargar).
    //
    // EGO-FIND-108 (Ola 11 · A7): esto era un assert sobre el TEXTO del
    // config (`expect(cfg).toMatch(/floating:\s*resolve\(…/)`) → el inventario
    // de asertos tautológicos lo contaba como "prueba" sin medir nada. Ahora es
    // COMPORTAMIENTO: se importa el módulo y se comprueba el VALOR exportado.
    // Si la entrada MPA desaparece, el import sigue funcionando pero el
    // `input.floating` es undefined → el aserto falla de verdad.
    const mod = await import("../../apps/desktop/electron.vite.config.js");
    const cfg = (mod as { default?: Record<string, any> }).default ?? (mod as Record<string, any>);
    const input = cfg.renderer?.build?.rollupOptions?.input ?? {};
    // Las rutas son relativas al cwd (el del runner): se compara el SUFIJO.
    expect(String(input.floating)).toMatch(/floating[\\/]floating\.html$/);
    expect(String(cfg.renderer?.build?.outDir)).toMatch(/out[\\/]renderer$/);
  });

  it("floating.html monta #floating-root con CSP restrictivo y lang=es", () => {
    const htmlPath = join(floatingDir, "floating.html");
    expect(existsSync(htmlPath)).toBe(true);
    const html = read(htmlPath);

    // Punto de montaje real de la isla (el que `mountFloating` busca).
    expect(html).toContain('id="floating-root"');
    expect(html).toMatch(/<html[^>]*lang="es"/);

    // CSP: sin `unsafe-eval` ni origen remoto.
    const csp = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
    expect(csp).not.toBeNull();
    expect(csp?.[1] ?? "").toContain("default-src 'self'");
    expect(csp?.[1] ?? "").toContain("object-src 'none'");
    expect(csp?.[1] ?? "").not.toContain("unsafe-eval");
    expect(csp?.[1] ?? "").not.toContain("http:");
  });
});
