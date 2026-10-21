/**
 * EGO-FIND-104 — Regla canónica de PRESENCIA de la isla flotante.
 *
 * Contrato tras el fix:
 *  1. La presencia del autoshow la gobierna SOLO `isPresenceAllowed`
 *     (`disabled` + `presenceMode`): `muted` es audio y jamás bloquea.
 *  2. El resync en `did-finish-load` re-empuja el estado ACTUAL del manager
 *     (la creación lazy del primer show perdía el push: isla pintada en
 *     `hidden` = CSS opacity 0 = invisible con la ventana "visible").
 *  3. Una isla con audio muted sigue SIENDO interactiva (muted ≠ click-through).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isPresenceAllowed,
  FloatingWindowManager,
} from "../src/windows/FloatingWindow.js";
import { BrowserWindow } from "electron";

/** Shape duplicado a propósito de floating-autoshow.test.ts (mismo mock). */
vi.mock("electron", () => {
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
    },
  };
});

describe("EGO-FIND-104 — gate de presencia `isPresenceAllowed`", () => {
  it("presencia 'auto' sin disabled → permitida (el caso del minimize normal)", () => {
    expect(
      isPresenceAllowed({ disabled: false, presenceMode: "auto" })
    ).toBe(true);
  });

  it("presencia ausente del registro persistido → default 'auto' → permitida", () => {
    expect(isPresenceAllowed({ disabled: false })).toBe(true);
  });

  it("'always' → permitida", () => {
    expect(
      isPresenceAllowed({ disabled: false, presenceMode: "always" })
    ).toBe(true);
  });

  it("'never' bloquea la presencia (presencia desactivada en settings)", () => {
    expect(
      isPresenceAllowed({ disabled: false, presenceMode: "never" })
    ).toBe(false);
  });

  it("disabled bloquea la presencia aunque presenceMode sea 'always'", () => {
    expect(
      isPresenceAllowed({ disabled: true, presenceMode: "always" })
    ).toBe(false);
  });
});

describe("EGO-FIND-104 — la isla audible-mute sigue VIENDO e INTERACTUANDO", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resync en did-finish-load: el estado ACTUAL llega al renderer aunque el push anterior se perdiera", () => {
    const mgr = new FloatingWindowManager();
    // Estado equivalente al usuario real: audio muted persistido de una
    // sesión anterior (window-state.json → floating_window.muted = true).
    mgr.setMuted(true);
    // show() crea la ventana en CALIENTE (lazy, primer use) y enlaza el resync.
    mgr.show();
    mgr.updateState({ attentionState: "compact" });

    const mockWin = (BrowserWindow as unknown as ReturnType<typeof vi.fn>)();
    const wc = (mockWin as { webContents: { on: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn>; setIgnoreMouseEvents: ReturnType<typeof vi.fn> } }).webContents;

    // Recupera el handler registrado en FloatingWindowView.createWindow.
    const didLoadCall = wc.on.mock.calls.find(
      (c: unknown[]) => c[0] === "did-finish-load"
    );
    expect(didLoadCall).toBeDefined();
    const onLoad = didLoadCall?.[1] as () => void;

    // La carga terminó AHORA (la vedera secuencia: llega tarde casi siempre).
    onLoad();

    const pushed = wc.send.mock.calls
      .filter((c: unknown[]) => c[0] === "ipc.floating.state_changed")
      .map((c: unknown[]) => c[1] as { muted: boolean; attentionState: string; visible: boolean });
    expect(pushed.length).toBeGreaterThan(0);

    const resync = pushed.at(-1) as { muted: boolean; attentionState: string; visible: boolean };
    expect(resync.attentionState).toBe("compact");
    expect(resync.muted).toBe(true);
    expect(resync.visible).toBe(true);
  });

  it("estado muted + compact: click-through APAGADO (interactiva, unmute alcanzable)", () => {
    const mgr = new FloatingWindowManager();
    // Secuencia real: la ventana existe (show en el ciclo previo minimizar).
    mgr.show();
    mgr.setMuted(true);
    mgr.updateState({ attentionState: "compact" });

    const mockWin = (BrowserWindow as unknown as ReturnType<typeof vi.fn>)();
    const clicks = (mockWin as { setIgnoreMouseEvents: ReturnType<typeof vi.fn> })
      .setIgnoreMouseEvents.mock.calls.map((c: unknown[]) => c[0] as boolean);
    // La ÚLTIMA decisión de interactividad respeta compact → interactivo.
    expect(clicks.at(-1)).toBe(false);
  });
});
